import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export class RecommendationAgent {
  static async run(requestReferenceId: string, requestReferenceType: 'JOB_REQUIREMENT' | 'SERVICE_REQUEST', candidateSetId: string, agentRunId?: string): Promise<any[]> {
    const startTime = Date.now();
    const runId = agentRunId || uuidv4();
    console.log(`[RecommendationAgent] Generating recommendations for ${requestReferenceType} ${requestReferenceId} using candidate set ${candidateSetId}`);

    try {
      // 1. Fetch Candidates
      const candidates = db.prepare(`
        SELECT mc.*, wp.user_id, wp.skills, wp.trust_score, wp.verification_status, u.full_name
        FROM match_candidates mc
        JOIN worker_profiles wp ON mc.worker_id = wp.id
        JOIN users u ON wp.user_id = u.id
        WHERE mc.match_candidate_set_id = ?
        ORDER BY mc.match_score DESC
      `).all(candidateSetId) as any[];

      const recommendations: any[] = [];
      let rank = 1;

      // Clear existing recommendations for this requirement to keep it idempotent
      db.prepare(`
        DELETE FROM recommendations 
        WHERE request_reference_id = ? AND request_reference_type = ?
      `).run(requestReferenceId, requestReferenceType);

      for (const cand of candidates) {
        const workerId = cand.worker_id;

        // Fetch supporting evidence
        // Completed jobs
        const completedJobs = db.prepare(`
          SELECT id FROM jobs WHERE worker_id = ? AND status = 'COMPLETED'
        `).all(workerId) as { id: string }[];
        const jobIds = completedJobs.map(j => j.id);

        // Ratings
        const ratings = db.prepare(`
          SELECT r.id, r.score FROM ratings r
          JOIN worker_profiles wp ON r.ratee_id = wp.user_id
          WHERE wp.id = ?
        `).all(workerId) as { id: string; score: number }[];
        const ratingIds = ratings.map(r => r.id);
        const avgRating = ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length).toFixed(1) : null;

        // Endorsements
        const endorsements = db.prepare(`
          SELECT id, skill FROM endorsements WHERE worker_id = ?
        `).all(workerId) as { id: string; skill: string }[];
        const endorsementIds = endorsements.map(e => e.id);

        // Verification Records
        const verifications = db.prepare(`
          SELECT id, type FROM verification_records WHERE worker_id = ? AND status = 'VERIFIED'
        `).all(workerId) as { id: string; type: string }[];
        const verificationIds = verifications.map(v => v.id);

        // Fraud Flags
        const fraudFlags = db.prepare(`
          SELECT id, severity, flag_type FROM fraud_flags 
          WHERE subject_type = 'WORKER' AND subject_id = ? AND status = 'OPEN'
        `).all(workerId) as { id: string; severity: string; flag_type: string }[];
        const fraudFlagIds = fraudFlags.map(f => f.id);

        // Build Explanation derived exclusively from database facts
        const clauses: string[] = [];
        
        // Clause 1: Job History
        if (completedJobs.length > 0) {
          clauses.push(`Completed ${completedJobs.length} verified jobs on this platform`);
        } else {
          clauses.push(`New worker, no completed jobs yet`);
        }

        // Clause 2: Ratings
        if (avgRating) {
          clauses.push(`average rating is ${avgRating} stars from ${ratings.length} reviews`);
        }

        // Clause 3: Endorsements
        if (endorsements.length > 0) {
          const skillsList = Array.from(new Set(endorsements.map(e => e.skill))).join(', ');
          clauses.push(`endorsed by ${endorsements.length} contractors for ${skillsList}`);
        }

        // Clause 4: Verifications
        const hasAadhaar = verifications.some(v => v.type === 'ID_DOCUMENT');
        const hasCert = verifications.some(v => v.type === 'SKILL_CERT');
        if (hasAadhaar && hasCert) {
          clauses.push(`identity and skill certificates are fully verified`);
        } else if (hasAadhaar) {
          clauses.push(`identity document verified`);
        } else if (hasCert) {
          clauses.push(`skill certificate verified`);
        } else {
          clauses.push(`verification is currently pending`);
        }

        // Clause 5: Fraud Penalties
        if (fraudFlags.length > 0) {
          const highSeverityFlags = fraudFlags.filter(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');
          if (highSeverityFlags.length > 0) {
            clauses.push(`WARNING: Has ${highSeverityFlags.length} active high-severity trust flag(s) (${highSeverityFlags.map(f => f.flag_type).join(', ')})`);
          } else {
            clauses.push(`Note: Has ${fraudFlags.length} active low-severity flag(s)`);
          }
        }

        // Combine into readable explanation
        // Capitalize first letter
        let explanation = clauses.join('; ');
        explanation = explanation.charAt(0).toUpperCase() + explanation.slice(1) + '.';

        // Evidence package maps to exact database keys
        const evidence = {
          job_ids: jobIds,
          rating_ids: ratingIds,
          endorsement_ids: endorsementIds,
          verification_ids: verificationIds,
          fraud_flag_ids: fraudFlagIds,
          trust_score: cand.trust_score,
          match_score: cand.match_score
        };

        // Write Recommendation to DB (Polymorphic)
        db.prepare(`
          INSERT INTO recommendations (id, request_reference_type, request_reference_id, worker_id, rank, explanation, evidence, generated_by_agent_run_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          requestReferenceType,
          requestReferenceId,
          workerId,
          rank,
          explanation,
          JSON.stringify(evidence),
          runId,
          new Date().toISOString()
        );

        recommendations.push({
          worker_id: workerId,
          name: cand.full_name,
          rank,
          explanation,
          evidence
        });

        rank++;
      }

      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'RECOMMENDATION', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(
        runId,
        JSON.stringify({ requestReferenceId, requestReferenceType, candidateSetId }),
        JSON.stringify({ recommendationsCount: recommendations.length }),
        JSON.stringify([requestReferenceId, candidateSetId]),
        latency,
        new Date().toISOString()
      );

      return recommendations;

    } catch (err: any) {
      console.error('[RecommendationAgent] Error:', err);
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'RECOMMENDATION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ requestReferenceId, requestReferenceType, candidateSetId }),
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }
}
export default RecommendationAgent;
