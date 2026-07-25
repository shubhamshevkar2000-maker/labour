import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export class UserRepository {
  static findById(id: string) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  }

  static findWorkerProfileByUserId(userId: string) {
    return db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(userId) as any;
  }

  static findWorkerProfileById(id: string) {
    return db.prepare('SELECT * FROM worker_profiles WHERE id = ?').get(id) as any;
  }

  static findContractorProfileByUserId(userId: string) {
    return db.prepare('SELECT * FROM contractor_profiles WHERE user_id = ?').get(userId) as any;
  }

  static findContractorProfileById(id: string) {
    return db.prepare('SELECT * FROM contractor_profiles WHERE id = ?').get(id) as any;
  }

  static findCustomerProfileByUserId(userId: string) {
    return db.prepare('SELECT * FROM customer_profiles WHERE user_id = ?').get(userId) as any;
  }

  static findCustomerProfileById(id: string) {
    return db.prepare('SELECT * FROM customer_profiles WHERE id = ?').get(id) as any;
  }

  static updateWorkerAvailability(workerId: string, status: string, via: string = 'SYSTEM_AUTO') {
    db.serialize(() => {
      db.prepare('UPDATE worker_profiles SET availability_status = ? WHERE id = ?').run(status, workerId);
      db.prepare(`
        INSERT INTO availability_log (id, worker_id, status, set_via, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), workerId, status, via, new Date().toISOString());
    });
  }

  static findAvailableWorkersBySkill(skill: string) {
    // Get all workers
    const profiles = db.prepare('SELECT * FROM worker_profiles').all() as any[];
    // Filter in JS because JSON parsing in SQL is simulated
    return profiles.filter(w => {
      try {
        const skillsArr = typeof w.skills === 'string' ? JSON.parse(w.skills) : w.skills;
        const hasSkill = Array.isArray(skillsArr) && skillsArr.some((s: string) => s.toLowerCase().trim() === skill.toLowerCase().trim());
        const isAvailable = w.availability_status === 'AVAILABLE';
        return hasSkill && isAvailable;
      } catch (e) {
        return false;
      }
    });
  }

  static findAllWorkers() {
    return db.prepare('SELECT * FROM worker_profiles').all() as any[];
  }

  static findAllContractors() {
    return db.prepare('SELECT * FROM contractor_profiles').all() as any[];
  }
}
