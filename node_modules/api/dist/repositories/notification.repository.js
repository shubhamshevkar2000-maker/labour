"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = void 0;
const sqlite_1 = require("../db/sqlite");
const uuid_1 = require("uuid");
class NotificationRepository {
    static create(notification) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: notification.user_id,
            role: notification.role,
            title: notification.title,
            message: notification.message,
            is_read: 0,
            created_at: now
        };
        sqlite_1.db.prepare(`
      INSERT INTO notifications (id, user_id, channel, type, payload, delivered, read_at, created_at)
      VALUES (?, ?, 'IN_APP', 'BOOKING_REQUEST', ?, 1, NULL, ?)
    `).run(record.id, record.user_id, JSON.stringify({ title: record.title, message: record.message, role: record.role }), record.created_at);
        return record;
    }
    static getByUserId(userId) {
        return sqlite_1.db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
    }
    static markAsRead(id) {
        sqlite_1.db.prepare(`
      UPDATE notifications SET read_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);
    }
}
exports.NotificationRepository = NotificationRepository;
