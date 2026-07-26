"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
const requirement_extraction_agent_1 = __importDefault(require("../agents/requirement-extraction-agent"));
const worker_matching_agent_1 = __importDefault(require("../agents/worker-matching-agent"));
const trust_agent_1 = __importDefault(require("../agents/trust-agent"));
const fraud_detection_agent_1 = __importDefault(require("../agents/fraud-detection-agent"));
const recommendation_agent_1 = __importDefault(require("../agents/recommendation-agent"));
class AgentOrchestrator {
    static async runMatchingPipeline(contractorId, rawText) {
        const pipelineRunId = (0, uuid_1.v4)();
        console.log(`[Orchestrator] Starting matching pipeline. Run ID: ${pipelineRunId}`);
        try {
            // Step 1: Extract Requirements
            const extracted = await requirement_extraction_agent_1.default.run(rawText, pipelineRunId);
            const jobRequirementId = (0, uuid_1.v4)();
            // Save requirement to DB
            sqlite_1.db.prepare(`
        INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(jobRequirementId, contractorId, rawText, JSON.stringify(extracted.skills), extracted.lat, extracted.lng, extracted.radius_km, extracted.headcount, extracted.min_trust_score, extracted.pay_min, extracted.pay_max, extracted.urgency_window_start, extracted.urgency_window_end, pipelineRunId, new Date().toISOString());
            // Step 2: Run Fraud Detection Sweep to make sure candidate flags are up to date
            await fraud_detection_agent_1.default.run(pipelineRunId);
            // Step 3: Run Match Agent
            const candidateSetId = await worker_matching_agent_1.default.run(jobRequirementId, 'JOB_REQUIREMENT', pipelineRunId);
            // Step 4: For each candidate, trigger a quick Trust recalculation to ensure fresh scores
            const candidates = sqlite_1.db.prepare(`
        SELECT worker_id FROM match_candidates WHERE match_candidate_set_id = ?
      `).all(candidateSetId);
            for (const cand of candidates) {
                await trust_agent_1.default.run(cand.worker_id, pipelineRunId);
            }
            // Re-run matching match_scores based on updated trust scores (idempotent updates)
            // To keep it simple, we just re-run WorkerMatching if we want exact updated scores, or we just trust the TrustAgent updates.
            // Let's re-run WorkerMatching once to consolidate the freshly computed trust scores!
            // This is a great, robust practice.
            const finalCandidateSetId = await worker_matching_agent_1.default.run(jobRequirementId, 'JOB_REQUIREMENT', pipelineRunId);
            // Step 5: Synthesize recommendations
            const recommendations = await recommendation_agent_1.default.run(jobRequirementId, 'JOB_REQUIREMENT', finalCandidateSetId, pipelineRunId);
            console.log(`[Orchestrator] Matching pipeline finished successfully.`);
            return {
                jobRequirementId,
                candidateSetId: finalCandidateSetId,
                recommendations
            };
        }
        catch (err) {
            console.error(`[Orchestrator] Pipeline failure:`, err);
            throw err;
        }
    }
    static async runCustomerMatchingPipeline(customerId, rawText) {
        const pipelineRunId = (0, uuid_1.v4)();
        console.log(`[Orchestrator] Starting customer matching pipeline. Run ID: ${pipelineRunId}`);
        try {
            // Step 1: Extract Requirements
            const extracted = await requirement_extraction_agent_1.default.run(rawText, pipelineRunId);
            const serviceRequestId = (0, uuid_1.v4)();
            // Save service request to DB
            sqlite_1.db.prepare(`
        INSERT INTO service_requests (id, customer_id, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?)
      `).run(serviceRequestId, customerId, rawText, JSON.stringify(extracted.skills), extracted.lat, extracted.lng, extracted.radius_km, extracted.urgency_window_start, extracted.urgency_window_end, extracted.pay_min, extracted.pay_max, pipelineRunId, new Date().toISOString());
            // Step 2: Run Fraud Detection Sweep to make sure candidate flags are up to date
            await fraud_detection_agent_1.default.run(pipelineRunId);
            // Step 3: Run Match Agent
            const candidateSetId = await worker_matching_agent_1.default.run(serviceRequestId, 'SERVICE_REQUEST', pipelineRunId);
            // Step 4: For each candidate, trigger a quick Trust recalculation to ensure fresh scores
            const candidates = sqlite_1.db.prepare(`
        SELECT worker_id FROM match_candidates WHERE match_candidate_set_id = ?
      `).all(candidateSetId);
            for (const cand of candidates) {
                await trust_agent_1.default.run(cand.worker_id, pipelineRunId);
            }
            // Re-run matching match_scores based on updated trust scores (idempotent updates)
            const finalCandidateSetId = await worker_matching_agent_1.default.run(serviceRequestId, 'SERVICE_REQUEST', pipelineRunId);
            // Step 5: Synthesize recommendations
            const recommendations = await recommendation_agent_1.default.run(serviceRequestId, 'SERVICE_REQUEST', finalCandidateSetId, pipelineRunId);
            console.log(`[Orchestrator] Customer matching pipeline finished successfully.`);
            return {
                serviceRequestId,
                candidateSetId: finalCandidateSetId,
                recommendations
            };
        }
        catch (err) {
            console.error(`[Orchestrator] Customer Pipeline failure:`, err);
            throw err;
        }
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
exports.default = AgentOrchestrator;
