"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_1 = require("./db/sqlite");
async function diagnose() {
    console.log('--- Database Diagnostic ---');
    // 1. Fetch user by phone
    const user = sqlite_1.db.prepare('SELECT * FROM users WHERE phone = ?').get('8000000001');
    console.log('User found:', user);
    if (user) {
        // 2. Fetch worker profile by user_id
        const wp = sqlite_1.db.prepare('SELECT id FROM worker_profiles WHERE user_id = ?').get(user.id);
        console.log('Worker profile found:', wp);
        // 3. Fetch full profile
        const profile = sqlite_1.db.prepare(`
      SELECT wp.*, u.full_name, u.phone, u.email
      FROM worker_profiles wp
      JOIN users u ON wp.user_id = u.id
      WHERE wp.id = ? OR wp.user_id = ?
    `).get(wp?.id, wp?.id);
        console.log('Full profile:', profile);
    }
    // 4. Bounding Box Query
    const latMin = 28.5238;
    const latMax = 28.7040;
    const lngMin = 77.1064;
    const lngMax = 77.3116;
    console.log('\nRunning candidates query...');
    const candidatesRaw = sqlite_1.db.prepare(`
    SELECT wp.id as worker_id, wp.skills, wp.current_lat, wp.current_lng, wp.trust_score, wp.verification_status, u.full_name
    FROM worker_profiles wp
    JOIN users u ON wp.user_id = u.id
    WHERE wp.availability_status = 'AVAILABLE'
      AND wp.current_lat BETWEEN ? AND ?
      AND wp.current_lng BETWEEN ? AND ?
  `).all(latMin, latMax, lngMin, lngMax);
    console.log('Raw candidates count:', candidatesRaw.length);
    const reqSkills = ['mason', 'plasterer'];
    const reqLat = 28.6139;
    const reqLng = 77.209;
    const reqRadius = 10;
    const reqMinTrust = 80;
    for (const row of candidatesRaw) {
        const workerSkills = JSON.parse(row.skills);
        console.log(`\nChecking worker: ${row.full_name} (${row.worker_id})`);
        console.log(`- Skills:`, workerSkills);
        console.log(`- Trust score:`, row.trust_score);
        console.log(`- Location: (${row.current_lat}, ${row.current_lng})`);
        const overlappingSkills = workerSkills.filter(s => reqSkills.includes(s.toLowerCase()));
        if (overlappingSkills.length === 0) {
            console.log(`- SKIPPED: Skill mismatch. Overlap with ${reqSkills}: 0`);
            continue;
        }
        const distRow = sqlite_1.db.prepare('SELECT dist_km(?, ?, ?, ?) as distance').get(row.current_lat, row.current_lng, reqLat, reqLng);
        const distance = distRow?.distance ?? 999999;
        console.log(`- Calculated distance: ${distance} km (Radius: ${reqRadius} km)`);
        if (distance > reqRadius) {
            console.log(`- SKIPPED: Outside radius (${distance} > ${reqRadius})`);
            continue;
        }
        const workerTrust = row.trust_score;
        let meetsTrust = true;
        if (reqMinTrust !== null) {
            if (workerTrust === null || workerTrust < reqMinTrust) {
                meetsTrust = false;
            }
        }
        if (!meetsTrust) {
            console.log(`- SKIPPED: Trust score too low (${workerTrust} < ${reqMinTrust})`);
            continue;
        }
        console.log(`- MATCHED successfully!`);
    }
}
diagnose();
