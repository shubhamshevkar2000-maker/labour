import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export class NotificationRepository {
  static create(notification: {
    user_id: string;
    role: string;
    title: string;
    message: string;
  }) {
    const id = uuidv4();
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
    db.prepare(`
      INSERT INTO notifications (id, user_id, channel, type, payload, delivered, read_at, created_at)
      VALUES (?, ?, 'IN_APP', 'BOOKING_REQUEST', ?, 1, NULL, ?)
    `).run(
      record.id,
      record.user_id,
      JSON.stringify({ title: record.title, message: record.message, role: record.role }),
      record.created_at
    );
    return record;
  }

  static getByUserId(userId: string) {
    return db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as any[];
  }

  static markAsRead(id: string) {
    db.prepare(`
      UPDATE notifications SET read_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);
  }
}
