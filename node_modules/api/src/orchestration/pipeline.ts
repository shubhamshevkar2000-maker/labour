import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import RequirementExtractionAgent from '../agents/requirement-extraction-agent';
import WorkerMatchingAgent from '../agents/worker-matching-agent';
import TrustAgent from '../agents/trust-agent';
import FraudDetectionAgent from '../agents/fraud-detection-agent';
import RecommendationAgent from '../agents/recommendation-agent';

export class AgentOrchestrator {
  static async runMatchingPipeline(contractorId: string, rawText: string): Promise<{
    jobRequirementId: string;
    candidateSetId: string;
    recommendations: any[];
  }> {
    const pipelineRunId = uuidv4();
    console.log(`[Orchestrator] Starting matching pipeline. Run ID: ${pipelineRunId}`);

    try {
      // Step 1: Extract Requirements
      const extracted = await RequirementExtractionAgent.run(rawText, pipelineRunId);
      
      const jobRequirementId = uuidv4();
      
      // Save requirement to DB
      db.prepare(`
        INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobRequirementId,
        contractorId,
        rawText,
        JSON.stringify(extracted.skills),
        extracted.lat,
        extracted.lng,
        extracted.radius_km,
        extracted.headcount,
        extracted.min_trust_score,
        extracted.pay_min,
        extracted.pay_max,
        extracted.urgency_window_start,
        extracted.urgency_window_end,
        pipelineRunId,
        new Date().toISOString()
      );

      // Step 2: Run Fraud Detection Sweep to make sure candidate flags are up to date
      await FraudDetectionAgent.run(pipelineRunId);

      // Step 3: Run Match Agent
      const candidateSetId = await WorkerMatchingAgent.run(jobRequirementId, 'JOB_REQUIREMENT', pipelineRunId);

      // Step 4: For each candidate, trigger a quick Trust recalculation to ensure fresh scores
      const candidates = db.prepare(`
        SELECT worker_id FROM match_candidates WHERE match_candidate_set_id = ?
      `).all(candidateSetId) as { worker_id: string }[];

      for (const cand of candidates) {
        await TrustAgent.run(cand.worker_id, pipelineRunId);
      }

      // Re-run matching match_scores based on updated trust scores (idempotent updates)
      // To keep it simple, we just re-run WorkerMatching if we want exact updated scores, or we just trust the TrustAgent updates.
      // Let's re-run WorkerMatching once to consolidate the freshly computed trust scores!
      // This is a great, robust practice.
      const finalCandidateSetId = await WorkerMatchingAgent.run(jobRequirementId, 'JOB_REQUIREMENT', pipelineRunId);

      // Step 5: Synthesize recommendations
      const recommendations = await RecommendationAgent.run(jobRequirementId, 'JOB_REQUIREMENT', finalCandidateSetId, pipelineRunId);

      console.log(`[Orchestrator] Matching pipeline finished successfully.`);
      
      return {
        jobRequirementId,
        candidateSetId: finalCandidateSetId,
        recommendations
      };

    } catch (err: any) {
      console.error(`[Orchestrator] Pipeline failure:`, err);
      throw err;
    }
  }

  static async runCustomerMatchingPipeline(customerId: string, rawText: string): Promise<{
    serviceRequestId: string;
    candidateSetId: string;
    recommendations: any[];
  }> {
    const pipelineRunId = uuidv4();
    console.log(`[Orchestrator] Starting customer matching pipeline. Run ID: ${pipelineRunId}`);

    try {
      // Step 1: Extract Requirements
      const extracted = await RequirementExtractionAgent.run(rawText, pipelineRunId);
      
      const serviceRequestId = uuidv4();
      
      // Save service request to DB
      db.prepare(`
        INSERT INTO service_requests (id, customer_id, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?)
      `).run(
        serviceRequestId,
        customerId,
        rawText,
        JSON.stringify(extracted.skills),
        extracted.lat,
        extracted.lng,
        extracted.radius_km,
        extracted.urgency_window_start,
        extracted.urgency_window_end,
        extracted.pay_min,
        extracted.pay_max,
        pipelineRunId,
        new Date().toISOString()
      );

      // Step 2: Run Fraud Detection Sweep to make sure candidate flags are up to date
      await FraudDetectionAgent.run(pipelineRunId);

      // Step 3: Run Match Agent
      const candidateSetId = await WorkerMatchingAgent.run(serviceRequestId, 'SERVICE_REQUEST', pipelineRunId);

      // Step 4: For each candidate, trigger a quick Trust recalculation to ensure fresh scores
      const candidates = db.prepare(`
        SELECT worker_id FROM match_candidates WHERE match_candidate_set_id = ?
      `).all(candidateSetId) as { worker_id: string }[];

      for (const cand of candidates) {
        await TrustAgent.run(cand.worker_id, pipelineRunId);
      }

      // Re-run matching match_scores based on updated trust scores (idempotent updates)
      const finalCandidateSetId = await WorkerMatchingAgent.run(serviceRequestId, 'SERVICE_REQUEST', pipelineRunId);

      // Step 5: Synthesize recommendations
      const recommendations = await RecommendationAgent.run(serviceRequestId, 'SERVICE_REQUEST', finalCandidateSetId, pipelineRunId);

      console.log(`[Orchestrator] Customer matching pipeline finished successfully.`);
      
      return {
        serviceRequestId,
        candidateSetId: finalCandidateSetId,
        recommendations
      };

    } catch (err: any) {
      console.error(`[Orchestrator] Customer Pipeline failure:`, err);
      throw err;
    }
  }
}
export default AgentOrchestrator;
