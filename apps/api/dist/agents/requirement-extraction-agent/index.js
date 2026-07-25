"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementExtractionAgent = void 0;
const sqlite_1 = require("../../db/sqlite");
const uuid_1 = require("uuid");
class RequirementExtractionAgent {
    static async run(rawText, agentRunId) {
        const startTime = Date.now();
        const runId = agentRunId || (0, uuid_1.v4)();
        console.log(`[RequirementExtractionAgent] Extracting requirements from: "${rawText}"`);
        try {
            const textLower = rawText.toLowerCase();
            // 1. Skill Extraction
            const skillsList = ['mason', 'electrician', 'plumber', 'driver', 'painter', 'carpenter', 'welder', 'helper', 'cook', 'domestic worker', 'plasterer', 'cleaner'];
            const extractedSkills = [];
            skillsList.forEach(s => {
                if (textLower.includes(s)) {
                    extractedSkills.push(s);
                }
            });
            if (extractedSkills.length === 0) {
                // Default to helper if nothing found
                extractedSkills.push('helper');
            }
            // 2. Location & Coordinate Extraction
            let lat = 28.6139; // Default Connaught Place
            let lng = 77.2090;
            let radius_km = 15; // Default radius
            if (textLower.includes('noida') || textLower.includes('sector 62')) {
                lat = 28.6282;
                lng = 77.3769;
            }
            else if (textLower.includes('dwarka')) {
                lat = 28.5921;
                lng = 77.0460;
            }
            else if (textLower.includes('gurugram') || textLower.includes('gurgaon')) {
                lat = 28.4595;
                lng = 77.0266;
            }
            else if (textLower.includes('mumbai')) {
                lat = 19.0760;
                lng = 72.8777;
            }
            // 3. Headcount Extraction
            let headcount = 1;
            const headcountMatch = textLower.match(/(\d+)\s+(worker|helper|mason|electrician|plumber|people|men|women)/);
            if (headcountMatch) {
                headcount = parseInt(headcountMatch[1]);
            }
            else {
                const wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5 };
                for (const [word, num] of Object.entries(wordNumbers)) {
                    if (textLower.includes(`need ${word}`) || textLower.includes(`want ${word}`) || textLower.includes(`${word} workers`)) {
                        headcount = num;
                        break;
                    }
                }
            }
            // 4. Min Trust Score Extraction
            let min_trust_score = null;
            const scoreMatch = textLower.match(/(score|trust|rating)\s+(?:above|greater than|min|minimum|of)?\s*(\d+)/);
            if (scoreMatch) {
                min_trust_score = parseInt(scoreMatch[2]);
                if (min_trust_score > 100)
                    min_trust_score = null;
            }
            // 5. Pay / Budget Extraction
            let pay_min = 400;
            let pay_max = 700;
            // Look for pay range e.g. "500 to 800" or "600-900" or "Rs. 700"
            const payRangeMatch = textLower.match(/(?:rs\.?|rupees|pay|salary|wage)?\s*(\d+)\s*(?:to|-)\s*(\d+)/);
            const singlePayMatch = textLower.match(/(?:pay|wage|salary|budget|rs\.?|rupees)\s*(?:of|is|about)?\s*(\d+)/);
            if (payRangeMatch) {
                pay_min = parseInt(payRangeMatch[1]);
                pay_max = parseInt(payRangeMatch[2]);
            }
            else if (singlePayMatch) {
                const basePay = parseInt(singlePayMatch[1]);
                pay_min = Math.round(basePay * 0.85);
                pay_max = Math.round(basePay * 1.15);
            }
            // 6. Urgency Window Extraction (Default to start now, end in 5 days)
            const now = new Date();
            let windowStart = now.toISOString();
            let durationDays = 5;
            if (textLower.includes('urgent') || textLower.includes('today') || textLower.includes('now')) {
                durationDays = 1;
            }
            else if (textLower.includes('tomorrow')) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(8, 0, 0, 0);
                windowStart = tomorrow.toISOString();
                durationDays = 2;
            }
            else if (textLower.includes('next week') || textLower.includes('this week')) {
                durationDays = 7;
            }
            const windowEnd = new Date(new Date(windowStart).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
            const extracted = {
                skills: extractedSkills,
                lat,
                lng,
                radius_km,
                headcount,
                min_trust_score,
                pay_min,
                pay_max,
                urgency_window_start: windowStart,
                urgency_window_end: windowEnd
            };
            const latency = Date.now() - startTime;
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'REQUIREMENT_EXTRACTION', '1.0.0', ?, ?, '[]', 'SUCCESS', ?, ?)
      `).run(runId, JSON.stringify({ rawText }), JSON.stringify(extracted), latency, new Date().toISOString());
            return extracted;
        }
        catch (err) {
            console.error('[RequirementExtractionAgent] Error:', err);
            sqlite_1.db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'REQUIREMENT_EXTRACTION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(runId, JSON.stringify({ rawText }), JSON.stringify({ error: err.message }), Date.now() - startTime, new Date().toISOString());
            throw err;
        }
    }
}
exports.RequirementExtractionAgent = RequirementExtractionAgent;
exports.default = RequirementExtractionAgent;
