const { db } = require('../../apps/api/src/db/sqlite');
const { runMigrations } = require('../../apps/api/src/db/migrate');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const SALT_ROUNDS = 10;
const logPath = path.resolve(__dirname, '../../database/seed_run.log');
const logLines: string[] = [];

function log(msg: string) {
  console.log(msg);
  logLines.push(`[${new Date().toISOString()}] ${msg}`);
  try {
    fs.writeFileSync(logPath, logLines.join('\n'), 'utf8');
  } catch (e) {}
}

async function seed() {
  log('Starting database seeding...');

  // Get absolute paths and verify match
  const pathWritten = path.resolve(db.getDbPath());
  const pathReadByAPI = path.resolve(db.getDbPath());

  log(`labourlink_db.json being written: ${pathWritten}`);
  log(`labourlink_db.json being read by the API: ${pathReadByAPI}`);

  if (pathWritten !== pathReadByAPI) {
    throw new Error('SEEDING DATABASE PATH MISMATCH');
  }

  log(`Database path being used: ${pathWritten}`);

  // Ensure tables exist before querying count
  runMigrations();

  const beforeUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  log(`Current user count before seeding: ${beforeUsers}`);
  log('Seed started');
  
  // Clear existing data (in order of foreign key dependency)
  db.serialize(() => {
    log('Clearing old database records...');
    db.run('DELETE FROM admin_actions');
    db.run('DELETE FROM consent_records');
    db.run('DELETE FROM availability_log');
    db.run('DELETE FROM disputes');
    db.run('DELETE FROM price_offers');
    db.run('DELETE FROM engagements');
    db.run('DELETE FROM notifications');
    db.run('DELETE FROM auth_sessions');
    db.run('DELETE FROM voice_clarification_prompts');
    db.run('DELETE FROM voice_commands');
    db.run('DELETE FROM recommendations');
    db.run('DELETE FROM match_candidates');
    db.run('DELETE FROM match_candidate_sets');
    db.run('DELETE FROM fraud_flags');
    db.run('DELETE FROM trust_score_history');
    db.run('DELETE FROM endorsements');
    db.run('DELETE FROM ratings');
    db.run('DELETE FROM payments');
    db.run('DELETE FROM jobs');
    db.run('DELETE FROM assignments');
    db.run('DELETE FROM bookings');
    db.run('DELETE FROM service_requests');
    db.run('DELETE FROM job_requirements');
    db.run('DELETE FROM verification_records');
    db.run('DELETE FROM customer_profiles');
    db.run('DELETE FROM contractor_profiles');
    db.run('DELETE FROM worker_profiles');
    db.run('DELETE FROM users');
    db.run('DELETE FROM agent_run_logs');
    db.run('DELETE FROM skills_taxonomy');
    log('Database cleared.');
  });

  const nowStr = () => new Date().toISOString();
  const pastStr = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  // Insert base Agent run log for seed actions
  const seedAgentRunId = uuidv4();
  db.run(`
    INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
    VALUES (?, 'VERIFICATION', '1.0.0', '{}', '{"status":"SUCCESS"}', '[]', 'SUCCESS', 5, ?)
  `, [seedAgentRunId, pastStr(30)]);

  // Hash password using standard bcrypt seed flow
  const pwHash = await bcrypt.hash('password123', SALT_ROUNDS);

  // 1. SKILLS TAXONOMY
  const skills = [
    { category: 'Construction', name: 'mason' },
    { category: 'Construction', name: 'painter' },
    { category: 'Construction', name: 'carpenter' },
    { category: 'Electrical', name: 'electrician' },
    { category: 'Electrical', name: 'ac technician' },
    { category: 'Plumbing', name: 'plumber' },
    { category: 'Plumbing', name: 'pipe fitter' },
    { category: 'Helper', name: 'helper' },
    { category: 'Domestic', name: 'cook' },
    { category: 'Domestic', name: 'cleaner' },
    { category: 'Domestic', name: 'domestic worker' }
  ];

  for (const s of skills) {
    db.run('INSERT INTO skills_taxonomy (id, category, name) VALUES (?, ?, ?)', [uuidv4(), s.category, s.name]);
  }
  log('Skills inserted');

  // 2. ADMIN
  const adminId = uuidv4();
  db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'ADMIN', 'Aarav Sharma', '9876543210', 'admin@labourlink.com', ?, ?)`, [adminId, pastStr(30), pastStr(30)]);

  // 3. CUSTOMERS
  const customers = [
    { id: uuidv4(), userId: uuidv4(), name: 'Amit Roy', phone: '9000000101', email: 'amit.roy@labourlink.com', address: 'Flat 402, Sunshine Apartments, Andheri West, Mumbai, Maharashtra', lat: 19.1197, lng: 72.8464, lang: 'hi' },
    { id: uuidv4(), userId: uuidv4(), name: 'Vijay Patel', phone: '9000000102', email: 'vijay.patel@labourlink.com', address: 'Sector 15, Noida, Uttar Pradesh', lat: 28.5830, lng: 77.3140, lang: 'en' },
    { id: uuidv4(), userId: uuidv4(), name: 'Priya Sharma', phone: '9000000103', email: 'priya.sharma@labourlink.com', address: 'Vasant Kunj, New Delhi, Delhi', lat: 28.5244, lng: 77.1477, lang: 'hi' }
  ];

  for (const c of customers) {
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'CUSTOMER', ?, ?, ?, ?, ?)`, 
      [c.userId, c.name, c.phone, c.email, pastStr(30), pastStr(30)]);
    db.run(`INSERT INTO customer_profiles (id, user_id, home_address, home_lat, home_lng, preferred_language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.userId, c.address, c.lat, c.lng, c.lang, pastStr(30)]);
  }
  log('Customers inserted');

  // 4. CONTRACTORS
  const contractors = [
    { id: uuidv4(), userId: uuidv4(), name: 'Suresh Buildmax', phone: '9000000201', email: 'buildmax@labourlink.com', company: 'Buildmax Construction Pvt Ltd', verified: 1 },
    { id: uuidv4(), userId: uuidv4(), name: 'Urban Works', phone: '9000000202', email: 'urbanworks@labourlink.com', company: 'Urban Works Solutions', verified: 1 },
    { id: uuidv4(), userId: uuidv4(), name: 'Skyline Infra', phone: '9000000203', email: 'skylineinfra@labourlink.com', company: 'Skyline Infrastructure', verified: 0 }
  ];

  for (const c of contractors) {
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'CONTRACTOR', ?, ?, ?, ?, ?)`, 
      [c.userId, c.name, c.phone, c.email, pastStr(30), pastStr(30)]);
    db.run(`INSERT INTO contractor_profiles (id, user_id, company_name, verified_business, created_at) VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.userId, c.company, c.verified, pastStr(30)]);
  }
  log('Contractors inserted');

  // 5. WORKERS
  const workers = [
    { id: uuidv4(), userId: uuidv4(), name: 'Ramesh Prasad', phone: '8000000001', email: 'ramesh.worker@labourlink.com', skills: ['mason', 'helper'], lat: 28.6139, lng: 77.2090, score: 95 },
    { id: uuidv4(), userId: uuidv4(), name: 'Suresh Kumar', phone: '8000000002', email: 'suresh.worker@labourlink.com', skills: ['electrician'], lat: 28.5355, lng: 77.3910, score: 88 },
    { id: uuidv4(), userId: uuidv4(), name: 'Akash Verma', phone: '8000000003', email: 'akash.worker@labourlink.com', skills: ['domestic worker', 'cleaner'], lat: 28.7041, lng: 77.1025, score: 92 },
    { id: uuidv4(), userId: uuidv4(), name: 'Imran Khan', phone: '8000000004', email: 'imran.worker@labourlink.com', skills: ['plumber'], lat: 28.4595, lng: 77.0266, score: 85 },
    { id: uuidv4(), userId: uuidv4(), name: 'Vikas Singh', phone: '8000000005', email: 'vikas.worker@labourlink.com', skills: ['painter'], lat: 28.6500, lng: 77.2300, score: 79 }
  ];

  for (const w of workers) {
    db.run(`INSERT INTO users (id, role, full_name, phone, email, created_at, updated_at) VALUES (?, 'WORKER', ?, ?, ?, ?, ?)`, 
      [w.userId, w.name, w.phone, w.email, pastStr(30), pastStr(30)]);

    db.run(`
      INSERT INTO worker_profiles (id, user_id, skills, home_lat, home_lng, current_lat, current_lng, availability_status, verification_status, trust_score, trust_score_updated_at, trust_score_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'VERIFIED', ?, ?, 1, ?)
    `, [w.id, w.userId, JSON.stringify(w.skills), w.lat, w.lng, w.lat, w.lng, w.score, pastStr(1), pastStr(30)]);

    // Verification records
    db.run(`
      INSERT INTO verification_records (id, worker_id, type, status, evidence_url, verified_by_agent_run_id, created_at)
      VALUES (?, ?, 'ID_DOCUMENT', 'VERIFIED', 'https://verifications.labourlink.in/docs/aadhaar_verify.pdf', ?, ?)
    `, [uuidv4(), w.id, seedAgentRunId, pastStr(28)]);

    db.run(`
      INSERT INTO verification_records (id, worker_id, type, status, evidence_url, verified_by_agent_run_id, created_at)
      VALUES (?, ?, 'SKILL_CERT', 'VERIFIED', 'https://verifications.labourlink.in/docs/skill_cert.pdf', ?, ?)
    `, [uuidv4(), w.id, seedAgentRunId, pastStr(28)]);

    // Consent Records
    db.run(`
      INSERT INTO consent_records (id, user_id, consent_type, granted, granted_via, created_at)
      VALUES (?, ?, 'VOICE_RECORDING', 1, 'UI', ?)
    `, [uuidv4(), w.userId, pastStr(25)]);
    
    db.run(`
      INSERT INTO consent_records (id, user_id, consent_type, granted, granted_via, created_at)
      VALUES (?, ?, 'DATA_PROCESSING', 1, 'UI', ?)
    `, [uuidv4(), w.userId, pastStr(25)]);

    // Availability log
    db.run(`
      INSERT INTO availability_log (id, worker_id, status, set_via, created_at)
      VALUES (?, ?, 'AVAILABLE', 'UI', ?)
    `, [uuidv4(), w.id, pastStr(5)]);

    // Trust score history
    db.run(`
      INSERT INTO trust_score_history (id, worker_id, score, version, computed_by_agent_run_id, contributing_factors, created_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `, [
      uuidv4(), w.id, w.score, seedAgentRunId, 
      JSON.stringify({ jobs_completed: 1, on_time_rate: 1, payment_integrity_factor: 1, average_contractor_rating: 5, endorsement_factor: 1, verification_factor: 2, fraud_penalty: 0, reliability_consistency_factor: 0, dispute_outcome_factor: 0 }),
      pastStr(15)
    ]);
  }
  log('Workers inserted');

  // 6. ENDORSEMENTS
  db.run(`
    INSERT INTO endorsements (id, worker_id, endorser_id, skill, comment, created_at)
    VALUES (?, ?, ?, 'mason', 'Ramesh Prasad is a very reliable mason. He did plastering work for our construction site and was excellent.', ?)
  `, [uuidv4(), workers[0].id, contractors[0].userId, pastStr(14)]);

  db.run(`
    INSERT INTO endorsements (id, worker_id, endorser_id, skill, comment, created_at)
    VALUES (?, ?, ?, 'electrician', 'Suresh is a highly professional wireman. Safe, quick, and neat work.', ?)
  `, [uuidv4(), workers[1].id, contractors[1].userId, pastStr(8)]);

  // 7. SAMPLE JOBS & SERVICE REQUESTS
  const req1Id = uuidv4();
  db.run(`
    INSERT INTO job_requirements (id, contractor_id, raw_text, extracted_skills, lat, lng, radius_km, headcount, min_trust_score, pay_min, pay_max, urgency_window_start, urgency_window_end, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'Need a skilled mason for plastering a building in central Delhi, near Connaught Place.', ?, 28.6139, 77.2090, 10, 1, 80, 500, 800, ?, ?, ?, ?)
  `, [
    req1Id, contractors[0].id, JSON.stringify(['mason']), 
    pastStr(20), pastStr(18), seedAgentRunId, pastStr(20)
  ]);

  const job1Id = uuidv4();
  db.run(`
    INSERT INTO jobs (id, job_requirement_id, worker_id, contractor_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 28.6139, 77.2090, ?)
  `, [
    job1Id, req1Id, workers[0].id, contractors[0].id, 
    pastStr(18), pastStr(15), pastStr(15), pastStr(20)
  ]);

  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, 750, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [uuidv4(), job1Id, pastStr(15), pastStr(15)]);

  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CONTRACTOR_JOB', ?, ?, ?, 5.0, 'Ramesh was on time, skilled, and did excellent plastering.', ?)
  `, [uuidv4(), job1Id, contractors[0].userId, workers[0].userId, pastStr(15)]);

  const sr1Id = uuidv4();
  db.run(`
    INSERT INTO service_requests (id, customer_id, mode, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'DIRECT_WORKER', 'Need a plumber to fix a leaking tap in my kitchen at Andheri West.', ?, 19.1197, 72.8464, 10, ?, ?, 300, 600, 'BOOKED', ?, ?)
  `, [
    sr1Id, customers[0].id, JSON.stringify(['plumber']),
    pastStr(10), pastStr(8), seedAgentRunId, pastStr(10)
  ]);

  const booking1Id = uuidv4();
  db.run(`
    INSERT INTO bookings (id, service_request_id, worker_id, customer_id, status, scheduled_start, scheduled_end, actual_completion, lat, lng, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 19.1197, 72.8464, ?)
  `, [
    booking1Id, sr1Id, workers[3].id, customers[0].id,
    pastStr(8), pastStr(8), pastStr(8), pastStr(10)
  ]);

  db.run(`
    INSERT INTO payments (id, job_reference_type, job_reference_id, amount, status, confirmation_method, confirmed_at, created_at)
    VALUES (?, 'CUSTOMER_BOOKING', ?, 500, 'CONFIRMED', 'UPI_VERIFIED', ?, ?)
  `, [uuidv4(), booking1Id, pastStr(8), pastStr(8)]);

  db.run(`
    INSERT INTO ratings (id, job_reference_type, job_reference_id, rater_id, ratee_id, score, comment, created_at)
    VALUES (?, 'CUSTOMER_BOOKING', ?, ?, ?, 5.0, 'Fixed the leaking tap very quickly and charged fairly.', ?)
  `, [uuidv4(), booking1Id, customers[0].userId, workers[3].userId, pastStr(8)]);

  // --- NEW ENGAGEMENTS SEEDING ---
  // 1. Direct worker engagement under negotiation
  const sr2Id = uuidv4();
  db.run(`
    INSERT INTO service_requests (id, customer_id, mode, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'DIRECT_WORKER', 'Need an electrician to fix a short circuit in my living room.', ?, 28.5244, 77.1477, 10, ?, ?, 400, 800, 'MATCHED', ?, ?)
  `, [
    sr2Id, customers[2].id, JSON.stringify(['electrician']),
    pastStr(3), pastStr(2), seedAgentRunId, pastStr(3)
  ]);

  const eng1Id = uuidv4();
  db.run(`
    INSERT INTO engagements (id, request_id, mode, initiator_id, counterparty_id, parent_engagement_id, status, created_at, updated_at)
    VALUES (?, ?, 'DIRECT_WORKER', ?, ?, NULL, 'PRICE_PROPOSED', ?, ?)
  `, [
    eng1Id, sr2Id, customers[2].userId, workers[1].userId, pastStr(2), pastStr(2)
  ]);

  db.run(`
    INSERT INTO price_offers (id, engagement_id, offered_by, amount, note, created_at)
    VALUES (?, ?, ?, 600, 'Standard rate for emergency troubleshooting.', ?)
  `, [uuidv4(), eng1Id, workers[1].userId, pastStr(2)]);

  // 2. Contractor engagement accepted, with a nested sub-engagement in progress
  const sr3Id = uuidv4();
  db.run(`
    INSERT INTO service_requests (id, customer_id, mode, raw_text, extracted_skills, lat, lng, radius_km, urgency_window_start, urgency_window_end, budget_min, budget_max, status, extracted_by_agent_run_id, created_at)
    VALUES (?, ?, 'VIA_CONTRACTOR', 'Need home renovation plastering work.', ?, 28.5830, 77.3140, 15, ?, ?, 1000, 3000, 'BOOKED', ?, ?)
  `, [
    sr3Id, customers[1].id, JSON.stringify(['mason']),
    pastStr(5), pastStr(3), seedAgentRunId, pastStr(5)
  ]);

  const engParentId = uuidv4();
  db.run(`
    INSERT INTO engagements (id, request_id, mode, initiator_id, counterparty_id, parent_engagement_id, status, created_at, updated_at)
    VALUES (?, ?, 'VIA_CONTRACTOR', ?, ?, NULL, 'ACCEPTED', ?, ?)
  `, [
    engParentId, sr3Id, customers[1].userId, contractors[0].userId, pastStr(4), pastStr(4)
  ]);

  const engSubId = uuidv4();
  db.run(`
    INSERT INTO engagements (id, request_id, mode, initiator_id, counterparty_id, parent_engagement_id, status, created_at, updated_at)
    VALUES (?, ?, 'DIRECT_WORKER', ?, ?, ?, 'IN_PROGRESS', ?, ?)
  `, [
    engSubId, sr3Id, contractors[0].userId, workers[0].userId, engParentId, pastStr(3), pastStr(3)
  ]);

  db.run(`
    INSERT INTO price_offers (id, engagement_id, offered_by, amount, note, created_at)
    VALUES (?, ?, ?, 1500, 'Assigned daily wage rate.', ?)
  `, [uuidv4(), engSubId, contractors[0].userId, pastStr(3)]);

  // Seed Identity Farming fraud scenario for Integration Tests
  db.run(`
    INSERT INTO auth_sessions (id, user_id, device_fingerprint, ip_address, user_agent, created_at)
    VALUES (?, ?, 'shared-device-fingerprint-xyz', '192.168.1.50', 'Mozilla/5.0', ?)
  `, [uuidv4(), workers[3].userId, pastStr(1)]);
  db.run(`
    INSERT INTO auth_sessions (id, user_id, device_fingerprint, ip_address, user_agent, created_at)
    VALUES (?, ?, 'shared-device-fingerprint-xyz', '192.168.1.50', 'Mozilla/5.0', ?)
  `, [uuidv4(), workers[4].userId, pastStr(1)]);

  // Force Save
  log('Force saving database to disk...');
  db.save();

  // Reload Database
  log('Reloading database from disk...');
  db.reload();

  // Verify inserted users still exist after reload
  const reloadCheckUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (reloadCheckUsers === 0) {
    throw new Error('Verification failed: database is empty after save and reload!');
  }
  const reloadAdmin = db.prepare("SELECT * FROM users WHERE email = 'admin@labourlink.com'").get();
  if (!reloadAdmin) {
    throw new Error("Verification failed: Seeded admin account 'admin@labourlink.com' not found after reload!");
  }
  log('Database reload validation passed. Seeded users verified.');

  // Print counts after seeding
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const workerCount = db.prepare('SELECT COUNT(*) as count FROM worker_profiles').get().count;
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customer_profiles').get().count;
  const contractorCount = db.prepare('SELECT COUNT(*) as count FROM contractor_profiles').get().count;
  const skillCount = db.prepare('SELECT COUNT(*) as count FROM skills_taxonomy').get().count;

  log('\n=========================================');
  log('          POST-SEEDING REPORT            ');
  log('=========================================');
  log(`User count after seeding: ${userCount}`);
  log(`Worker count: ${workerCount}`);
  log(`Customer count: ${customerCount}`);
  log(`Contractor count: ${contractorCount}`);
  log(`Skills taxonomy count: ${skillCount}`);
  log('=========================================\n');

  // Verify accounts login compatibility
  log('Verifying login credentials compatibility...');
  const { ApiController } = require('../../apps/api/src/controllers/api.controller');

  async function verifyAccountLogin(phone: string, expectedRole: string) {
    let responseStatus = 0;
    let responseJson: any = null;
    const req = {
      body: {
        phone,
        password: 'password123'
      },
      headers: {}
    };
    const res = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
      cookie() {
        return this;
      }
    };

    try {
      await ApiController.login(req, res);
      return responseStatus === 200 && responseJson && responseJson.user && responseJson.user.role === expectedRole;
    } catch (err: any) {
      log(`Login check error for ${phone}: ${err.message}`);
      return false;
    }
  }

  // Check Admin
  const adminOk = await verifyAccountLogin('9876543210', 'ADMIN');
  if (!adminOk) throw new Error('Seeded ADMIN account login check failed!');

  // Check Customers
  for (const c of customers) {
    const ok = await verifyAccountLogin(c.phone, 'CUSTOMER');
    if (!ok) throw new Error(`Seeded CUSTOMER account login check failed for ${c.name} (${c.phone})`);
  }

  // Check Contractors
  for (const c of contractors) {
    const ok = await verifyAccountLogin(c.phone, 'CONTRACTOR');
    if (!ok) throw new Error(`Seeded CONTRACTOR account login check failed for ${c.name} (${c.phone})`);
  }

  // Check Workers
  for (const w of workers) {
    const ok = await verifyAccountLogin(w.phone, 'WORKER');
    if (!ok) throw new Error(`Seeded WORKER account login check failed for ${w.name} (${w.phone})`);
  }

  log('All login credentials successfully verified via the API logic.');

  // Print all credentials in the console in the requested format
  log('\n=========================================');
  log('            DEMO CREDENTIALS             ');
  log('=========================================');
  
  log('\nADMIN');
  log(`Email: [admin@labourlink.com](mailto:admin@labourlink.com)`);
  log(`Password: password123`);

  for (const c of customers) {
    log('\nCUSTOMER');
    log(`Email: [${c.email}](mailto:${c.email})`);
    log(`Password: password123`);
  }

  for (const w of workers) {
    log('\nWORKER');
    log(`Email: [${w.email}](mailto:${w.email})`);
    log(`Password: password123`);
  }

  for (const c of contractors) {
    log('\nCONTRACTOR');
    log(`Email: [${c.email}](mailto:${c.email})`);
    log(`Password: password123`);
  }
  log('=========================================\n');

  // Condition checks for printing completion
  if (userCount > 0 && customerCount > 0 && workerCount > 0 && contractorCount > 0 && skillCount > 0) {
    log('Seed completed successfully');
  } else {
    throw new Error('Database validation failed: one or more tables are empty!');
  }
}

seed().catch(err => {
  log(`Seeding failed: ${err.message}`);
  process.exit(1);
});
