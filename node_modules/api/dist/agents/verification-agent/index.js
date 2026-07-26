"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationAgent = void 0;
const sqlite_1 = require("../../db/sqlite");
const uuid_1 = require("uuid");
const trust_agent_1 = __importDefault(require("../trust-agent"));
class VerificationAgent {
    static async run(recordId, agentRunId) {
        const startTime = Date.now();
        const runId = agentRunId || (0, uuid_1.v4)();
        console.log(`[VerificationAgent] Running verification for record ID: ${recordId}`);
        try {
            // Fetch the verification record
            const record = sqlite_1.db.prepare(`
        SELECT id, worker_id, type, evidence_url FROM verification_records WHERE id = ?
      `).get(recordId);
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
            }
            else if (record.type === 'SKILL_CERT') {
                // Skill certificate check
                if (!record.evidence_url || record.evidence_url.includes('corrupted') || record.evidence_url.includes('fake')) {
                    verifiedStatus = 'REJECTED';
                    reason = 'Certificate authenticity check failed.';
                }
            }
            // Update verification record
            sqlite_1.db.prepare(`
        UPDATE verification_records 
        SET status = ?, verified_by_agent_run_id = ?
        WHERE id = ?
      `).run(verifiedStatus, runId, recordId);
            // Re-trigger Trust Agent calculation
            await trust_agent_1.default.run(record.worker_id, runId);
            // Recalculate worker profile overall verification_status
            const allVerif = sqlite_1.db.prepare(`
        SELECT status, type FROM verification_records WHERE worker_id = ?
      `).all(record.worker_id);
            let profileStatus = 'UNVERIFIED';
            const hasId = allVerif.some(v => v.type === 'ID_DOCUMENT' && v.status === 'VERIFIED');
            const hasCert = allVerif.some(v => v.type === 'SKILL_CERT' && v.status === 'VERIFIED');
            if (hasId && hasCert) {
                profileStatus = 'VERIFIED';
            }
            else if (hasId || hasCert) {
                profileStatus = 'PARTIALLY_VERIFIED';
            }
            else if (allVerif.some(v => v.status === 'PENDING')) {
                profileStatus = 'PENDING';
            }
            sqlite_1.db.prepare(`
        UPDATE worker_profiles SET verification_status = ? WHERE id = ?
      `).run(profileStatus, record.worker_id);
            const latency = Date.now() - startTime;
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VERIFICATION', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(runId, JSON.stringify({ recordId, type: record.type, url: record.evidence_url }), JSON.stringify({ status: verifiedStatus, reason, profileStatus }), JSON.stringify([recordId, record.worker_id]), latency, new Date().toISOString());
            return verifiedStatus;
        }
        catch (err) {
            console.error(`[VerificationAgent] Error:`, err);
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VERIFICATION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(runId, JSON.stringify({ recordId }), JSON.stringify({ error: err.message }), Date.now() - startTime, new Date().toISOString());
            throw err;
        }
    }
}
exports.VerificationAgent = VerificationAgent;
exports.default = VerificationAgent;
