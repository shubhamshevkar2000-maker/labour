"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingRepository = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
class BookingRepository {
    static create(bookingData) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        sqlite_1.db.prepare(`
      INSERT INTO bookings (
        id, service_request_id, worker_id, contractor_id, customer_id, status,
        scheduled_start, scheduled_end, actual_completion, lat, lng, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(id, bookingData.service_request_id, bookingData.worker_id || null, bookingData.contractor_id || null, bookingData.customer_id, bookingData.status || 'REQUESTED', bookingData.scheduled_start || now, bookingData.scheduled_end || now, bookingData.lat || 19.1197, bookingData.lng || 72.8464, now);
        return this.findById(id);
    }
    static findById(id) {
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
        return sqlite_1.db.prepare(query).get(id);
    }
    static updateStatus(id, status, actualCompletion) {
        if (actualCompletion) {
            sqlite_1.db.prepare('UPDATE bookings SET status = ?, actual_completion = ? WHERE id = ?').run(status, actualCompletion, id);
        }
        else {
            sqlite_1.db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
        }
        return this.findById(id);
    }
    static findByUserIdAndRole(userId, role) {
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
        const params = [];
        if (userId && role) {
            if (role === 'WORKER') {
                query += ' WHERE wp.id = ? OR wp.user_id = ?';
                params.push(userId, userId);
            }
            else if (role === 'CUSTOMER') {
                query += ' WHERE cp.id = ? OR cp.user_id = ?';
                params.push(userId, userId);
            }
            else if (role === 'CONTRACTOR') {
                query += ' WHERE b.contractor_id = ? OR c.user_id = ?';
                params.push(userId, userId);
            }
        }
        query += ' ORDER BY b.created_at DESC';
        return sqlite_1.db.prepare(query).all(...params);
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
        return sqlite_1.db.prepare(query).all();
    }
}
exports.BookingRepository = BookingRepository;
