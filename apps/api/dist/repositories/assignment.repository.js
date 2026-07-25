"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentRepository = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
class AssignmentRepository {
    static create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        sqlite_1.db.prepare(`
      INSERT INTO assignments (id, booking_id, worker_id, status, assigned_by, assigned_at, remarks)
      VALUES (?, ?, ?, 'ASSIGNED', ?, ?, ?)
    `).run(id, data.booking_id, data.worker_id, data.assigned_by, now, data.remarks || null);
        return this.findById(id);
    }
    static findById(id) {
        const query = `
      SELECT a.*, u.full_name as worker_name, wp.skills as worker_skills
      FROM assignments a
      JOIN worker_profiles wp ON a.worker_id = wp.id
      JOIN users u ON wp.user_id = u.id
      WHERE a.id = ?
    `;
        return sqlite_1.db.prepare(query).get(id);
    }
    static updateStatus(id, status) {
        sqlite_1.db.prepare('UPDATE assignments SET status = ? WHERE id = ?').run(status, id);
        return this.findById(id);
    }
    static findByBookingId(bookingId) {
        const query = `
      SELECT a.*, u.full_name as worker_name, wp.skills as worker_skills, wp.availability_status
      FROM assignments a
      JOIN worker_profiles wp ON a.worker_id = wp.id
      JOIN users u ON wp.user_id = u.id
      WHERE a.booking_id = ?
    `;
        return sqlite_1.db.prepare(query).all(bookingId);
    }
    static findByWorkerId(workerId) {
        const query = `
      SELECT a.*, u.full_name as worker_name, wp.skills as worker_skills,
             b.scheduled_start, b.status as booking_status, sr.raw_text as requirement_text,
             c.company_name as contractor_company, uc.full_name as contractor_name
      FROM assignments a
      JOIN worker_profiles wp ON a.worker_id = wp.id
      JOIN users u ON wp.user_id = u.id
      JOIN bookings b ON a.booking_id = b.id
      JOIN service_requests sr ON b.service_request_id = sr.id
      LEFT JOIN contractor_profiles c ON b.contractor_id = c.id
      LEFT JOIN users uc ON c.user_id = uc.id
      WHERE a.worker_id = ?
    `;
        return sqlite_1.db.prepare(query).all(workerId);
    }
    static findAll() {
        const query = `
      SELECT a.*, u.full_name as worker_name, wp.skills as worker_skills
      FROM assignments a
      JOIN worker_profiles wp ON a.worker_id = wp.id
      JOIN users u ON wp.user_id = u.id
    `;
        return sqlite_1.db.prepare(query).all();
    }
}
exports.AssignmentRepository = AssignmentRepository;
