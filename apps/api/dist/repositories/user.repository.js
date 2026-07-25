"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
class UserRepository {
    static findById(id) {
        return sqlite_1.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    static findWorkerProfileByUserId(userId) {
        return sqlite_1.db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(userId);
    }
    static findWorkerProfileById(id) {
        return sqlite_1.db.prepare('SELECT * FROM worker_profiles WHERE id = ?').get(id);
    }
    static findContractorProfileByUserId(userId) {
        return sqlite_1.db.prepare('SELECT * FROM contractor_profiles WHERE user_id = ?').get(userId);
    }
    static findContractorProfileById(id) {
        return sqlite_1.db.prepare('SELECT * FROM contractor_profiles WHERE id = ?').get(id);
    }
    static findCustomerProfileByUserId(userId) {
        return sqlite_1.db.prepare('SELECT * FROM customer_profiles WHERE user_id = ?').get(userId);
    }
    static findCustomerProfileById(id) {
        return sqlite_1.db.prepare('SELECT * FROM customer_profiles WHERE id = ?').get(id);
    }
    static updateWorkerAvailability(workerId, status, via = 'SYSTEM_AUTO') {
        sqlite_1.db.serialize(() => {
            sqlite_1.db.prepare('UPDATE worker_profiles SET availability_status = ? WHERE id = ?').run(status, workerId);
            sqlite_1.db.prepare(`
        INSERT INTO availability_log (id, worker_id, status, set_via, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run((0, uuid_1.v4)(), workerId, status, via, new Date().toISOString());
        });
    }
    static findAvailableWorkersBySkill(skill) {
        // Get all workers
        const profiles = sqlite_1.db.prepare('SELECT * FROM worker_profiles').all();
        // Filter in JS because JSON parsing in SQL is simulated
        return profiles.filter(w => {
            try {
                const skillsArr = typeof w.skills === 'string' ? JSON.parse(w.skills) : w.skills;
                const hasSkill = Array.isArray(skillsArr) && skillsArr.some((s) => s.toLowerCase().trim() === skill.toLowerCase().trim());
                const isAvailable = w.availability_status === 'AVAILABLE';
                return hasSkill && isAvailable;
            }
            catch (e) {
                return false;
            }
        });
    }
    static findAllWorkers() {
        return sqlite_1.db.prepare('SELECT * FROM worker_profiles').all();
    }
    static findAllContractors() {
        return sqlite_1.db.prepare('SELECT * FROM contractor_profiles').all();
    }
}
exports.UserRepository = UserRepository;
