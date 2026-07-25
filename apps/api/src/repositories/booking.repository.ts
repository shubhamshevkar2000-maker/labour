import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export class BookingRepository {
  static create(bookingData: {
    service_request_id: string;
    customer_id: string;
    worker_id?: string;
    contractor_id?: string;
    status?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    lat?: number;
    lng?: number;
  }) {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO bookings (
        id, service_request_id, worker_id, contractor_id, customer_id, status,
        scheduled_start, scheduled_end, actual_completion, lat, lng, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(
      id,
      bookingData.service_request_id,
      bookingData.worker_id || null,
      bookingData.contractor_id || null,
      bookingData.customer_id,
      bookingData.status || 'REQUESTED',
      bookingData.scheduled_start || now,
      bookingData.scheduled_end || now,
      bookingData.lat || 19.1197,
      bookingData.lng || 72.8464,
      now
    );

    return this.findById(id);
  }

  static findById(id: string) {
    const query = `
      SELECT b.*, u.full_name as worker_name, cu.full_name as customer_name,
             c.company_name as contractor_company, uc.full_name as contractor_name,
             sr.raw_text as requirement_text, p.amount as payment_amount, p.status as payment_status
      FROM bookings b
      LEFT JOIN worker_profiles wp ON b.worker_id = wp.id
      LEFT JOIN users u ON wp.user_id = u.id
      JOIN customer_profiles cp ON b.customer_id = cp.id
      JOIN users cu ON cp.user_id = cu.id
      JOIN service_requests sr ON b.service_request_id = sr.id
      LEFT JOIN contractor_profiles c ON b.contractor_id = c.id
      LEFT JOIN users uc ON c.user_id = uc.id
      LEFT JOIN payments p ON b.id = p.job_reference_id AND p.job_reference_type = 'CUSTOMER_BOOKING'
      WHERE b.id = ?
    `;
    return db.prepare(query).get(id) as any;
  }

  static updateStatus(id: string, status: string, actualCompletion?: string) {
    if (actualCompletion) {
      db.prepare('UPDATE bookings SET status = ?, actual_completion = ? WHERE id = ?').run(status, actualCompletion, id);
    } else {
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
    }
    return this.findById(id);
  }

  static findByUserIdAndRole(userId: string, role: string) {
    let query = `
      SELECT b.*, u.full_name as worker_name, cu.full_name as customer_name,
             c.company_name as contractor_company, uc.full_name as contractor_name,
             sr.raw_text as requirement_text, p.amount as payment_amount, p.status as payment_status
      FROM bookings b
      LEFT JOIN worker_profiles wp ON b.worker_id = wp.id
      LEFT JOIN users u ON wp.user_id = u.id
      JOIN customer_profiles cp ON b.customer_id = cp.id
      JOIN users cu ON cp.user_id = cu.id
      JOIN service_requests sr ON b.service_request_id = sr.id
      LEFT JOIN contractor_profiles c ON b.contractor_id = c.id
      LEFT JOIN users uc ON c.user_id = uc.id
      LEFT JOIN payments p ON b.id = p.job_reference_id AND p.job_reference_type = 'CUSTOMER_BOOKING'
    `;
    const params: any[] = [];
    if (userId && role) {
      if (role === 'WORKER') {
        query += ' WHERE wp.id = ? OR wp.user_id = ?';
        params.push(userId, userId);
      } else if (role === 'CUSTOMER') {
        query += ' WHERE cp.id = ? OR cp.user_id = ?';
        params.push(userId, userId);
      } else if (role === 'CONTRACTOR') {
        query += ' WHERE b.contractor_id = ? OR c.user_id = ?';
        params.push(userId, userId);
      }
    }
    query += ' ORDER BY b.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static findAll() {
    let query = `
      SELECT b.*, u.full_name as worker_name, cu.full_name as customer_name,
             c.company_name as contractor_company, uc.full_name as contractor_name,
             sr.raw_text as requirement_text, p.amount as payment_amount, p.status as payment_status
      FROM bookings b
      LEFT JOIN worker_profiles wp ON b.worker_id = wp.id
      LEFT JOIN users u ON wp.user_id = u.id
      JOIN customer_profiles cp ON b.customer_id = cp.id
      JOIN users cu ON cp.user_id = cu.id
      JOIN service_requests sr ON b.service_request_id = sr.id
      LEFT JOIN contractor_profiles c ON b.contractor_id = c.id
      LEFT JOIN users uc ON c.user_id = uc.id
      LEFT JOIN payments p ON b.id = p.job_reference_id AND p.job_reference_type = 'CUSTOMER_BOOKING'
      ORDER BY b.created_at DESC
    `;
    return db.prepare(query).all() as any[];
  }
}
