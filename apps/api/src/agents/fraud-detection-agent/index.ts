import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import TrustAgent from '../trust-agent';

export class FraudDetectionAgent {
  static async run(agentRunId?: string): Promise<number> {
    const startTime = Date.now();
    const runId = agentRunId || uuidv4();
    console.log(`[FraudDetectionAgent] Running active fraud detection sweep...`);

    let flagsDetected = 0;

    try {
      // Rule 1: Location Conflict
      // Check for workers with overlapping job schedules in geographically separated locations (> 10km)
      const locationConflicts = db.prepare(`
        SELECT j1.worker_id, j1.id as job1_id, j2.id as job2_id, 
               j1.lat as lat1, j1.lng as lng1, j2.lat as lat2, j2.lng as lng2,
               u.full_name
        FROM jobs j1
        JOIN jobs j2 ON j1.worker_id = j2.worker_id AND j1.id < j2.id
        JOIN worker_profiles wp ON j1.worker_id = wp.id
        JOIN users u ON wp.user_id = u.id
        WHERE j1.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') 
          AND j2.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')
          AND (
            (j1.scheduled_start <= j2.scheduled_end AND j1.scheduled_end >= j2.scheduled_start)
          )
      `).all() as any[];

      for (const conflict of locationConflicts) {
        const distRow = db.prepare('SELECT dist_km(?, ?, ?, ?) as distance').get(conflict.lat1, conflict.lng1, conflict.lat2, conflict.lng2) as { distance: number | null };
        const distance = distRow?.distance ?? 0;

        if (distance > 10) {
          // Check if this flag is already logged
          const evidenceKey = `conflict_jobs:${conflict.job1_id}_${conflict.job2_id}`;
          const existing = db.prepare(`
            SELECT id FROM fraud_flags 
            WHERE subject_type = 'WORKER' AND subject_id = ? AND flag_type = 'LOCATION_CONFLICT' AND status = 'OPEN'
          `).get(conflict.worker_id);

          if (!existing) {
            console.log(`[FraudDetectionAgent] Flagging LOCATION_CONFLICT for worker ${conflict.full_name} (${conflict.worker_id})`);
            db.prepare(`
              INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at)
              VALUES (?, 'WORKER', ?, 'LOCATION_CONFLICT', 'HIGH', ?, 'OPEN', ?, ?)
            `).run(
              uuidv4(),
              conflict.worker_id,
              JSON.stringify({
                reason: `Worker scheduled for two overlapping jobs in geographically incompatible locations (${distance.toFixed(1)} km apart).`,
                job1: conflict.job1_id,
                job2: conflict.job2_id,
                distance_km: distance
              }),
              runId,
              new Date().toISOString()
            );
            flagsDetected++;
            // Recompute trust score to apply penalty
            await TrustAgent.run(conflict.worker_id, runId);
          }
        }
      }

      // Rule 2: Rating Collusion
      // Repeated reciprocal 5-star rating exchanges between a contractor and a worker
      const ratingCollusions = db.prepare(`
        SELECT r1.rater_id as contractor_user_id, r1.ratee_id as worker_user_id, COUNT(r1.id) as cnt, cp.id as contractor_id, wp.id as worker_id
        FROM ratings r1
        JOIN contractor_profiles cp ON r1.rater_id = cp.user_id OR r1.rater_id = cp.id
        JOIN worker_profiles wp ON r1.ratee_id = wp.user_id OR r1.ratee_id = wp.id
        WHERE r1.score = 5.0
        GROUP BY contractor_user_id, worker_user_id
        HAVING cnt >= 3
      `).all() as any[];

      for (const col of ratingCollusions) {
        const existing = db.prepare(`
          SELECT id FROM fraud_flags 
          WHERE subject_type = 'WORKER' AND subject_id = ? AND flag_type = 'RATING_COLLUSION' AND status = 'OPEN'
        `).get(col.worker_id);

        if (!existing) {
          console.log(`[FraudDetectionAgent] Flagging RATING_COLLUSION for worker profile ${col.worker_id} and contractor ${col.contractor_id}`);
          db.prepare(`
            INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at)
            VALUES (?, 'WORKER', ?, 'RATING_COLLUSION', 'MEDIUM', ?, 'OPEN', ?, ?)
          `).run(
            uuidv4(),
            col.worker_id,
            JSON.stringify({
              reason: `Suspicious rating cluster: Worker and contractor exchanged 5-star ratings ${col.cnt} times.`,
              contractor_id: col.contractor_id,
              ratings_count: col.cnt
            }),
            runId,
            new Date().toISOString()
          );
          flagsDetected++;
          await TrustAgent.run(col.worker_id, runId);
        }
      }

      // Rule 3: Payment Mismatch
      // Payment amount doesn't align with requirement pay limits
      const paymentMismatches = db.prepare(`
        SELECT p.id as payment_id, p.amount, j.id as job_id, jr.pay_min, jr.pay_max, j.worker_id
        FROM payments p
        JOIN jobs j ON p.job_id = j.id
        JOIN job_requirements jr ON j.job_requirement_id = jr.id
        WHERE p.amount < jr.pay_min OR p.amount > jr.pay_max
      `).all() as any[];

      for (const pm of paymentMismatches) {
        const existing = db.prepare(`
          SELECT id FROM fraud_flags 
          WHERE subject_type = 'JOB' AND subject_id = ? AND flag_type = 'PAYMENT_MISMATCH' AND status = 'OPEN'
        `).get(pm.job_id);

        if (!existing) {
          console.log(`[FraudDetectionAgent] Flagging PAYMENT_MISMATCH for job ${pm.job_id}`);
          db.prepare(`
            INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at)
            VALUES (?, 'JOB', ?, 'PAYMENT_MISMATCH', 'LOW', ?, 'OPEN', ?, ?)
          `).run(
            uuidv4(),
            pm.job_id,
            JSON.stringify({
              reason: `Payment amount Rs. ${pm.amount} falls outside the agreed job budget of Rs. ${pm.pay_min} - Rs. ${pm.pay_max}.`,
              payment_id: pm.payment_id,
              amount: pm.amount,
              expected_min: pm.pay_min,
              expected_max: pm.pay_max
            }),
            runId,
            new Date().toISOString()
          );
          flagsDetected++;
          // Trigger worker trust update
          await TrustAgent.run(pm.worker_id, runId);
        }
      }

      // Rule 4: Identity Farming (Multiple worker accounts sharing same device_fingerprint)
      const deviceFarming = db.prepare(`
        SELECT s1.user_id as user1, s2.user_id as user2, s1.device_fingerprint, wp1.id as worker1_id, wp2.id as worker2_id
        FROM auth_sessions s1
        JOIN auth_sessions s2 ON s1.device_fingerprint = s2.device_fingerprint AND s1.user_id < s2.user_id
        JOIN worker_profiles wp1 ON s1.user_id = wp1.user_id
        JOIN worker_profiles wp2 ON s2.user_id = wp2.user_id
        WHERE s1.device_fingerprint IS NOT NULL AND s1.device_fingerprint != ''
      `).all() as any[];

      for (const farm of deviceFarming) {
        // Flag both worker profiles
        for (const wId of [farm.worker1_id, farm.worker2_id]) {
          const existing = db.prepare(`
            SELECT id FROM fraud_flags 
            WHERE subject_type = 'WORKER' AND subject_id = ? AND flag_type = 'IDENTITY_FARMING' AND status = 'OPEN'
          `).get(wId);

          if (!existing) {
            console.log(`[FraudDetectionAgent] Flagging IDENTITY_FARMING for worker ${wId}`);
            db.prepare(`
              INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at)
              VALUES (?, 'WORKER', ?, 'IDENTITY_FARMING', 'CRITICAL', ?, 'OPEN', ?, ?)
            `).run(
              uuidv4(),
              wId,
              JSON.stringify({
                reason: `Device fingerprint reuse: Multiple worker accounts accessed from device '${farm.device_fingerprint}'.`,
                conflicting_user_id: wId === farm.worker1_id ? farm.user2 : farm.user1,
                device_fingerprint: farm.device_fingerprint
              }),
              runId,
              new Date().toISOString()
            );
            flagsDetected++;
            await TrustAgent.run(wId, runId);
          }
        }
      }

      // Rule 5: Self Dealing Suspected (matching phone or session device fingerprints between worker and customer)
      const allBookings = db.prepare("SELECT * FROM bookings").all() as any[];
      const allUsers = db.prepare("SELECT * FROM users").all() as any[];
      const allWorkerProfiles = db.prepare("SELECT * FROM worker_profiles").all() as any[];
      const allCustomerProfiles = db.prepare("SELECT * FROM customer_profiles").all() as any[];
      const allSessions = db.prepare("SELECT * FROM auth_sessions").all() as any[];

      for (const booking of allBookings) {
        const wp = allWorkerProfiles.find(w => w.id === booking.worker_id);
        const wu = wp ? allUsers.find(u => u.id === wp.user_id) : null;
        const cp = allCustomerProfiles.find(c => c.id === booking.customer_id);
        const cu = cp ? allUsers.find(u => u.id === cp.user_id) : null;

        if (wu && cu) {
          let selfDealing = false;
          let reason = '';
          let detail = '';

          if (wu.phone && cu.phone && wu.phone === cu.phone) {
            selfDealing = true;
            reason = 'matching phone number';
            detail = wu.phone;
          } else {
            const wSessions = allSessions.filter(s => s.user_id === wu.id && s.device_fingerprint);
            const cSessions = allSessions.filter(s => s.user_id === cu.id && s.device_fingerprint);
            const wFps = wSessions.map(s => s.device_fingerprint);
            const cFps = cSessions.map(s => s.device_fingerprint);
            const sharedFps = wFps.filter(fp => cFps.includes(fp));
            if (sharedFps.length > 0) {
              selfDealing = true;
              reason = 'matching device fingerprint';
              detail = sharedFps[0];
            }
          }

          if (selfDealing) {
            const existing = db.prepare(`
              SELECT id FROM fraud_flags 
              WHERE subject_type = 'WORKER' AND subject_id = ? AND flag_type = 'SELF_DEALING_SUSPECTED' AND status = 'OPEN'
            `).get(booking.worker_id);

            if (!existing) {
              console.log(`[FraudDetectionAgent] Flagging SELF_DEALING_SUSPECTED for worker ${booking.worker_id} on booking ${booking.id}`);
              db.prepare(`
                INSERT INTO fraud_flags (id, subject_type, subject_id, flag_type, severity, evidence, status, detected_by_agent_run_id, created_at)
                VALUES (?, 'WORKER', ?, 'SELF_DEALING_SUSPECTED', 'HIGH', ?, 'OPEN', ?, ?)
              `).run(
                uuidv4(),
                booking.worker_id,
                JSON.stringify({
                  reason: `Self-dealing suspected on booking ${booking.id}: ${reason}.`,
                  booking_id: booking.id,
                  matching_value: detail
                }),
                runId,
                new Date().toISOString()
              );
              flagsDetected++;
              await TrustAgent.run(booking.worker_id, runId);
            }
          }
        }
      }

      // Log success run
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'FRAUD_DETECTION', '1.0.0', '{}', ?, '[]', 'SUCCESS', ?, ?)
      `).run(
        runId,
        JSON.stringify({ flagsDetected }),
        latency,
        new Date().toISOString()
      );

      return flagsDetected;

    } catch (err: any) {
      console.error('[FraudDetectionAgent] Error:', err);
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'FRAUD_DETECTION', '1.0.0', '{}', ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }
}
export default FraudDetectionAgent;
