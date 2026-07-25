import { db } from './sqlite';

export function runMigrations() {
  console.log('Running database migrations...');
  
  db.serialize(() => {
    // 1. USERS
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        role TEXT CHECK(role IN ('WORKER', 'CUSTOMER', 'CONTRACTOR', 'ADMIN')) NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 2. WORKER PROFILES
    db.run(`
      CREATE TABLE IF NOT EXISTS worker_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        skills TEXT NOT NULL, -- JSON array of strings
        home_lat REAL,
        home_lng REAL,
        current_lat REAL,
        current_lng REAL,
        availability_status TEXT CHECK(availability_status IN ('AVAILABLE', 'BUSY', 'OFFLINE', 'ON_LEAVE')) NOT NULL,
        verification_status TEXT CHECK(verification_status IN ('UNVERIFIED', 'PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED')) NOT NULL,
        trust_score REAL, -- null initially
        trust_score_updated_at TEXT,
        trust_score_version INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 3. CONTRACTOR PROFILES
    db.run(`
      CREATE TABLE IF NOT EXISTS contractor_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        company_name TEXT,
        verified_business INTEGER CHECK(verified_business IN (0, 1)) DEFAULT 0,
        trust_score REAL,
        trust_score_updated_at TEXT,
        trust_score_version INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 3.1 CUSTOMER PROFILES (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        home_address TEXT,
        home_lat REAL,
        home_lng REAL,
        preferred_language TEXT CHECK(preferred_language IN ('hi','mr','ta','te','bn','en')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 4. VERIFICATION RECORDS
    db.run(`
      CREATE TABLE IF NOT EXISTS verification_records (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        type TEXT CHECK(type IN ('ID_DOCUMENT', 'SKILL_CERT', 'EMPLOYER_ATTESTATION', 'BIOMETRIC')) NOT NULL,
        status TEXT CHECK(status IN ('PENDING', 'VERIFIED', 'REJECTED')) NOT NULL,
        evidence_url TEXT,
        verified_by_agent_run_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE
      )
    `);

    // 5. JOB REQUIREMENTS
    db.run(`
      CREATE TABLE IF NOT EXISTS job_requirements (
        id TEXT PRIMARY KEY,
        contractor_id TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        extracted_skills TEXT NOT NULL, -- JSON array of strings
        lat REAL,
        lng REAL,
        radius_km REAL,
        headcount INTEGER,
        min_trust_score REAL,
        pay_min REAL,
        pay_max REAL,
        urgency_window_start TEXT,
        urgency_window_end TEXT,
        extracted_by_agent_run_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (contractor_id) REFERENCES contractor_profiles (id) ON DELETE CASCADE
      )
    `);

    // 5.1 SERVICE REQUESTS (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        mode TEXT CHECK(mode IN ('DIRECT_WORKER', 'VIA_CONTRACTOR')) DEFAULT 'DIRECT_WORKER',
        raw_text TEXT NOT NULL,
        extracted_skills TEXT NOT NULL, -- JSON array of strings
        lat REAL,
        lng REAL,
        radius_km REAL,
        urgency_window_start TEXT,
        urgency_window_end TEXT,
        budget_min REAL,
        budget_max REAL,
        status TEXT CHECK(status IN ('REQUESTED','MATCHED','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED')),
        accepted_by_id TEXT,
        accepted_by_type TEXT CHECK(accepted_by_type IN ('WORKER','CONTRACTOR')),
        extracted_by_agent_run_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
      )
    `);

    // 6. JOBS
    db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        job_requirement_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        contractor_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED')) NOT NULL,
        scheduled_start TEXT,
        scheduled_end TEXT,
        actual_completion TEXT,
        lat REAL,
        lng REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_requirement_id) REFERENCES job_requirements (id) ON DELETE RESTRICT,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT,
        FOREIGN KEY (contractor_id) REFERENCES contractor_profiles (id) ON DELETE RESTRICT
      )
    `);

    // 6.1 BOOKINGS (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        service_request_id TEXT NOT NULL,
        worker_id TEXT,
        contractor_id TEXT,
        customer_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('REQUESTED','MATCHED','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED')),
        scheduled_start TEXT,
        scheduled_end TEXT,
        actual_completion TEXT,
        lat REAL,
        lng REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE RESTRICT,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT,
        FOREIGN KEY (contractor_id) REFERENCES contractor_profiles (id) ON DELETE RESTRICT,
        FOREIGN KEY (customer_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT
      )
    `);

    // 6.2 SKILLS TAXONOMY (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS skills_taxonomy (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL UNIQUE
      )
    `);

    // 7. PAYMENTS (Polymorphic)
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        job_reference_type TEXT CHECK(job_reference_type IN ('CONTRACTOR_JOB', 'CUSTOMER_BOOKING')) NOT NULL,
        job_reference_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'DISPUTED', 'FAILED')) NOT NULL,
        confirmation_method TEXT CHECK(confirmation_method IN ('UPI_VERIFIED', 'CASH_ATTESTED', 'BANK_VERIFIED')) NOT NULL,
        confirmed_at TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // 8. RATINGS (Polymorphic)
    db.run(`
      CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY,
        job_reference_type TEXT CHECK(job_reference_type IN ('CONTRACTOR_JOB', 'CUSTOMER_BOOKING')) NOT NULL,
        job_reference_id TEXT NOT NULL,
        rater_id TEXT NOT NULL,
        ratee_id TEXT NOT NULL,
        score REAL CHECK(score >= 1 AND score <= 5) NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (rater_id) REFERENCES users (id) ON DELETE RESTRICT,
        FOREIGN KEY (ratee_id) REFERENCES users (id) ON DELETE RESTRICT
      )
    `);

    // 9. ENDORSEMENTS
    db.run(`
      CREATE TABLE IF NOT EXISTS endorsements (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        endorser_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE,
        FOREIGN KEY (endorser_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 10. TRUST SCORE HISTORY
    db.run(`
      CREATE TABLE IF NOT EXISTS trust_score_history (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        score REAL NOT NULL,
        version INTEGER NOT NULL,
        computed_by_agent_run_id TEXT NOT NULL,
        contributing_factors TEXT NOT NULL, -- JSON string
        created_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE
      )
    `);

    // 11. FRAUD FLAGS
    db.run(`
      CREATE TABLE IF NOT EXISTS fraud_flags (
        id TEXT PRIMARY KEY,
        subject_type TEXT CHECK(subject_type IN ('WORKER', 'CONTRACTOR', 'JOB', 'RATING')) NOT NULL,
        subject_id TEXT NOT NULL,
        flag_type TEXT CHECK(flag_type IN ('DUPLICATE_IDENTITY', 'RATING_COLLUSION', 'LOCATION_CONFLICT', 'PAYMENT_MISMATCH', 'IDENTITY_FARMING', 'SELF_DEALING_SUSPECTED', 'OTHER')) NOT NULL,
        severity TEXT CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
        evidence TEXT NOT NULL, -- JSON string
        status TEXT CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED')) NOT NULL,
        detected_by_agent_run_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY (detected_by_agent_run_id) REFERENCES agent_run_logs (id)
      )
    `);

    // 12. AGENT RUN LOGS
    db.run(`
      CREATE TABLE IF NOT EXISTS agent_run_logs (
        id TEXT PRIMARY KEY,
        agent_name TEXT CHECK(agent_name IN ('VERIFICATION', 'REQUIREMENT_EXTRACTION', 'WORKER_MATCHING', 'TRUST', 'FRAUD_DETECTION', 'RECOMMENDATION', 'VOICE_INTERACTION')) NOT NULL,
        agent_version TEXT NOT NULL,
        input_payload TEXT, -- JSON string
        output_payload TEXT, -- JSON string
        evidence_record_ids TEXT, -- JSON string of string array
        status TEXT CHECK(status IN ('SUCCESS', 'FAILURE', 'PARTIAL')) NOT NULL,
        latency_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 13. MATCH CANDIDATE SETS (Polymorphic)
    db.run(`
      CREATE TABLE IF NOT EXISTS match_candidate_sets (
        id TEXT PRIMARY KEY,
        request_reference_type TEXT CHECK(request_reference_type IN ('JOB_REQUIREMENT', 'SERVICE_REQUEST')) NOT NULL,
        request_reference_id TEXT NOT NULL,
        generated_by_agent_run_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (generated_by_agent_run_id) REFERENCES agent_run_logs (id) ON DELETE CASCADE
      )
    `);

    // 14. MATCH CANDIDATES
    db.run(`
      CREATE TABLE IF NOT EXISTS match_candidates (
        id TEXT PRIMARY KEY,
        match_candidate_set_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        match_score REAL NOT NULL,
        matched_fields TEXT NOT NULL, -- JSON string
        created_at TEXT NOT NULL,
        FOREIGN KEY (match_candidate_set_id) REFERENCES match_candidate_sets (id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE
      )
    `);

    // 15. RECOMMENDATIONS (Polymorphic)
    db.run(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY,
        request_reference_type TEXT CHECK(request_reference_type IN ('JOB_REQUIREMENT', 'SERVICE_REQUEST')) NOT NULL,
        request_reference_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        evidence TEXT NOT NULL, -- JSON string
        generated_by_agent_run_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE,
        FOREIGN KEY (generated_by_agent_run_id) REFERENCES agent_run_logs (id) ON DELETE CASCADE
      )
    `);

    // 16. VOICE COMMANDS
    db.run(`
      CREATE TABLE IF NOT EXISTS voice_commands (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        raw_audio_ref TEXT NOT NULL,
        transcript TEXT NOT NULL,
        detected_language TEXT CHECK(detected_language IN ('hi', 'mr', 'ta', 'te', 'bn', 'en')) NOT NULL,
        intent TEXT CHECK(intent IN ('JOB_SEARCH', 'REGISTER', 'UPDATE_PROFILE', 'APPLY_JOB', 'ACCEPT_JOB', 'NAVIGATE', 'UNKNOWN')) NOT NULL,
        slots TEXT NOT NULL, -- JSON string
        confidence TEXT NOT NULL, -- JSON string
        status TEXT CHECK(status IN ('RECEIVED', 'PROCESSING', 'NEEDS_CLARIFICATION', 'ROUTED_TO_AGENT', 'COMPLETED', 'FAILED')) NOT NULL,
        routed_to_agent TEXT CHECK(routed_to_agent IN ('REQUIREMENT_EXTRACTION', 'WORKER_MATCHING', 'RECOMMENDATION', 'VERIFICATION', 'NONE')),
        agent_run_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (agent_run_id) REFERENCES agent_run_logs (id)
      )
    `);

    // 17. VOICE CLARIFICATION PROMPTS
    db.run(`
      CREATE TABLE IF NOT EXISTS voice_clarification_prompts (
        id TEXT PRIMARY KEY,
        voice_command_id TEXT NOT NULL,
        missing_field TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        resolved INTEGER CHECK(resolved IN (0, 1)) DEFAULT 0,
        resolved_voice_command_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (voice_command_id) REFERENCES voice_commands (id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_voice_command_id) REFERENCES voice_commands (id)
      )
    `);

    // 18. AUTH SESSIONS
    db.run(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_fingerprint TEXT,
        ip_address TEXT,
        lat REAL,
        lng REAL,
        login_method TEXT CHECK(login_method IN ('PASSWORD', 'OTP', 'VOICE')) NOT NULL,
        created_at TEXT NOT NULL,
        expired_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 19. NOTIFICATIONS (Extended Statuses)
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel TEXT CHECK(channel IN ('SMS', 'VOICE_CALLBACK', 'PUSH', 'IN_APP')) NOT NULL,
        type TEXT CHECK(type IN ('JOB_OFFER', 'TRUST_SCORE_UPDATE', 'FRAUD_ALERT', 'CLARIFICATION_NEEDED', 'PAYMENT_CONFIRMED', 'BOOKING_REQUEST', 'BOOKING_ACCEPTED', 'VERIFICATION_APPROVED')) NOT NULL,
        payload TEXT NOT NULL, -- JSON string
        delivered INTEGER CHECK(delivered IN (0, 1)) DEFAULT 0,
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 25. ENGAGEMENTS (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS engagements (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        mode TEXT CHECK(mode IN ('DIRECT_WORKER', 'VIA_CONTRACTOR')) NOT NULL,
        initiator_id TEXT NOT NULL,
        counterparty_id TEXT NOT NULL,
        parent_engagement_id TEXT,
        status TEXT CHECK(status IN ('DRAFT', 'MATCHED', 'PENDING_RESPONSE', 'ACCEPTED', 'REJECTED', 'PRICE_PROPOSED', 'PRICE_COUNTERED', 'PRICE_AGREED', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'RATED', 'DISPUTED', 'CANCELLED')) NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
        FOREIGN KEY (initiator_id) REFERENCES users (id) ON DELETE RESTRICT,
        FOREIGN KEY (counterparty_id) REFERENCES users (id) ON DELETE RESTRICT,
        FOREIGN KEY (parent_engagement_id) REFERENCES engagements (id) ON DELETE CASCADE
      )
    `);

    // 26. PRICE OFFERS (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS price_offers (
        id TEXT PRIMARY KEY,
        engagement_id TEXT NOT NULL,
        offered_by TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (engagement_id) REFERENCES engagements (id) ON DELETE CASCADE,
        FOREIGN KEY (offered_by) REFERENCES users (id) ON DELETE RESTRICT
      )
    `);

    // 20. DISPUTES
    db.run(`
      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        engagement_id TEXT NOT NULL,
        raised_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence_urls TEXT NOT NULL, -- JSON string array
        status TEXT CHECK(status IN ('OPEN', 'RESOLVED')) NOT NULL,
        resolution TEXT CHECK(resolution IN ('worker_at_fault', 'contractor_at_fault', 'no_fault')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (engagement_id) REFERENCES engagements (id) ON DELETE CASCADE,
        FOREIGN KEY (raised_by) REFERENCES users (id) ON DELETE RESTRICT
      )
    `);

    // 21. AVAILABILITY LOG
    db.run(`
      CREATE TABLE IF NOT EXISTS availability_log (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('AVAILABLE', 'BUSY', 'OFFLINE', 'ON_LEAVE')) NOT NULL,
        set_via TEXT CHECK(set_via IN ('UI', 'VOICE', 'SYSTEM_AUTO')) NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE CASCADE
      )
    `);

    // 22. CONSENT RECORDS
    db.run(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        consent_type TEXT CHECK(consent_type IN ('VOICE_RECORDING', 'DATA_PROCESSING', 'LOCATION_TRACKING', 'BACKGROUND_VERIFICATION')) NOT NULL,
        granted INTEGER CHECK(granted IN (0, 1)) NOT NULL,
        granted_via TEXT CHECK(granted_via IN ('UI', 'VOICE')) NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 23. ADMIN ACTIONS
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action_type TEXT CHECK(action_type IN ('FRAUD_FLAG_RESOLVED', 'FRAUD_FLAG_DISMISSED', 'TRUST_SCORE_EXCEPTION', 'ACCOUNT_SUSPENDED', 'VERIFICATION_OVERRIDDEN')) NOT NULL,
        target_type TEXT CHECK(target_type IN ('WORKER', 'CONTRACTOR', 'JOB', 'FRAUD_FLAG')) NOT NULL,
        target_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // 24. ASSIGNMENTS (NEW)
    db.run(`
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED')) NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        remarks TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT
      )
    `);

    // INDEXES
    db.run(`CREATE INDEX IF NOT EXISTS idx_worker_lat_lng ON worker_profiles (home_lat, home_lng, current_lat, current_lng)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_worker_status ON jobs (worker_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_contractor_status ON jobs (contractor_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings (ratee_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON fraud_flags (status) WHERE status = 'OPEN'`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_voice_commands_status ON voice_commands (status)`);
    
    // NEW INDEXES (CUSTOMER & BOOKINGS)
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_worker_status ON bookings (worker_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_customer_status ON bookings (customer_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_lat_lng ON customer_profiles (home_lat, home_lng)`);

    console.log('Database migrations completed successfully.');
  });
}

// If run directly
if (require.main === module) {
  runMigrations();
}
