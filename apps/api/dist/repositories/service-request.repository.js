"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestRepository = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
class ServiceRequestRepository {
    static create(reqData) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const skillsJson = JSON.stringify(reqData.extracted_skills);
        sqlite_1.db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, raw_text, extracted_skills, lat, lng, 
        urgency_window_start, urgency_window_end, budget_min, budget_max, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?)
    `).run(id, reqData.customer_id, reqData.raw_text, skillsJson, reqData.lat || 19.1197, reqData.lng || 72.8464, reqData.urgency_window_start || now, reqData.urgency_window_end || now, reqData.budget_min || 0, reqData.budget_max || 0, now);
        return this.findById(id);
    }
    static findById(id) {
        return sqlite_1.db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id);
    }
    static updateStatus(id, status, acceptedById, acceptedByType) {
        if (acceptedById && acceptedByType) {
            sqlite_1.db.prepare(`
        UPDATE service_requests 
        SET status = ?, accepted_by_id = ?, accepted_by_type = ? 
        WHERE id = ?
      `).run(status, acceptedById, acceptedByType, id);
        }
        else {
            sqlite_1.db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').run(status, id);
        }
        return this.findById(id);
    }
    static findByCustomerId(customerId) {
        return sqlite_1.db.prepare('SELECT * FROM service_requests WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
    }
    static findAll() {
        return sqlite_1.db.prepare('SELECT * FROM service_requests ORDER BY created_at DESC').all();
    }
}
exports.ServiceRequestRepository = ServiceRequestRepository;
