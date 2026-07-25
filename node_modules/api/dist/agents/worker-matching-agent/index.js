"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerMatchingAgent = void 0;
const sqlite_1 = require("../../db/sqlite");
const uuid_1 = require("uuid");
class WorkerMatchingAgent {
    static async run(requestReferenceId, requestReferenceType, agentRunId) {
        const startTime = Date.now();
        const runId = agentRunId || (0, uuid_1.v4)();
        console.log(`[WorkerMatchingAgent] Running matching for ${requestReferenceType}: ${requestReferenceId}`);
        try {
            // 1. Fetch Requirement/Request
            let req;
            if (requestReferenceType === 'JOB_REQUIREMENT') {
                req = sqlite_1.db.prepare('SELECT * FROM job_requirements WHERE id = ?').get(requestReferenceId);
            }
            else {
                req = sqlite_1.db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestReferenceId);
            }
            if (!req) {
                throw new Error(`${requestReferenceType} not found: ${requestReferenceId}`);
            }
            const reqSkills = JSON.parse(req.extracted_skills);
            const reqLat = req.lat;
            const reqLng = req.lng;
            const reqRadius = req.radius_km || 15;
            const reqMinTrust = req.min_trust_score !== undefined ? req.min_trust_score : null;
            // 2. Bounding Box pre-filter calculation
            // 1 deg latitude ~ 111km
            const latChange = reqRadius / 111.0;
            const cosLat = Math.cos(reqLat * Math.PI / 180);
            const lngChange = reqRadius / (111.0 * (cosLat > 0.01 ? cosLat : 1.0));
            const latMin = reqLat - latChange;
            const latMax = reqLat + latChange;
            const lngMin = reqLng - lngChange;
            const lngMax = reqLng + lngChange;
            console.log(`[WorkerMatchingAgent] Bounding box: Lat [${latMin.toFixed(4)}, ${latMax.toFixed(4)}], Lng [${lngMin.toFixed(4)}, ${lngMax.toFixed(4)}]`);
            // 3. Query candidates using bounding box pre-filter AND availability
            const candidatesRaw = sqlite_1.db.prepare(`
        SELECT wp.id as worker_id, wp.skills, wp.current_lat, wp.current_lng, wp.trust_score, wp.verification_status, u.full_name
        FROM worker_profiles wp
        JOIN users u ON wp.user_id = u.id
        WHERE wp.availability_status = 'AVAILABLE'
          AND wp.current_lat BETWEEN ? AND ?
          AND wp.current_lng BETWEEN ? AND ?
      `).all(latMin, latMax, lngMin, lngMax);
            const matches = [];
            for (const row of candidatesRaw) {
                const workerSkills = JSON.parse(row.skills);
                // A. Skill Match Check
                const overlappingSkills = workerSkills.filter(s => reqSkills.includes(s.toLowerCase()));
                if (overlappingSkills.length === 0)
                    continue; // No matching skill
                // B. Fine-grained Geospatial Distance Calculation
                const distRow = sqlite_1.db.prepare('SELECT dist_km(?, ?, ?, ?) as distance').get(row.current_lat, row.current_lng, reqLat, reqLng);
                const distance = distRow?.distance ?? 999999;
                if (distance > reqRadius)
                    continue; // Outside circular radius
                // C. Trust Score Check
                const workerTrust = row.trust_score; // number or null
                let meetsTrust = true;
                if (reqMinTrust !== null) {
                    if (workerTrust === null || workerTrust < reqMinTrust) {
                        meetsTrust = false; // Excluded due to trust threshold
                    }
                }
                // If worker fails trust threshold, exclude them from active matches
                if (!meetsTrust)
                    continue;
                // D. Match Score Calculation (0-100)
                // 40 points: Proximity (higher points closer to job site)
                const proximityScore = Math.max(0, (1 - distance / reqRadius) * 40);
                // 40 points: Trust Score (if null, give a baseline of 20 points out of 40)
                const trustScoreWeight = workerTrust !== null ? (workerTrust / 100) * 40 : 20;
                // 20 points: Skill match
                const skillScoreWeight = 20;
                const matchScore = Math.round(proximityScore + trustScoreWeight + skillScoreWeight);
                matches.push({
                    worker_id: row.worker_id,
                    name: row.full_name,
                    skills: workerSkills,
                    distance_km: parseFloat(distance.toFixed(2)),
                    trust_score: workerTrust,
                    match_score: matchScore,
                    matched_fields: {
                        skills: true,
                        location: true,
                        trust_score: workerTrust !== null && (reqMinTrust === null || workerTrust >= reqMinTrust),
                        distance_km: parseFloat(distance.toFixed(2))
                    }
                });
            }
            // Sort by match score descending
            matches.sort((a, b) => b.match_score - a.match_score);
            // Write match candidate set to DB (Polymorphic)
            const candidateSetId = (0, uuid_1.v4)();
            sqlite_1.db.prepare(`
        INSERT INTO match_candidate_sets (id, request_reference_type, request_reference_id, generated_by_agent_run_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(candidateSetId, requestReferenceType, requestReferenceId, runId, new Date().toISOString());
            // Write individual candidates
            const insertCandidate = sqlite_1.db.prepare(`
        INSERT INTO match_candidates (id, match_candidate_set_id, worker_id, match_score, matched_fields, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            for (const m of matches) {
                insertCandidate.run((0, uuid_1.v4)(), candidateSetId, m.worker_id, m.match_score, JSON.stringify(m.matched_fields), new Date().toISOString());
            }
            const latency = Date.now() - startTime;
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'WORKER_MATCHING', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(runId, JSON.stringify({ requestReferenceId, candidatesFound: candidatesRaw.length }), JSON.stringify({ matchCandidateSetId: candidateSetId, candidatesCount: matches.length }), JSON.stringify([requestReferenceId, candidateSetId]), latency, new Date().toISOString());
            return candidateSetId;
        }
        catch (err) {
            console.error('[WorkerMatchingAgent] Error:', err);
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'WORKER_MATCHING', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(runId, JSON.stringify({ requestReferenceId }), JSON.stringify({ error: err.message }), Date.now() - startTime, new Date().toISOString());
            throw err;
        }
    }
}
exports.WorkerMatchingAgent = WorkerMatchingAgent;
exports.default = WorkerMatchingAgent;
