"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const booking_repository_1 = require("../repositories/booking.repository");
const service_request_repository_1 = require("../repositories/service-request.repository");
const user_repository_1 = require("../repositories/user.repository");
const notification_service_1 = require("./notification.service");
const trust_agent_1 = __importDefault(require("../agents/trust-agent"));
class BookingService {
    static async bookWorker(serviceRequestId, customerId, workerId) {
        const sr = service_request_repository_1.ServiceRequestRepository.findById(serviceRequestId);
        if (!sr)
            throw new Error('Service Request not found');
        const booking = booking_repository_1.BookingRepository.create({
            service_request_id: serviceRequestId,
            customer_id: customerId,
            worker_id: workerId,
            status: 'REQUESTED',
            lat: sr.lat,
            lng: sr.lng,
            scheduled_start: sr.urgency_window_start,
            scheduled_end: sr.urgency_window_end
        });
        // Update service request status to MATCHED
        service_request_repository_1.ServiceRequestRepository.updateStatus(serviceRequestId, 'MATCHED');
        // Notify worker
        const workerProfile = user_repository_1.UserRepository.findWorkerProfileById(workerId);
        if (workerProfile) {
            notification_service_1.NotificationService.createNotification(workerProfile.user_id, 'WORKER', 'Naya Kaam Request received!', `Customer has requested you for work: "${sr.raw_text}"`);
        }
        if (workerId) {
            await trust_agent_1.default.run(workerId);
        }
        return booking;
    }
    static async bookContractor(serviceRequestId, customerId, contractorId) {
        const sr = service_request_repository_1.ServiceRequestRepository.findById(serviceRequestId);
        if (!sr)
            throw new Error('Service Request not found');
        const booking = booking_repository_1.BookingRepository.create({
            service_request_id: serviceRequestId,
            customer_id: customerId,
            contractor_id: contractorId,
            status: 'REQUESTED',
            lat: sr.lat,
            lng: sr.lng,
            scheduled_start: sr.urgency_window_start,
            scheduled_end: sr.urgency_window_end
        });
        // Update service request status to MATCHED
        service_request_repository_1.ServiceRequestRepository.updateStatus(serviceRequestId, 'MATCHED');
        // Notify contractor
        const contractorProfile = user_repository_1.UserRepository.findContractorProfileById(contractorId);
        if (contractorProfile) {
            notification_service_1.NotificationService.createNotification(contractorProfile.user_id, 'CONTRACTOR', 'Naya Project Booking received!', `Customer has booked your service for project: "${sr.raw_text}"`);
        }
        return booking;
    }
    static async acceptBooking(id) {
        const booking = booking_repository_1.BookingRepository.findById(id);
        if (!booking)
            throw new Error('Booking not found');
        // Update status to ACCEPTED
        const updated = booking_repository_1.BookingRepository.updateStatus(id, 'ACCEPTED');
        // Also update Service Request status to ACCEPTED
        service_request_repository_1.ServiceRequestRepository.updateStatus(booking.service_request_id, 'ACCEPTED', booking.worker_id || booking.contractor_id, booking.worker_id ? 'WORKER' : 'CONTRACTOR');
        // If Worker booking, set worker status to BUSY
        if (booking.worker_id) {
            user_repository_1.UserRepository.updateWorkerAvailability(booking.worker_id, 'BUSY', 'SYSTEM_AUTO');
            await trust_agent_1.default.run(booking.worker_id);
            // Notify customer
            const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
            if (customerProfile) {
                notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Booking swikar kar liya gaya hai!', `Worker has accepted your booking request.`);
            }
        }
        else if (booking.contractor_id) {
            // Notify customer
            const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
            if (customerProfile) {
                notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Project accepted by Contractor!', `Contractor has accepted your project booking.`);
            }
        }
        return updated;
    }
    static async startBooking(id) {
        const booking = booking_repository_1.BookingRepository.findById(id);
        if (!booking)
            throw new Error('Booking not found');
        const updated = booking_repository_1.BookingRepository.updateStatus(id, 'IN_PROGRESS');
        service_request_repository_1.ServiceRequestRepository.updateStatus(booking.service_request_id, 'IN_PROGRESS');
        // Notify customer
        const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
        if (customerProfile) {
            notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Work In Progress!', `The work has started.`);
        }
        return updated;
    }
    static async completeBooking(id) {
        const booking = booking_repository_1.BookingRepository.findById(id);
        if (!booking)
            throw new Error('Booking not found');
        const now = new Date().toISOString();
        const updated = booking_repository_1.BookingRepository.updateStatus(id, 'COMPLETED', now);
        service_request_repository_1.ServiceRequestRepository.updateStatus(booking.service_request_id, 'COMPLETED');
        // If Worker booking, reset worker availability status to AVAILABLE
        if (booking.worker_id) {
            user_repository_1.UserRepository.updateWorkerAvailability(booking.worker_id, 'AVAILABLE', 'SYSTEM_AUTO');
            await trust_agent_1.default.run(booking.worker_id);
            // Notify customer
            const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
            if (customerProfile) {
                notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Booking Completed!', `The worker has completed the booking.`);
            }
        }
        else if (booking.contractor_id) {
            // Notify customer
            const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
            if (customerProfile) {
                notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Project Completed!', `The contractor has completed the project.`);
            }
        }
        return updated;
    }
    static async cancelBooking(id) {
        const booking = booking_repository_1.BookingRepository.findById(id);
        if (!booking)
            throw new Error('Booking not found');
        const updated = booking_repository_1.BookingRepository.updateStatus(id, 'CANCELLED');
        service_request_repository_1.ServiceRequestRepository.updateStatus(booking.service_request_id, 'CANCELLED');
        // Reset worker availability if applicable
        if (booking.worker_id) {
            user_repository_1.UserRepository.updateWorkerAvailability(booking.worker_id, 'AVAILABLE', 'SYSTEM_AUTO');
            await trust_agent_1.default.run(booking.worker_id);
        }
        // Notify other party
        const customerProfile = user_repository_1.UserRepository.findCustomerProfileById(booking.customer_id);
        if (customerProfile) {
            notification_service_1.NotificationService.createNotification(customerProfile.user_id, 'CUSTOMER', 'Booking Cancelled', `The booking has been cancelled.`);
        }
        return updated;
    }
    static getBookingsForUser(userId, role) {
        return booking_repository_1.BookingRepository.findByUserIdAndRole(userId, role);
    }
    static getAllBookings() {
        return booking_repository_1.BookingRepository.findAll();
    }
}
exports.BookingService = BookingService;
