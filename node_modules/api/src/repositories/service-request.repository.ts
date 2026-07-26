import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export class ServiceRequestRepository {
  static create(reqData: {
    customer_id: string;
    raw_text: string;
    extracted_skills: string[];
    lat?: number;
    lng?: number;
    urgency_window_start?: string;
    urgency_window_end?: string;
    budget_min?: number;
    budget_max?: number;
  }) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const skillsJson = JSON.stringify(reqData.extracted_skills);
    
    db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, raw_text, extracted_skills, lat, lng, 
        urgency_window_start, urgency_window_end, budget_min, budget_max, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?)
    `).run(
      id,
      reqData.customer_id,
      reqData.raw_text,
      skillsJson,
      reqData.lat || 19.1197,
      reqData.lng || 72.8464,
      reqData.urgency_window_start || now,
      reqData.urgency_window_end || now,
      reqData.budget_min || 0,
      reqData.budget_max || 0,
      now
    );

    return this.findById(id);
  }

  static findById(id: string) {
    return db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id) as any;
  }

  static updateStatus(id: string, status: string, acceptedById?: string, acceptedByType?: string) {
    if (acceptedById && acceptedByType) {
      db.prepare(`
        UPDATE service_requests 
        SET status = ?, accepted_by_id = ?, accepted_by_type = ? 
        WHERE id = ?
      `).run(status, acceptedById, acceptedByType, id);
    } else {
      db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').run(status, id);
    }
    return this.findById(id);
  }

  static findByCustomerId(customerId: string) {
    return db.prepare('SELECT * FROM service_requests WHERE customer_id = ? ORDER BY created_at DESC').all(customerId) as any[];
  }

  static findAll() {
    return db.prepare('SELECT * FROM service_requests ORDER BY created_at DESC').all() as any[];
  }
}
