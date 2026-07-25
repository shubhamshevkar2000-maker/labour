import { NotificationRepository } from '../repositories/notification.repository';

export class NotificationService {
  static createNotification(userId: string, role: string, title: string, message: string) {
    return NotificationRepository.create({ user_id: userId, role, title, message });
  }

  static getNotifications(userId: string) {
    return NotificationRepository.getByUserId(userId);
  }

  static markAsRead(id: string) {
    return NotificationRepository.markAsRead(id);
  }
}
