"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.MockDatabase = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = require("crypto");
// Find the database path robustly by traversing upward to locate the database folder
function getDbPath() {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        const checkDir = path_1.default.join(dir, 'database');
        if (fs_1.default.existsSync(checkDir)) {
            return path_1.default.join(checkDir, 'labourlink_db.json');
        }
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const checkDir = path_1.default.join(dir, 'database');
        if (fs_1.default.existsSync(checkDir)) {
            return path_1.default.join(checkDir, 'labourlink_db.json');
        }
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return path_1.default.join(__dirname, '../../../../database/labourlink_db.json');
}
const dbPath = getDbPath();
const dbDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
const defaultState = {
    users: [],
    worker_profiles: [],
    contractor_profiles: [],
    customer_profiles: [],
    verification_records: [],
    job_requirements: [],
    service_requests: [],
    jobs: [],
    bookings: [],
    payments: [],
    ratings: [],
    endorsements: [],
    trust_score_history: [],
    fraud_flags: [],
    agent_run_logs: [],
    match_candidate_sets: [],
    match_candidates: [],
    recommendations: [],
    voice_commands: [],
    voice_clarification_prompts: [],
    auth_sessions: [],
    notifications: [],
    disputes: [],
    availability_log: [],
    consent_records: [],
    admin_actions: [],
    skills_taxonomy: [],
    assignments: [],
    engagements: [],
    price_offers: []
};
let data = { ...defaultState };
function loadDb() {
    if (fs_1.default.existsSync(dbPath)) {
        try {
            data = JSON.parse(fs_1.default.readFileSync(dbPath, 'utf8'));
            // Ensure all tables exist
            for (const key of Object.keys(defaultState)) {
                if (!data[key]) {
                    data[key] = [];
                }
            }
        }
        catch (e) {
            console.error('Failed to load database. Initializing empty.', e);
            data = { ...defaultState };
        }
    }
    else {
        data = { ...defaultState };
        saveDb();
    }
}
function saveDb() {
    fs_1.default.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}
loadDb();
// Custom helper: Haversine distance in Javascript
function dist_km(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
class MockDatabase {
    serialize(fn) {
        fn();
    }
    pragma(cmd) {
        // No-op
    }
    function(name, fn) {
        // No-op - we handle dist_km in code
    }
    prepare(sql) {
        return new MockStatement(sql);
    }
    run(sql, params = []) {
        return new MockStatement(sql).run(...params);
    }
    getDbPath() {
        return dbPath;
    }
    reload() {
        loadDb();
    }
    save() {
        saveDb();
    }
}
exports.MockDatabase = MockDatabase;
class MockStatement {
    sql;
    constructor(sql) {
        this.sql = sql.trim().replace(/\s+/g, ' ');
    }
    run(...params) {
        loadDb();
        // 1. DELETE
        if (this.sql.match(/^DELETE FROM (\w+)/i)) {
            const match = this.sql.match(/^DELETE FROM (\w+)/i);
            const tableName = match[1].toLowerCase();
            // If there is a WHERE clause, e.g., DELETE FROM recommendations WHERE job_requirement_id = ?
            if (this.sql.includes(' WHERE ')) {
                const whereField = this.sql.split(' WHERE ')[1].split('=')[0].trim();
                const val = params[0];
                data[tableName] = data[tableName].filter(row => row[whereField] !== val);
            }
            else {
                data[tableName] = [];
            }
            saveDb();
            return { changes: 1, lastInsertRowid: 0 };
        }
        // 2. INSERT
        if (this.sql.match(/^INSERT INTO (\w+)/i)) {
            const match = this.sql.match(/^INSERT INTO (\w+)/i);
            const tableName = match[1].toLowerCase();
            // Extract columns inside ( ... )
            const colsPart = this.sql.substring(this.sql.indexOf('(') + 1, this.sql.indexOf(')'));
            const columns = colsPart.split(',').map(s => s.trim());
            // Extract values part and parse individual expressions
            const valuesPart = this.sql.substring(this.sql.toUpperCase().indexOf('VALUES') + 6).trim();
            const valParenthesesContent = valuesPart.substring(valuesPart.indexOf('(') + 1, valuesPart.lastIndexOf(')'));
            const valueExpressions = [];
            let currentExpr = '';
            let insideQuote = false;
            let quoteChar = '';
            for (let i = 0; i < valParenthesesContent.length; i++) {
                const char = valParenthesesContent[i];
                if ((char === "'" || char === '"') && valParenthesesContent[i - 1] !== '\\') {
                    if (insideQuote && char === quoteChar) {
                        insideQuote = false;
                    }
                    else if (!insideQuote) {
                        insideQuote = true;
                        quoteChar = char;
                    }
                }
                if (char === ',' && !insideQuote) {
                    valueExpressions.push(currentExpr.trim());
                    currentExpr = '';
                }
                else {
                    currentExpr += char;
                }
            }
            if (currentExpr.trim()) {
                valueExpressions.push(currentExpr.trim());
            }
            let paramIdx = 0;
            const newRow = {};
            columns.forEach((col, idx) => {
                const expr = valueExpressions[idx] || '?';
                if (expr === '?') {
                    newRow[col] = params[paramIdx++];
                }
                else if (expr.toUpperCase() === 'NULL') {
                    newRow[col] = null;
                }
                else if (expr.startsWith("'") && expr.endsWith("'")) {
                    newRow[col] = expr.slice(1, -1);
                }
                else if (expr.startsWith('"') && expr.endsWith('"')) {
                    newRow[col] = expr.slice(1, -1);
                }
                else if (!isNaN(Number(expr))) {
                    newRow[col] = Number(expr);
                }
                else {
                    newRow[col] = expr;
                }
            });
            // Keep user id, or generate UUID if missing
            const id = newRow.id || (columns[0] === 'id' ? params[0] : (0, crypto_1.randomUUID)());
            if (!newRow.id && columns[0] === 'id') {
                newRow.id = id;
            }
            data[tableName].push(newRow);
            saveDb();
            return { changes: 1, lastInsertRowid: id };
        }
        // 3. UPDATE
        if (this.sql.match(/^UPDATE (\w+)/i)) {
            const match = this.sql.match(/^UPDATE (\w+)/i);
            const tableName = match[1].toLowerCase();
            // Extract set items
            // UPDATE worker_profiles SET trust_score = ?, trust_score_updated_at = ?, trust_score_version = ? WHERE id = ?
            const setPart = this.sql.substring(this.sql.toUpperCase().indexOf('SET ') + 4, this.sql.toUpperCase().indexOf(' WHERE'));
            const setAssignments = setPart.split(',').map(s => s.trim().split('=')[0].trim());
            const wherePart = this.sql.substring(this.sql.toUpperCase().indexOf(' WHERE ') + 7).trim();
            // We parse a list of WHERE conditions. Let's assume standard 'id = ?' or 'worker_id = ? AND missing_field = ?'
            const matchesWhere = (row, bindParams, startIndex) => {
                if (wherePart.includes(' AND ')) {
                    const parts = wherePart.split(' AND ');
                    // e.g. "voice_command_id = ? AND missing_field = ?"
                    const f1 = parts[0].split('=')[0].trim();
                    const f2 = parts[1].split('=')[0].trim();
                    return row[f1] === bindParams[startIndex] && row[f2] === bindParams[startIndex + 1];
                }
                else {
                    // e.g. "id = ?" or "user_id = ?"
                    const field = wherePart.split('=')[0].trim();
                    return row[field] === bindParams[startIndex];
                }
            };
            // Calculate where parameter start index
            const setLength = setAssignments.length;
            const whereParams = params.slice(setLength);
            let updatedCount = 0;
            data[tableName] = data[tableName].map(row => {
                if (matchesWhere(row, params, setLength)) {
                    updatedCount++;
                    const updatedRow = { ...row };
                    setAssignments.forEach((field, idx) => {
                        let val = params[idx];
                        // Support incremental updates e.g. "trust_score_version = trust_score_version + 1"
                        const origSqlFieldAssignment = setPart.split(',')[idx].trim();
                        if (origSqlFieldAssignment.includes('+ 1')) {
                            updatedRow[field] = (row[field] || 0) + 1;
                        }
                        else {
                            updatedRow[field] = val;
                        }
                    });
                    return updatedRow;
                }
                return row;
            });
            saveDb();
            return { changes: updatedCount, lastInsertRowid: 0 };
        }
        return { changes: 0, lastInsertRowid: 0 };
    }
    get(...params) {
        loadDb();
        const sqlLower = this.sql.toLowerCase();
        if (sqlLower.startsWith('select count(*)')) {
            const match = this.sql.match(/from\s+(\w+)/i);
            if (match) {
                const tableName = match[1].toLowerCase();
                if (data[tableName]) {
                    return { count: data[tableName].length };
                }
            }
        }
        // Route JOINs and subqueries to all() fallback first
        if (sqlLower.includes('join') || sqlLower.includes('select user_id from worker_profiles')) {
            const allRows = this.all(...params);
            return allRows.length > 0 ? allRows[0] : null;
        }
        // 1. SELECT * FROM users WHERE phone = ?
        if (sqlLower.includes('from users') && sqlLower.includes('phone =')) {
            return data.users.find(u => u.phone === params[0]) || null;
        }
        // 2. SELECT * FROM users WHERE id = ?
        if (sqlLower.includes('from users') && sqlLower.includes('id =')) {
            return data.users.find(u => u.id === params[0]) || null;
        }
        // 2.5 SELECT * FROM users WHERE email = ? or email = '...'
        if (sqlLower.includes('from users') && sqlLower.includes('email =')) {
            let email = params[0];
            if (!email) {
                const match = this.sql.match(/email\s*=\s*'([^']+)'/i);
                if (match)
                    email = match[1];
            }
            return data.users.find(u => u.email === email) || null;
        }
        // 3. SELECT id FROM users WHERE phone = ?
        if (sqlLower.includes('select id from users') && sqlLower.includes('phone =')) {
            const u = data.users.find(u => u.phone === params[0]);
            return u ? { id: u.id } : null;
        }
        // 5. SELECT id, trust_score, trust_score_updated_at, trust_score_version FROM worker_profiles WHERE id = ? OR user_id = ?
        if (sqlLower.includes('select id, trust_score, trust_score_updated_at') && sqlLower.includes('from worker_profiles')) {
            const id = params[0];
            const wp = data.worker_profiles.find(w => w.id === id || w.user_id === id);
            return wp ? {
                id: wp.id,
                trust_score: wp.trust_score,
                trust_score_updated_at: wp.trust_score_updated_at,
                trust_score_version: wp.trust_score_version
            } : null;
        }
        // 6. SELECT contributing_factors FROM trust_score_history WHERE worker_id = ? ORDER BY version DESC LIMIT 1
        if (sqlLower.includes('from trust_score_history') && sqlLower.includes('order by version desc')) {
            const list = data.trust_score_history.filter(h => h.worker_id === params[0]);
            if (list.length === 0)
                return null;
            list.sort((a, b) => b.version - a.version);
            return list[0];
        }
        // 7. SELECT * FROM job_requirements WHERE id = ?
        if (sqlLower.includes('from job_requirements') && sqlLower.includes('id =')) {
            return data.job_requirements.find(r => r.id === params[0]) || null;
        }
        // 8. SELECT * FROM voice_commands WHERE id = ?
        if (sqlLower.includes('from voice_commands') && sqlLower.includes('id =')) {
            return data.voice_commands.find(c => c.id === params[0]) || null;
        }
        // 9. SELECT * FROM disputes WHERE id = ?
        if (sqlLower.includes('from disputes') && sqlLower.includes('id =')) {
            return data.disputes.find(d => d.id === params[0]) || null;
        }
        // 10. SELECT worker_id FROM jobs WHERE id = ?
        if (sqlLower.includes('select worker_id from jobs') && sqlLower.includes('id =')) {
            const j = data.jobs.find(x => x.id === params[0]);
            return j ? { worker_id: j.worker_id } : null;
        }
        // 11. SELECT count(id) as cnt FROM availability_log WHERE worker_id = ?
        if (sqlLower.includes('select count(id) as cnt') && sqlLower.includes('from availability_log')) {
            const cnt = data.availability_log.filter(x => x.worker_id === params[0]).length;
            return { cnt };
        }
        // 12. SELECT count(id) as cnt FROM endorsements WHERE worker_id = ?
        if (sqlLower.includes('select count(id) as cnt') && sqlLower.includes('from endorsements')) {
            const cnt = data.endorsements.filter(x => x.worker_id === params[0]).length;
            return { cnt };
        }
        // 13. SELECT count(id) as cnt FROM disputes WHERE job_id = ?
        if (sqlLower.includes('select count(id) as cnt') && sqlLower.includes('from disputes')) {
            const cnt = data.disputes.filter(x => x.job_id === params[0]).length;
            return { cnt };
        }
        // 14. SELECT count(id) as cnt FROM fraud_flags WHERE status = 'OPEN'
        if (sqlLower.includes('select count(id) as cnt') && sqlLower.includes("status = 'open'")) {
            const cnt = data.fraud_flags.filter(x => x.status === 'OPEN').length;
            return { cnt };
        }
        // 15. SELECT dist_km
        if (sqlLower.includes('select dist_km')) {
            const dist = dist_km(params[0], params[1], params[2], params[3]);
            return { distance: dist };
        }
        // Fallback: execute all logic on array and return first row
        const allRows = this.all(...params);
        return allRows.length > 0 ? allRows[0] : null;
    }
    all(...params) {
        loadDb();
        const sqlLower = this.sql.toLowerCase();
        // Custom JOIN queries & complex subqueries used in Trust and Fraud agents
        // JOIN 0: SELECT * FROM worker_profiles JOIN users
        if (sqlLower.includes('from worker_profiles wp join users u') && (sqlLower.includes('wp.id = ?') || sqlLower.includes('wp.user_id = ?'))) {
            const id = params[0];
            const wp = data.worker_profiles.find(w => w.id === id || w.user_id === id);
            if (!wp)
                return [];
            const u = data.users.find(usr => usr.id === wp.user_id);
            return [{
                    ...wp,
                    full_name: u?.full_name || '',
                    phone: u?.phone || '',
                    email: u?.email || ''
                }];
        }
        // JOIN 0.1: SELECT * FROM customer_profiles JOIN users (NEW)
        if (sqlLower.includes('from customer_profiles cp join users u') && (sqlLower.includes('cp.id = ?') || sqlLower.includes('cp.user_id = ?'))) {
            const id = params[0];
            const cp = data.customer_profiles.find(c => c.id === id || c.user_id === id);
            if (!cp)
                return [];
            const u = data.users.find(usr => usr.id === cp.user_id);
            return [{
                    ...cp,
                    full_name: u?.full_name || '',
                    phone: u?.phone || '',
                    email: u?.email || ''
                }];
        }
        // JOIN 1: SELECT p.id FROM payments p JOIN jobs j ON p.job_id = j.id WHERE j.worker_id = ? AND p.status = 'CONFIRMED'
        if (sqlLower.includes('from payments p') && sqlLower.includes('worker_id = ?') && sqlLower.includes("status = 'confirmed'")) {
            const workerId = params[0];
            const results = data.payments.filter(p => {
                if (p.status !== 'CONFIRMED')
                    return false;
                if (p.job_reference_type === 'CONTRACTOR_JOB') {
                    const job = data.jobs.find(j => j.id === p.job_reference_id);
                    return job && job.worker_id === workerId;
                }
                else {
                    const booking = data.bookings.find(b => b.id === p.job_reference_id);
                    return booking && booking.worker_id === workerId;
                }
            });
            return results.map(p => ({ id: p.id }));
        }
        // JOIN 2: SELECT p.status FROM payments p JOIN jobs j ON p.job_id = j.id WHERE j.worker_id = ?
        if (sqlLower.includes('from payments p') && sqlLower.includes('worker_id = ?') && !sqlLower.includes('status =')) {
            const workerId = params[0];
            const results = data.payments.filter(p => {
                if (p.job_reference_type === 'CONTRACTOR_JOB') {
                    const job = data.jobs.find(j => j.id === p.job_reference_id);
                    return job && job.worker_id === workerId;
                }
                else {
                    const booking = data.bookings.find(b => b.id === p.job_reference_id);
                    return booking && booking.worker_id === workerId;
                }
            });
            return results.map(p => ({ status: p.status }));
        }
        // JOIN 3: SELECT score FROM ratings WHERE ratee_id = (SELECT user_id FROM worker_profiles WHERE id = ?)
        if (sqlLower.includes('from ratings') && sqlLower.includes('ratee_id = (select user_id from worker_profiles')) {
            const workerProfileId = params[0];
            const wp = data.worker_profiles.find(w => w.id === workerProfileId);
            if (!wp)
                return [];
            const workerUserId = wp.user_id;
            return data.ratings
                .filter(r => r.ratee_id === workerUserId || r.ratee_id === workerProfileId)
                .map(r => ({ score: r.score }));
        }
        // JOIN 4: SELECT COUNT(id) as cnt FROM disputes d JOIN jobs j ON d.job_id = j.id WHERE j.worker_id = ? AND d.status = 'RESOLVED_CONTRACTOR'
        if (sqlLower.includes('from disputes d') && sqlLower.includes('worker_id = ?') && sqlLower.includes("status = 'resolved_contractor'")) {
            const workerId = params[0];
            const cnt = data.disputes.filter(d => {
                if (d.status !== 'RESOLVED_CONTRACTOR')
                    return false;
                if (d.job_reference_type === 'CONTRACTOR_JOB') {
                    const job = data.jobs.find(j => j.id === d.job_reference_id);
                    return job && job.worker_id === workerId;
                }
                else {
                    const booking = data.bookings.find(b => b.id === d.job_reference_id);
                    return booking && booking.worker_id === workerId;
                }
            }).length;
            return [{ cnt }];
        }
        // JOIN 5: Location Conflict Self-Join (Location Conflict Rule) - Unified jobs & bookings
        if (sqlLower.includes('from jobs j1 join jobs j2') || sqlLower.includes('locationconflict') || sqlLower.includes('geographically separated')) {
            const results = [];
            const events = [];
            data.jobs.forEach(j => {
                if (['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(j.status) && j.scheduled_start && j.scheduled_end) {
                    events.push({
                        id: j.id,
                        type: 'JOB',
                        worker_id: j.worker_id,
                        start: new Date(j.scheduled_start).getTime(),
                        end: new Date(j.scheduled_end).getTime(),
                        lat: j.lat || 0,
                        lng: j.lng || 0
                    });
                }
            });
            data.bookings.forEach(b => {
                if (['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) && b.scheduled_start && b.scheduled_end) {
                    events.push({
                        id: b.id,
                        type: 'BOOKING',
                        worker_id: b.worker_id,
                        start: new Date(b.scheduled_start).getTime(),
                        end: new Date(b.scheduled_end).getTime(),
                        lat: b.lat || 0,
                        lng: b.lng || 0
                    });
                }
            });
            for (let i = 0; i < events.length; i++) {
                for (let j = i + 1; j < events.length; j++) {
                    const e1 = events[i];
                    const e2 = events[j];
                    if (e1.worker_id === e2.worker_id && e1.id !== e2.id) {
                        if (e1.start <= e2.end && e1.end >= e2.start) {
                            const wp = data.worker_profiles.find(w => w.id === e1.worker_id);
                            const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                            results.push({
                                worker_id: e1.worker_id,
                                job1_id: e1.id,
                                job2_id: e2.id,
                                lat1: e1.lat,
                                lng1: e1.lng,
                                lat2: e2.lat,
                                lng2: e2.lng,
                                full_name: u?.full_name || 'Worker'
                            });
                        }
                    }
                }
            }
            return results;
        }
        // JOIN 6: Rating Collusion Grouping (Seeded & Customers)
        if (sqlLower.includes('from ratings r1') && sqlLower.includes('having cnt >= 3')) {
            const counts = new Map();
            const matches = [];
            data.ratings.forEach(r => {
                if (r.score === 5.0) {
                    const contractor = data.contractor_profiles.find(c => c.user_id === r.rater_id || c.id === r.rater_id);
                    const customer = data.customer_profiles.find(c => c.user_id === r.rater_id || c.id === r.rater_id);
                    const worker = data.worker_profiles.find(w => w.user_id === r.ratee_id || w.id === r.ratee_id);
                    if ((contractor || customer) && worker) {
                        const raterId = contractor ? contractor.id : customer.id;
                        const key = `${raterId}_${worker.id}`;
                        counts.set(key, (counts.get(key) || 0) + 1);
                    }
                }
            });
            counts.forEach((cnt, key) => {
                if (cnt >= 3) {
                    const [raterId, workerId] = key.split('_');
                    const cp = data.contractor_profiles.find(c => c.id === raterId) || data.customer_profiles.find(c => c.id === raterId);
                    const wp = data.worker_profiles.find(w => w.id === workerId);
                    matches.push({
                        contractor_user_id: cp?.user_id,
                        worker_user_id: wp?.user_id,
                        cnt,
                        contractor_id: raterId,
                        worker_id: workerId
                    });
                }
            });
            return matches;
        }
        // JOIN 7: Payment Mismatch
        if ((sqlLower.includes('from payments p') && sqlLower.includes('jr.pay_min')) || sqlLower.includes('payment_mismatch')) {
            const results = [];
            data.payments.forEach(p => {
                const refId = p.job_reference_id;
                const refType = p.job_reference_type;
                if (refType === 'CONTRACTOR_JOB') {
                    const job = data.jobs.find(j => j.id === refId);
                    if (job) {
                        const jr = data.job_requirements.find(r => r.id === job.job_requirement_id);
                        if (jr && (p.amount < jr.pay_min || p.amount > jr.pay_max)) {
                            results.push({
                                payment_id: p.id,
                                amount: p.amount,
                                job_id: job.id,
                                pay_min: jr.pay_min,
                                pay_max: jr.pay_max,
                                worker_id: job.worker_id
                            });
                        }
                    }
                }
                else if (refType === 'CUSTOMER_BOOKING') {
                    const booking = data.bookings.find(b => b.id === refId);
                    if (booking) {
                        const sr = data.service_requests.find(r => r.id === booking.service_request_id);
                        if (sr && ((sr.budget_min && p.amount < sr.budget_min) || (sr.budget_max && p.amount > sr.budget_max))) {
                            results.push({
                                payment_id: p.id,
                                amount: p.amount,
                                job_id: booking.id,
                                pay_min: sr.budget_min || 0,
                                pay_max: sr.budget_max || 99999,
                                worker_id: booking.worker_id
                            });
                        }
                    }
                }
            });
            return results;
        }
        // JOIN 8: Identity Farming Device Reuse
        if (sqlLower.includes('from auth_sessions s1 join auth_sessions s2') && sqlLower.includes('s1.device_fingerprint = s2.device_fingerprint')) {
            const results = [];
            data.auth_sessions.forEach(s1 => {
                data.auth_sessions.forEach(s2 => {
                    if (s1.device_fingerprint && s1.device_fingerprint === s2.device_fingerprint && s1.user_id < s2.user_id) {
                        const wp1 = data.worker_profiles.find(w => w.user_id === s1.user_id);
                        const wp2 = data.worker_profiles.find(w => w.user_id === s2.user_id);
                        if (wp1 && wp2) {
                            results.push({
                                user1: s1.user_id,
                                user2: s2.user_id,
                                device_fingerprint: s1.device_fingerprint,
                                worker1_id: wp1.id,
                                worker2_id: wp2.id
                            });
                        }
                    }
                });
            });
            return results;
        }
        // 1. SELECT * FROM worker_profiles WHERE availability_status = 'AVAILABLE' AND current_lat BETWEEN ? AND ?
        // Geofencing bounding box pre-filter query!
        if (sqlLower.includes('from worker_profiles wp join users u') && sqlLower.includes('wp.current_lat between')) {
            const latMin = params[0];
            const latMax = params[1];
            const lngMin = params[2];
            const lngMax = params[3];
            const matched = [];
            data.worker_profiles.forEach(wp => {
                if (wp.availability_status === 'AVAILABLE' &&
                    wp.current_lat >= latMin && wp.current_lat <= latMax &&
                    wp.current_lng >= lngMin && wp.current_lng <= lngMax) {
                    const u = data.users.find(usr => usr.id === wp.user_id);
                    matched.push({
                        worker_id: wp.id,
                        skills: wp.skills,
                        current_lat: wp.current_lat,
                        current_lng: wp.current_lng,
                        trust_score: wp.trust_score,
                        verification_status: wp.verification_status,
                        full_name: u?.full_name || ''
                    });
                }
            });
            return matched;
        }
        // 2. Recommendations JOIN worker_profiles JOIN users (Polymorphic)
        if (sqlLower.includes('from recommendations r') && (sqlLower.includes('where r.job_requirement_id = ?') || sqlLower.includes('r.request_reference_id = ?'))) {
            const reqId = params[0];
            const list = data.recommendations.filter(r => r.request_reference_id === reqId || r.job_requirement_id === reqId);
            const results = list.map(r => {
                const wp = data.worker_profiles.find(w => w.id === r.worker_id);
                const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                return {
                    ...r,
                    trust_score: wp?.trust_score ?? null,
                    verification_status: wp?.verification_status ?? 'UNVERIFIED',
                    full_name: u?.full_name ?? 'Unknown',
                    skills: wp?.skills ?? '[]',
                    current_lat: wp?.current_lat ?? 0,
                    current_lng: wp?.current_lng ?? 0
                };
            });
            // Sort by rank ASC
            results.sort((a, b) => a.rank - b.rank);
            return results;
        }
        // 3. Verification records by worker ID
        if (sqlLower.includes('from verification_records') && sqlLower.includes('worker_id = ?')) {
            return data.verification_records.filter(r => r.worker_id === params[0]);
        }
        // 4. Trust score history by worker ID
        if (sqlLower.includes('from trust_score_history') && sqlLower.includes('worker_id = ?')) {
            const list = data.trust_score_history.filter(h => h.worker_id === params[0]);
            list.sort((a, b) => a.version - b.version);
            return list;
        }
        // 5. Jobs by worker/contractor filters
        if (sqlLower.includes('from jobs j') && sqlLower.includes('left join payments p')) {
            const filterUserId = params[0];
            let list = data.jobs;
            if (filterUserId) {
                list = data.jobs.filter(j => {
                    if (sqlLower.includes('j.id = ?') || sqlLower.includes('j.id =')) {
                        return j.id === filterUserId;
                    }
                    else if (sqlLower.includes('wp.id = ?')) {
                        // Worker profile match
                        return j.worker_id === filterUserId || j.worker_id === data.worker_profiles.find(w => w.user_id === filterUserId)?.id;
                    }
                    else if (sqlLower.includes('c.id = ?')) {
                        // Contractor match
                        return j.contractor_id === filterUserId || j.contractor_id === data.contractor_profiles.find(c => c.user_id === filterUserId)?.id;
                    }
                    return false;
                });
            }
            const results = list.map(j => {
                const wp = data.worker_profiles.find(w => w.id === j.worker_id);
                const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                const cp = data.contractor_profiles.find(c => c.id === j.contractor_id);
                const jr = data.job_requirements.find(r => r.id === j.job_requirement_id);
                const p = data.payments.find(pm => pm.job_id === j.id);
                return {
                    ...j,
                    worker_name: u?.full_name || 'Worker',
                    contractor_company: cp?.company_name || 'Company',
                    requirement_text: jr?.raw_text || 'Job Requirement',
                    payment_amount: p?.amount || null,
                    payment_status: p?.status || null
                };
            });
            // Sort by created_at DESC
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 6. Disputes
        if (sqlLower.includes('from disputes d')) {
            const results = data.disputes.map(d => {
                const j = data.jobs.find(x => x.id === d.job_id);
                const u = data.users.find(x => x.id === d.raised_by);
                return {
                    ...d,
                    job_status: j?.status || 'UNKNOWN',
                    raised_by_name: u?.full_name || 'User'
                };
            });
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 7. Fraud Flags
        if (sqlLower.includes('from fraud_flags ff')) {
            let list = data.fraud_flags;
            const statusParam = params[0];
            if (statusParam) {
                list = data.fraud_flags.filter(f => f.status === statusParam);
            }
            const results = list.map(f => {
                const wp = data.worker_profiles.find(w => w.id === f.subject_id);
                const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                return {
                    ...f,
                    subject_name: u?.full_name || 'Worker Profile'
                };
            });
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 8. Admin Actions
        if (sqlLower.includes('from admin_actions aa')) {
            const results = data.admin_actions.map(aa => {
                const u = data.users.find(x => x.id === aa.admin_id);
                return {
                    ...aa,
                    admin_name: u?.full_name || 'Admin'
                };
            });
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 9. Auth Sessions
        if (sqlLower.includes('from auth_sessions s')) {
            const filterUserId = params[0];
            let list = data.auth_sessions;
            if (filterUserId) {
                list = data.auth_sessions.filter(s => s.user_id === filterUserId);
            }
            const results = list.map(s => {
                const u = data.users.find(usr => usr.id === s.user_id);
                return {
                    ...s,
                    full_name: u?.full_name || 'User',
                    role: u?.role || 'WORKER'
                };
            });
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 10. Agent runs
        if (sqlLower.includes('from agent_run_logs')) {
            // Return logs
            let list = data.agent_run_logs;
            // We parse filters for agent_name and status if present
            // SELECT * FROM agent_run_logs WHERE agent_name = ? AND status = ?
            if (sqlLower.includes('where')) {
                // Simple filter based on parameter binds
                const agentNameIndex = this.sql.includes('agent_name = ?') ? 0 : -1;
                const statusIndex = this.sql.includes('status = ?') ? (agentNameIndex === 0 ? 1 : 0) : -1;
                list = data.agent_run_logs.filter(log => {
                    let matches = true;
                    if (agentNameIndex !== -1) {
                        matches = matches && log.agent_name === params[agentNameIndex];
                    }
                    if (statusIndex !== -1) {
                        matches = matches && log.status === params[statusIndex];
                    }
                    return matches;
                });
            }
            const results = [...list];
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 11. Notifications
        if (sqlLower.includes('from notifications') && sqlLower.includes('user_id = ?')) {
            const results = data.notifications.filter(n => n.user_id === params[0]);
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // 12. Consent Records
        if (sqlLower.includes('from consent_records') && sqlLower.includes('user_id = ?')) {
            return data.consent_records.filter(c => c.user_id === params[0]);
        }
        // 13. Voice commands clarification prompts
        if (sqlLower.includes('from voice_clarification_prompts') && sqlLower.includes('voice_command_id = ?')) {
            return data.voice_clarification_prompts.filter(c => c.voice_command_id === params[0]);
        }
        // 14. Candidates list for Matching Agent
        if (sqlLower.includes('from match_candidates mc') && sqlLower.includes('mc.match_candidate_set_id = ?')) {
            const reqId = params[0];
            const list = data.match_candidates.filter(mc => mc.match_candidate_set_id === reqId);
            const results = list.map(mc => {
                const wp = data.worker_profiles.find(w => w.id === mc.worker_id);
                const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                return {
                    ...mc,
                    user_id: wp?.user_id,
                    skills: wp?.skills,
                    trust_score: wp?.trust_score,
                    verification_status: wp?.verification_status,
                    full_name: u?.full_name || 'Worker'
                };
            });
            // Sort by match_score DESC
            results.sort((a, b) => b.match_score - a.match_score);
            return results;
        }
        // JOIN 101: Bookings list with payments (NEW)
        if (sqlLower.includes('from bookings b') && sqlLower.includes('left join payments p')) {
            const filterUserId = params[0];
            let list = data.bookings;
            if (filterUserId) {
                list = data.bookings.filter(b => {
                    if (sqlLower.includes('b.id = ?') || sqlLower.includes('b.id =')) {
                        return b.id === filterUserId;
                    }
                    else if (sqlLower.includes('wp.id = ?') || sqlLower.includes('wp.user_id = ?')) {
                        const wp = data.worker_profiles.find(w => w.id === filterUserId || w.user_id === filterUserId);
                        return wp && b.worker_id === wp.id;
                    }
                    else if (sqlLower.includes('cp.id = ?') || sqlLower.includes('cp.user_id = ?')) {
                        const cp = data.customer_profiles.find(c => c.id === filterUserId || c.user_id === filterUserId);
                        return cp && b.customer_id === cp.id;
                    }
                    else if (sqlLower.includes('b.contractor_id = ?') || sqlLower.includes('cp2.user_id = ?')) {
                        const cp2 = data.contractor_profiles.find(c => c.id === filterUserId || c.user_id === filterUserId);
                        return cp2 && b.contractor_id === cp2.id;
                    }
                    return false;
                });
            }
            const results = list.map(b => {
                const wp = b.worker_id ? data.worker_profiles.find(w => w.id === b.worker_id) : null;
                const u = wp ? data.users.find(usr => usr.id === wp.user_id) : null;
                const cp = data.customer_profiles.find(c => c.id === b.customer_id);
                const cu = cp ? data.users.find(usr => usr.id === cp.user_id) : null;
                const sr = data.service_requests.find(r => r.id === b.service_request_id);
                const p = data.payments.find(pm => pm.job_reference_id === b.id && pm.job_reference_type === 'CUSTOMER_BOOKING');
                const cp2 = b.contractor_id ? data.contractor_profiles.find(c => c.id === b.contractor_id) : null;
                const uc = cp2 ? data.users.find(usr => usr.id === cp2.user_id) : null;
                return {
                    ...b,
                    worker_name: u?.full_name || 'Worker',
                    customer_name: cu?.full_name || 'Customer',
                    contractor_name: uc?.full_name || 'Contractor',
                    contractor_company: cp2?.company_name || 'Company',
                    requirement_text: sr?.raw_text || 'Service Request',
                    payment_amount: p?.amount || null,
                    payment_status: p?.status || null
                };
            });
            results.sort((a, b) => b.created_at.localeCompare(a.created_at));
            return results;
        }
        // Generic SELECT parser fallback for simple queries
        const selectRegex = /select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+))?$/i;
        const genericMatch = this.sql.match(selectRegex);
        if (genericMatch) {
            const fieldsStr = genericMatch[1].trim().toLowerCase();
            const tableName = genericMatch[2].trim().toLowerCase();
            const whereStr = genericMatch[3] ? genericMatch[3].trim() : '';
            const orderByStr = genericMatch[4] ? genericMatch[4].trim() : '';
            const limitStr = genericMatch[5] ? genericMatch[5].trim() : '';
            if (data[tableName]) {
                let rows = [...data[tableName]];
                // Apply WHERE filtering
                if (whereStr) {
                    const conditions = whereStr.split(/\s+and\s+/i);
                    rows = rows.filter(row => {
                        let paramIdx = 0;
                        for (const cond of conditions) {
                            const parts = cond.split(/(=|!=|between|in|like)/i);
                            if (parts.length < 3)
                                continue;
                            const field = parts[0].trim().replace(/^\w+\./, ''); // remove table prefix
                            const op = parts[1].trim().toLowerCase();
                            const valStr = parts[2].trim();
                            let checkVal;
                            if (valStr === '?') {
                                checkVal = params[paramIdx++];
                            }
                            else {
                                checkVal = valStr.replace(/^['"]|['"]$/g, '');
                            }
                            if (op === '=') {
                                if (row[field] != checkVal)
                                    return false;
                            }
                            else if (op === '!=') {
                                if (row[field] == checkVal)
                                    return false;
                            }
                            else if (op === 'between') {
                                const p1 = params[paramIdx++];
                                const p2 = params[paramIdx++];
                                if (row[field] < p1 || row[field] > p2)
                                    return false;
                            }
                            else if (op === 'in') {
                                const listStr = valStr.substring(valStr.indexOf('(') + 1, valStr.lastIndexOf(')'));
                                const list = listStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                                if (!list.includes(String(row[field])))
                                    return false;
                            }
                        }
                        return true;
                    });
                }
                // Apply JOIN fields if needed
                if (tableName === 'worker_profiles') {
                    rows = rows.map(row => {
                        const u = data.users.find(usr => usr.id === row.user_id);
                        return {
                            ...row,
                            full_name: u?.full_name || '',
                            phone: u?.phone || '',
                            email: u?.email || ''
                        };
                    });
                }
                else if (tableName === 'contractor_profiles') {
                    rows = rows.map(row => {
                        const u = data.users.find(usr => usr.id === row.user_id);
                        return {
                            ...row,
                            full_name: u?.full_name || '',
                            phone: u?.phone || '',
                            email: u?.email || ''
                        };
                    });
                }
                else if (tableName === 'customer_profiles') {
                    rows = rows.map(row => {
                        const u = data.users.find(usr => usr.id === row.user_id);
                        return {
                            ...row,
                            full_name: u?.full_name || '',
                            phone: u?.phone || '',
                            email: u?.email || ''
                        };
                    });
                }
                // Apply ORDER BY
                if (orderByStr) {
                    const parts = orderByStr.split(/\s+/);
                    const field = parts[0].trim().replace(/^\w+\./, '');
                    const desc = parts[1] && parts[1].toLowerCase() === 'desc';
                    rows.sort((a, b) => {
                        const valA = a[field];
                        const valB = b[field];
                        if (valA === undefined || valB === undefined)
                            return 0;
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                        }
                        return desc ? valB - valA : valA - valB;
                    });
                }
                // Apply LIMIT
                if (limitStr) {
                    const limit = parseInt(limitStr);
                    rows = rows.slice(0, limit);
                }
                // Project columns
                if (fieldsStr !== '*' && !fieldsStr.includes('.*')) {
                    const fields = fieldsStr.split(',').map(f => f.trim().replace(/^\w+\./, ''));
                    rows = rows.map(row => {
                        const projectedRow = {};
                        fields.forEach(f => {
                            projectedRow[f] = row[f];
                        });
                        return projectedRow;
                    });
                }
                return rows;
            }
        }
        return [];
    }
}
exports.db = new MockDatabase();
exports.default = exports.db;
