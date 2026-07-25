import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import TrustAgent from '../trust-agent';

export class VerificationAgent {
  static async run(recordId: string, agentRunId?: string): Promise<string> {
    const startTime = Date.now();
    const runId = agentRunId || uuidv4();
    console.log(`[VerificationAgent] Running verification for record ID: ${recordId}`);

    try {
      // Fetch the verification record
      const record = db.prepare(`
        SELECT id, worker_id, type, evidence_url FROM verification_records WHERE id = ?
      `).get(recordId) as { id: string; worker_id: string; type: string; evidence_url: string };

      if (!record) {
        throw new Error(`Verification record not found: ${recordId}`);
      }

      let verifiedStatus = 'VERIFIED';
      let reason = 'Document verification succeeded structural checks.';

      // Rules-based verification simulation
      if (record.type === 'ID_DOCUMENT') {
        // Must have a URL or reference that looks like a valid URL
        if (!record.evidence_url || (!record.evidence_url.startsWith('http') && !record.evidence_url.includes('pdf') && !record.evidence_url.includes('jpg') && !record.evidence_url.includes('png'))) {
          verifiedStatus = 'REJECTED';
          reason = 'Invalid ID document format or missing attachment.';
        }
      } else if (record.type === 'SKILL_CERT') {
        // Skill certificate check
        if (!record.evidence_url || record.evidence_url.includes('corrupted') || record.evidence_url.includes('fake')) {
          verifiedStatus = 'REJECTED';
          reason = 'Certificate authenticity check failed.';
        }
      }

      // Update verification record
      db.prepare(`
        UPDATE verification_records 
        SET status = ?, verified_by_agent_run_id = ?
        WHERE id = ?
      `).run(verifiedStatus, runId, recordId);

      // Re-trigger Trust Agent calculation
      await TrustAgent.run(record.worker_id, runId);

      // Recalculate worker profile overall verification_status
      const allVerif = db.prepare(`
        SELECT status, type FROM verification_records WHERE worker_id = ?
      `).all(record.worker_id) as { status: string; type: string }[];

      let profileStatus = 'UNVERIFIED';
      const hasId = allVerif.some(v => v.type === 'ID_DOCUMENT' && v.status === 'VERIFIED');
      const hasCert = allVerif.some(v => v.type === 'SKILL_CERT' && v.status === 'VERIFIED');

      if (hasId && hasCert) {
        profileStatus = 'VERIFIED';
      } else if (hasId || hasCert) {
        profileStatus = 'PARTIALLY_VERIFIED';
      } else if (allVerif.some(v => v.status === 'PENDING')) {
        profileStatus = 'PENDING';
      }

      db.prepare(`
        UPDATE worker_profiles SET verification_status = ? WHERE id = ?
      `).run(profileStatus, record.worker_id);

      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VERIFICATION', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(
        runId,
        JSON.stringify({ recordId, type: record.type, url: record.evidence_url }),
        JSON.stringify({ status: verifiedStatus, reason, profileStatus }),
        JSON.stringify([recordId, record.worker_id]),
        latency,
        new Date().toISOString()
      );

      return verifiedStatus;

    } catch (err: any) {
      console.error(`[VerificationAgent] Error:`, err);
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VERIFICATION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ recordId }),
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }
}
export default VerificationAgent;
