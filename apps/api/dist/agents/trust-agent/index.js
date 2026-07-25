"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustAgent = void 0;
const sqlite_1 = require("../../db/sqlite");
const uuid_1 = require("uuid");
class TrustAgent {
    static async run(workerId, agentRunId) {
        const startTime = Date.now();
        const runId = agentRunId || (0, uuid_1.v4)();
        console.log(`[TrustAgent] Recalculating trust score for worker ID: ${workerId}`);
        try {
            // 1. Fetch profile (worker or contractor) and user record
            let profile = sqlite_1.db.prepare('SELECT id, user_id, trust_score_version FROM worker_profiles WHERE id = ?').get(workerId);
            let isWorker = true;
            if (!profile) {
                profile = sqlite_1.db.prepare('SELECT id, user_id, trust_score_version FROM contractor_profiles WHERE id = ?').get(workerId);
                isWorker = false;
            }
            if (!profile) {
                console.log(`[TrustAgent] Profile not found for target ID: ${workerId}`);
                return null;
            }
            const targetUser = sqlite_1.db.prepare('SELECT id, phone, role FROM users WHERE id = ?').get(profile.user_id);
            if (!targetUser) {
                console.log(`[TrustAgent] User record not found for user: ${profile.user_id}`);
                return null;
            }
            // Fetch database collections for custom JS logic to bypass regex SQL mock limitations
            const allJobs = sqlite_1.db.prepare('SELECT * FROM jobs').all();
            const allBookings = sqlite_1.db.prepare('SELECT * FROM bookings').all();
            const allPayments = sqlite_1.db.prepare('SELECT * FROM payments').all();
            const allRatings = sqlite_1.db.prepare('SELECT * FROM ratings').all();
            const allEndorsements = sqlite_1.db.prepare('SELECT * FROM endorsements').all();
            const allVerifications = sqlite_1.db.prepare('SELECT * FROM verification_records').all();
            const allAvailability = sqlite_1.db.prepare('SELECT * FROM availability_log').all();
            const allFraudFlags = sqlite_1.db.prepare('SELECT * FROM fraud_flags').all();
            const allDisputes = sqlite_1.db.prepare('SELECT * FROM disputes').all();
            const allAdminActions = sqlite_1.db.prepare('SELECT * FROM admin_actions').all();
            const allSessions = sqlite_1.db.prepare('SELECT * FROM auth_sessions').all();
            const allContractors = sqlite_1.db.prepare('SELECT * FROM contractor_profiles').all();
            const allUsers = sqlite_1.db.prepare('SELECT * FROM users').all();
            const allEngagements = sqlite_1.db.prepare('SELECT * FROM engagements').all();
            let totalScore = 100;
            let completedJobsFactor = 0;
            let onTimeCompletionFactor = 0;
            let paymentIntegrityFactor = 0;
            let averageContractorRatingFactor = 0;
            let endorsementFactor = 0;
            let verificationFactor = 0;
            let reliabilityConsistencyFactor = 0;
            let disputeOutcomeFactor = 0;
            let fraudPenalty = 0;
            const contributingEndorsements = [];
            const contributingVerifications = [];
            const recentChanges = [];
            const completedJobs = [];
            const lostDisputes = [];
            const activeFlags = [];
            if (isWorker) {
                // --- WORKER TRUST SCORE CALCULATION ---
                const completedContractorJobs = allJobs.filter(j => j.worker_id === workerId && j.status === 'COMPLETED');
                const completedCustomerBookings = allBookings.filter(b => b.worker_id === workerId && b.status === 'COMPLETED');
                completedJobs.push(...completedContractorJobs, ...completedCustomerBookings);
                const workerPayments = allPayments.filter(p => {
                    if (p.job_reference_type === 'CONTRACTOR_JOB') {
                        const job = allJobs.find(j => j.id === p.job_reference_id);
                        return job && job.worker_id === workerId;
                    }
                    else {
                        const booking = allBookings.find(b => b.id === p.job_reference_id);
                        return booking && booking.worker_id === workerId;
                    }
                });
                const confirmedPayments = workerPayments.filter(p => p.status === 'CONFIRMED');
                // Evidentiary threshold check
                if (completedJobs.length === 0 || confirmedPayments.length === 0) {
                    console.log(`[TrustAgent] Worker ${workerId} has not met the evidentiary threshold. Trust score remains NULL.`);
                    const nextVersion = (profile.trust_score_version || 0) + 1;
                    sqlite_1.db.prepare(`
            UPDATE worker_profiles 
            SET trust_score = NULL, trust_score_updated_at = ?, trust_score_version = ?
            WHERE id = ?
          `).run(new Date().toISOString(), nextVersion, workerId);
                    return null;
                }
                const completedJobsCount = completedJobs.length;
                completedJobsFactor = Math.min(completedJobsCount * 2, 10);
                let onTimeCount = 0;
                completedJobs.forEach(job => {
                    if (job.actual_completion && job.scheduled_end) {
                        const actual = new Date(job.actual_completion).getTime();
                        const scheduled = new Date(job.scheduled_end).getTime();
                        if (actual <= scheduled) {
                            onTimeCount++;
                        }
                    }
                });
                const onTimeRate = completedJobsCount > 0 ? (onTimeCount / completedJobsCount) : 0;
                onTimeCompletionFactor = onTimeRate * 15;
                const paymentIntegrityRate = workerPayments.length > 0 ? (confirmedPayments.length / workerPayments.length) : 0;
                paymentIntegrityFactor = paymentIntegrityRate * 15;
                const workerRatings = allRatings.filter(r => r.ratee_id === targetUser.id || r.ratee_id === workerId);
                let avgRating = 0;
                if (workerRatings.length > 0) {
                    const sum = workerRatings.reduce((acc, r) => acc + r.score, 0);
                    avgRating = sum / workerRatings.length;
                }
                averageContractorRatingFactor = avgRating * 6;
                const workerSessions = allSessions.filter(s => s.user_id === profile.user_id);
                const workerFps = new Set(workerSessions.map(s => s.device_fingerprint).filter(fp => fp !== null && fp !== ''));
                const workerEndorsements = allEndorsements.filter(e => e.worker_id === workerId);
                const validEndorsements = [];
                for (const end of workerEndorsements) {
                    const contractor = allContractors.find(c => c.id === end.endorser_id || c.user_id === end.endorser_id);
                    if (!contractor)
                        continue;
                    const contractorUser = allUsers.find(u => u.id === contractor.user_id);
                    if (!contractorUser)
                        continue;
                    const isSuspended = allAdminActions.some(aa => aa.action_type === 'ACCOUNT_SUSPENDED' &&
                        (aa.target_id === contractor.id || aa.target_id === contractor.user_id || aa.target_id === end.endorser_id));
                    if (isSuspended)
                        continue;
                    const isFraudFlagged = allFraudFlags.some(ff => ['OPEN', 'CONFIRMED'].includes(ff.status) &&
                        (ff.subject_id === contractor.id || ff.subject_id === contractor.user_id || ff.subject_id === end.endorser_id));
                    if (isFraudFlagged)
                        continue;
                    if (targetUser.phone && contractorUser.phone && targetUser.phone === contractorUser.phone) {
                        continue;
                    }
                    const contractorSessions = allSessions.filter(s => s.user_id === contractor.user_id);
                    const hasSharedFp = contractorSessions.some(s => s.device_fingerprint && workerFps.has(s.device_fingerprint));
                    if (hasSharedFp)
                        continue;
                    validEndorsements.push(end);
                }
                const distinctContractorEndorsements = new Map();
                for (const end of validEndorsements) {
                    const contractor = allContractors.find(c => c.id === end.endorser_id || c.user_id === end.endorser_id);
                    if (contractor) {
                        if (!distinctContractorEndorsements.has(contractor.id)) {
                            distinctContractorEndorsements.set(contractor.id, end);
                        }
                    }
                }
                contributingEndorsements.push(...Array.from(distinctContractorEndorsements.values()));
                endorsementFactor = Math.min(contributingEndorsements.length * 2, 10);
                const workerVerifications = allVerifications.filter(v => v.worker_id === workerId && v.status === 'VERIFIED');
                let hasIdDoc = false;
                let hasSkillCert = false;
                let hasEmployerAttestation = false;
                workerVerifications.forEach(v => {
                    if (v.type === 'ID_DOCUMENT' && !hasIdDoc) {
                        hasIdDoc = true;
                        contributingVerifications.push(v.id);
                    }
                    else if (v.type === 'SKILL_CERT' && !hasSkillCert) {
                        hasSkillCert = true;
                        contributingVerifications.push(v.id);
                    }
                    else if (v.type === 'EMPLOYER_ATTESTATION' && !hasEmployerAttestation) {
                        hasEmployerAttestation = true;
                        contributingVerifications.push(v.id);
                    }
                });
                if (hasIdDoc)
                    verificationFactor += 10;
                if (hasSkillCert)
                    verificationFactor += 7;
                if (hasEmployerAttestation)
                    verificationFactor += 3;
                verificationFactor = Math.min(verificationFactor, 20);
                const workerAvailability = allAvailability.filter(a => a.worker_id === workerId);
                const nowTime = Date.now();
                const past24Hours = nowTime - (24 * 60 * 60 * 1000);
                const recent = workerAvailability.filter(a => new Date(a.created_at).getTime() >= past24Hours);
                recentChanges.push(...recent);
                if (recentChanges.length >= 6 && recentChanges.length <= 10) {
                    reliabilityConsistencyFactor = -2;
                }
                else if (recentChanges.length > 10) {
                    reliabilityConsistencyFactor = -5;
                }
                // Dispute outcome factor (disputes resolved with worker at fault)
                const lost = allDisputes.filter(d => {
                    if (d.status !== 'RESOLVED' || d.resolution !== 'worker_at_fault')
                        return false;
                    const eng = allEngagements.find(e => e.id === d.engagement_id);
                    return eng && (eng.initiator_id === profile.user_id || eng.counterparty_id === profile.user_id);
                });
                lostDisputes.push(...lost);
                disputeOutcomeFactor = lostDisputes.length * -10;
                // Fraud Penalty
                const flags = allFraudFlags.filter(ff => ff.subject_type === 'WORKER' && ff.subject_id === workerId && ['OPEN', 'CONFIRMED'].includes(ff.status));
                activeFlags.push(...flags);
                activeFlags.forEach(flag => {
                    if (flag.severity === 'CRITICAL')
                        fraudPenalty += 30;
                    else if (flag.severity === 'HIGH')
                        fraudPenalty += 20;
                    else if (flag.severity === 'MEDIUM')
                        fraudPenalty += 10;
                    else if (flag.severity === 'LOW')
                        fraudPenalty += 5;
                });
                totalScore = completedJobsFactor +
                    onTimeCompletionFactor +
                    paymentIntegrityFactor +
                    averageContractorRatingFactor +
                    endorsementFactor +
                    verificationFactor +
                    reliabilityConsistencyFactor +
                    disputeOutcomeFactor -
                    fraudPenalty;
            }
            else {
                // --- CONTRACTOR TRUST SCORE CALCULATION ---
                const lost = allDisputes.filter(d => {
                    if (d.status !== 'RESOLVED' || d.resolution !== 'contractor_at_fault')
                        return false;
                    const eng = allEngagements.find(e => e.id === d.engagement_id);
                    return eng && (eng.initiator_id === profile.user_id || eng.counterparty_id === profile.user_id);
                });
                lostDisputes.push(...lost);
                disputeOutcomeFactor = lostDisputes.length * -10;
                const flags = allFraudFlags.filter(ff => ff.subject_type === 'CONTRACTOR' && ff.subject_id === workerId && ['OPEN', 'CONFIRMED'].includes(ff.status));
                activeFlags.push(...flags);
                activeFlags.forEach(flag => {
                    if (flag.severity === 'CRITICAL')
                        fraudPenalty += 30;
                    else if (flag.severity === 'HIGH')
                        fraudPenalty += 20;
                    else if (flag.severity === 'MEDIUM')
                        fraudPenalty += 10;
                    else if (flag.severity === 'LOW')
                        fraudPenalty += 5;
                });
                totalScore = 100 + disputeOutcomeFactor - fraudPenalty;
            }
            totalScore = Math.max(0, Math.min(Math.round(totalScore), 100));
            const auditTrail = {
                endorsements: contributingEndorsements.map(e => e.id),
                verifications: contributingVerifications,
                availability_events: recentChanges.map(a => a.id),
                fraud_flags: activeFlags.map(ff => ff.id),
                jobs: completedJobs.map(j => j.id),
                disputes: lostDisputes.map(d => d.id)
            };
            const breakdown = {
                jobs_completed: completedJobsFactor,
                on_time_rate: onTimeCompletionFactor,
                payment_integrity_factor: paymentIntegrityFactor,
                average_contractor_rating: averageContractorRatingFactor,
                endorsement_factor: endorsementFactor,
                verification_factor: verificationFactor,
                reliability_consistency_factor: reliabilityConsistencyFactor,
                dispute_outcome_factor: disputeOutcomeFactor,
                fraud_penalty: fraudPenalty,
                audit_trail: auditTrail
            };
            const nextVersion = (profile.trust_score_version || 0) + 1;
            // Update profile
            if (isWorker) {
                sqlite_1.db.prepare(`
          UPDATE worker_profiles 
          SET trust_score = ?, trust_score_updated_at = ?, trust_score_version = ?
          WHERE id = ?
        `).run(totalScore, new Date().toISOString(), nextVersion, workerId);
            }
            else {
                sqlite_1.db.prepare(`
          UPDATE contractor_profiles 
          SET trust_score = ?, trust_score_updated_at = ?, trust_score_version = ?
          WHERE id = ?
        `).run(totalScore, new Date().toISOString(), nextVersion, workerId);
            }
            // Insert history log
            sqlite_1.db.prepare(`
        INSERT INTO trust_score_history (id, worker_id, score, version, computed_by_agent_run_id, contributing_factors, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run((0, uuid_1.v4)(), workerId, totalScore, nextVersion, runId, JSON.stringify(breakdown), new Date().toISOString());
            // Write Agent Log
            const latency = Date.now() - startTime;
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'TRUST', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(runId, JSON.stringify({ workerId }), JSON.stringify({ score: totalScore, breakdown }), JSON.stringify([workerId]), latency, new Date().toISOString());
            console.log(`[TrustAgent] Finished. New score: ${totalScore}`);
            return totalScore;
        }
        catch (err) {
            console.error(`[TrustAgent] Error during calculation for worker ${workerId}:`, err);
            // Graceful log in agent run logs
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'TRUST', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(runId, JSON.stringify({ workerId }), JSON.stringify({ error: err.message }), Date.now() - startTime, new Date().toISOString());
            throw err;
        }
    }
}
exports.TrustAgent = TrustAgent;
exports.default = TrustAgent;
