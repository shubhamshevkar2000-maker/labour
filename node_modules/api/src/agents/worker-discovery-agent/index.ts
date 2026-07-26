import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export interface Opportunity {
  id: string;
  type: 'CONTRACTOR_JOB' | 'CUSTOMER_BOOKING';
  title: string;
  description: string;
  skills: string[];
  distance_km: number;
  estimated_earnings: number;
  match_score: number;
  reasoning: string;
  created_at: string;
}

export class WorkerDiscoveryAgent {
  static async getOpportunities(workerId: string): Promise<Opportunity[]> {
    const startTime = Date.now();
    const runId = uuidv4();
    console.log(`[WorkerDiscoveryAgent] Scanning opportunities for worker profile: ${workerId}`);

    try {
      // 1. Fetch worker profile
      let wp = db.prepare('SELECT * FROM worker_profiles WHERE id = ?').get(workerId) as any;
      if (!wp) {
        wp = db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(workerId) as any;
      }
      if (!wp) {
        throw new Error(`Worker profile not found for ID: ${workerId}`);
      }

      const workerSkills = JSON.parse(wp.skills) as string[];
      const workerLat = wp.current_lat || wp.home_lat || 28.6139;
      const workerLng = wp.current_lng || wp.home_lng || 77.2090;

      const now = new Date().toISOString();
      const opportunities: Opportunity[] = [];

      // 2. Fetch contractor job requirements
      const contractorReqs = db.prepare(`
        SELECT r.*, c.company_name
        FROM job_requirements r
        JOIN contractor_profiles c ON r.contractor_id = c.id
        WHERE r.urgency_window_end >= ?
      `).all(now) as any[];

      // 3. Fetch customer service requests
      const customerReqs = db.prepare(`
        SELECT sr.*, u.full_name as customer_name
        FROM service_requests sr
        JOIN customer_profiles cp ON sr.customer_id = cp.id
        JOIN users u ON cp.user_id = u.id
        WHERE sr.status IN ('EXTRACTED', 'MATCHED', 'RECOMMENDED')
          AND sr.urgency_window_end >= ?
      `).all(now) as any[];

      // Helper function for Haversine distance
      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(1));
      };

      // Process contractor requirements
      for (const req of contractorReqs) {
        const reqSkills = JSON.parse(req.extracted_skills) as string[];
        const overlap = reqSkills.filter(s => workerSkills.includes(s.toLowerCase()));
        if (overlap.length === 0) continue; // No matching skill

        const dist = getDistance(workerLat, workerLng, req.lat, req.lng);
        const maxRadius = req.radius_km || 15;
        if (dist > maxRadius + 10) continue; // Skip if too far (allow a little buffer)

        const estEarnings = Math.round((req.pay_min + req.pay_max) / 2);
        
        // Calculate match score (out of 100)
        const distScore = Math.max(0, (1 - dist / maxRadius) * 50);
        const skillScore = 30; // matching skill
        const payScore = Math.min(20, (estEarnings / 1000) * 20);
        const matchScore = Math.round(distScore + skillScore + payScore);

        const reasoning = `Matches your skill "${overlap[0]}" and is located ${dist} km away. Offers estimated earnings of Rs. ${estEarnings} based on the contractor's budget.`;

        opportunities.push({
          id: req.id,
          type: 'CONTRACTOR_JOB',
          title: `Kaam Offer from ${req.company_name || 'Contractor'}`,
          description: req.raw_text,
          skills: reqSkills,
          distance_km: dist,
          estimated_earnings: estEarnings,
          match_score: matchScore,
          reasoning,
          created_at: req.created_at,
          contractor_id: req.contractor_id
        } as any);
      }

      // Process customer service requests
      for (const sr of customerReqs) {
        const srSkills = JSON.parse(sr.extracted_skills) as string[];
        const overlap = srSkills.filter(s => workerSkills.includes(s.toLowerCase()));
        if (overlap.length === 0) continue; // No matching skill

        const dist = getDistance(workerLat, workerLng, sr.lat, sr.lng);
        const maxRadius = sr.radius_km || 15;
        if (dist > maxRadius + 10) continue; // Skip if too far

        const estEarnings = Math.round(((sr.budget_min || 400) + (sr.budget_max || 700)) / 2);

        // Calculate match score (out of 100)
        const distScore = Math.max(0, (1 - dist / maxRadius) * 50);
        const skillScore = 30;
        const payScore = Math.min(20, (estEarnings / 1000) * 20);
        const matchScore = Math.round(distScore + skillScore + payScore);

        const reasoning = `Direct residential request from ${sr.customer_name}. Matches your skill "${overlap[0]}" and is ${dist} km away. Offers estimated payment of Rs. ${estEarnings}.`;

        opportunities.push({
          id: sr.id,
          type: 'CUSTOMER_BOOKING',
          title: `Ghar Ka Kaam from ${sr.customer_name}`,
          description: sr.raw_text,
          skills: srSkills,
          distance_km: dist,
          estimated_earnings: estEarnings,
          match_score: matchScore,
          reasoning,
          created_at: sr.created_at,
          customer_id: sr.customer_id
        } as any);
      }

      // Sort by match score descending
      opportunities.sort((a, b) => b.match_score - a.match_score);

      // Log agent run under RECOMMENDATION
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'RECOMMENDATION', '1.0.0', ?, ?, '[]', 'SUCCESS', ?, ?)
      `).run(
        runId,
        JSON.stringify({ workerId }),
        JSON.stringify({ opportunitiesCount: opportunities.length }),
        latency,
        new Date().toISOString()
      );

      return opportunities;

    } catch (err: any) {
      console.error(`[WorkerDiscoveryAgent] Error:`, err);
      // Log failure
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'RECOMMENDATION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ workerId }),
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }
}
export default WorkerDiscoveryAgent;
