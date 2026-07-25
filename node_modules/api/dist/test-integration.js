"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_1 = require("./db/sqlite");
const migrate_1 = require("./db/migrate");
const voice_interaction_agent_1 = require("./agents/voice-interaction-agent");
const worker_matching_agent_1 = require("./agents/worker-matching-agent");
const trust_agent_1 = require("./agents/trust-agent");
const fraud_detection_agent_1 = require("./agents/fraud-detection-agent");
const uuid_1 = require("uuid");
async function runTests() {
    console.log('==================================================');
    console.log('      LABOURLINK INTEGRATION TEST SUITE           ');
    console.log('==================================================\n');
    // Ensure migrations are run
    console.log('[Test] Running migrations check...');
    (0, migrate_1.runMigrations)();
    console.log('[Test] Migrations check passed.\n');
    // Verify seed data is queryable
    console.log('[Test] Verifying dynamic seed counts...');
    const users = sqlite_1.db.prepare('SELECT id, role, full_name FROM users').all();
    const workers = sqlite_1.db.prepare('SELECT id, user_id, skills FROM worker_profiles').all();
    const requirements = sqlite_1.db.prepare('SELECT id, raw_text FROM job_requirements').all();
    console.log(`- Total Users in DB: ${users.length}`);
    console.log(`- Total Worker Profiles in DB: ${workers.length}`);
    console.log(`- Total Job Requirements in DB: ${requirements.length}`);
    if (users.length === 0 || workers.length === 0) {
        throw new Error('Database is empty. Please run "npm run db:seed" first.');
    }
    console.log('[Test] Seed data check passed.\n');
    // ----------------------------------------------------
    // TEST 1: Voice Fallback Slot & Intent Extraction
    // ----------------------------------------------------
    console.log('[Test 1] Testing Voice Fallback Pipeline...');
    const workerUser = users.find(u => u.role === 'WORKER');
    const incompleteCommandId = (0, uuid_1.v4)();
    // A. Insert an incomplete voice command transcript (missing skill & location)
    sqlite_1.db.prepare(`
    INSERT INTO voice_commands (id, user_id, raw_audio_ref, transcript, detected_language, intent, slots, confidence, status, routed_to_agent, agent_run_id, created_at)
    VALUES (?, ?, 'http://voice.labourlink.in/audio/test1.wav', 'Mujhe kaam chahiye jaldi', 'hi', 'UNKNOWN', '{}', '{}', 'RECEIVED', NULL, NULL, ?)
  `).run(incompleteCommandId, workerUser.id, new Date().toISOString());
    console.log('Running Voice Interaction Agent on incomplete command...');
    const resultIncomplete = await voice_interaction_agent_1.VoiceInteractionAgent.run(incompleteCommandId);
    console.log(`- Incomplete command result status: ${resultIncomplete.status}`);
    console.log(`- Confidence values:`, resultIncomplete.confidence);
    // Verify clarification prompt was created
    const clarificationPrompts = sqlite_1.db.prepare('SELECT * FROM voice_clarification_prompts WHERE voice_command_id = ?').all(incompleteCommandId);
    console.log(`- Created clarification prompts count: ${clarificationPrompts.length}`);
    if (clarificationPrompts.length > 0) {
        console.log(`- Incomplete Prompt Text: "${clarificationPrompts[0].prompt_text}"`);
    }
    if (resultIncomplete.status !== 'NEEDS_CLARIFICATION' || clarificationPrompts.length === 0) {
        throw new Error('Test 1A Failed: Incomplete voice command did not trigger needs-clarification state.');
    }
    // B. Complete Voice Command (Ramesh searching for Mason in Connaught Place)
    const completeCommandId = (0, uuid_1.v4)();
    sqlite_1.db.prepare(`
    INSERT INTO voice_commands (id, user_id, raw_audio_ref, transcript, detected_language, intent, slots, confidence, status, routed_to_agent, agent_run_id, created_at)
    VALUES (?, ?, 'http://voice.labourlink.in/audio/test2.wav', 'Mujhe Connaught Place mein plastering ya mason ka kaam chahiye', 'hi', 'UNKNOWN', '{}', '{}', 'RECEIVED', NULL, NULL, ?)
  `).run(completeCommandId, workerUser.id, new Date().toISOString());
    console.log('Running Voice Interaction Agent on complete command...');
    const resultComplete = await voice_interaction_agent_1.VoiceInteractionAgent.run(completeCommandId);
    console.log(`- Complete command result status: ${resultComplete.status}`);
    console.log(`- Extracted slots:`, resultComplete.slots);
    console.log(`- Confidence values:`, resultComplete.confidence);
    if (resultComplete.status !== 'ROUTED_TO_AGENT' || resultComplete.routed_to !== 'WORKER_MATCHING') {
        throw new Error('Test 1B Failed: Complete voice command did not resolve to WORKER_MATCHING.');
    }
    console.log('[Test 1] Passed!\n');
    // ----------------------------------------------------
    // TEST 2: Worker Matching with Bounding Box SQL Pre-Filter
    // ----------------------------------------------------
    console.log('[Test 2] Testing Geospatial Bounding-Box Pre-Filtering...');
    const firstReq = requirements[0];
    console.log(`Executing Worker Matching for Requirement ID: ${firstReq.id}`);
    console.log(`Requirement Raw Text: "${firstReq.raw_text}"`);
    const matchCandidateSetId = await worker_matching_agent_1.WorkerMatchingAgent.run(firstReq.id, 'JOB_REQUIREMENT');
    console.log(`- Generated Match Candidate Set ID: ${matchCandidateSetId}`);
    // Fetch candidates from DB
    const candidates = sqlite_1.db.prepare(`
    SELECT mc.*, wp.current_lat, wp.current_lng, u.full_name
    FROM match_candidates mc
    JOIN worker_profiles wp ON mc.worker_id = wp.id
    JOIN users u ON wp.user_id = u.id
    WHERE mc.match_candidate_set_id = ?
  `).all(matchCandidateSetId);
    console.log(`- Matched Candidate Count: ${candidates.length}`);
    candidates.forEach((c, idx) => {
        console.log(`  [Rank ${idx + 1}] ${c.full_name} - Match Score: ${c.match_score} (Lat: ${c.current_lat}, Lng: ${c.current_lng})`);
    });
    if (candidates.length === 0) {
        throw new Error('Test 2 Failed: Matching returned 0 candidates.');
    }
    console.log('[Test 2] Passed!\n');
    // ----------------------------------------------------
    // TEST 3: Trust Score Calculation Trigger
    // ----------------------------------------------------
    console.log('[Test 3] Testing Trust Agent Scoring...');
    const testWorker = workers[0];
    console.log(`Computing Trust Score for Worker ID: ${testWorker.id}`);
    const trustResultScore = await trust_agent_1.TrustAgent.run(testWorker.id);
    console.log(`- Calculated trust score: ${trustResultScore}`);
    // Fetch score from DB to confirm persistence
    const profileAfter = sqlite_1.db.prepare('SELECT trust_score, trust_score_version FROM worker_profiles WHERE id = ?').get(testWorker.id);
    console.log(`- Persisted score in DB profile: ${profileAfter.trust_score} (Version: ${profileAfter.trust_score_version})`);
    if (profileAfter.trust_score === null || profileAfter.trust_score !== trustResultScore) {
        throw new Error('Test 3 Failed: Trust score was not successfully computed or saved.');
    }
    // Retrieve factors from DB history row
    const latestHistory = sqlite_1.db.prepare('SELECT score, contributing_factors FROM trust_score_history WHERE worker_id = ? ORDER BY version DESC LIMIT 1').get(testWorker.id);
    if (latestHistory) {
        console.log(`- Logged factors:`, JSON.parse(latestHistory.contributing_factors));
    }
    console.log('[Test 3] Passed!\n');
    // ----------------------------------------------------
    // TEST 4: Fraud Detection Rules (Location Conflict, Rating Collusion)
    // ----------------------------------------------------
    console.log('[Test 4] Testing Fraud Detection Agent...');
    console.log('Running fraud scan across the database...');
    const flagsDetectedCount = await fraud_detection_agent_1.FraudDetectionAgent.run();
    console.log(`- Detected fraud alerts count: ${flagsDetectedCount}`);
    const activeFlags = sqlite_1.db.prepare("SELECT * FROM fraud_flags WHERE status = 'OPEN'").all();
    console.log(`- Persisted active fraud flags queue length: ${activeFlags.length}`);
    activeFlags.forEach((flag, idx) => {
        const evidence = JSON.parse(flag.evidence);
        console.log(`  [Alert ${idx + 1}] Subject: ${flag.subject_id} - Type: ${flag.flag_type} (${flag.severity})`);
        console.log(`    Evidence: "${evidence.reason || 'No description'}"`);
    });
    if (activeFlags.length === 0) {
        throw new Error('Test 4 Failed: No fraud flags were detected or retrieved.');
    }
    console.log('[Test 4] Passed!\n');
    console.log('==================================================');
    console.log('      ALL INTEGRATION TESTS PASSED SUCCESSFULLY!  ');
    console.log('==================================================');
}
runTests().catch(err => {
    console.error('\n[Test Suite Error] Integration test execution failed:');
    console.error(err);
    process.exit(1);
});
