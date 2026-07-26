"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_repository_1 = require("../repositories/notification.repository");
class NotificationService {
    static createNotification(userId, role, title, message) {
        return notification_repository_1.NotificationRepository.create({ user_id: userId, role, title, message });
    }
    static getNotifications(userId) {
        return notification_repository_1.NotificationRepository.getByUserId(userId);
    }
    static markAsRead(id) {
        return notification_repository_1.NotificationRepository.markAsRead(id);
    }
}
exports.NotificationService = NotificationService;
