"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentService = void 0;
const assignment_repository_1 = require("../repositories/assignment.repository");
const booking_repository_1 = require("../repositories/booking.repository");
const user_repository_1 = require("../repositories/user.repository");
const notification_service_1 = require("./notification.service");
const trust_agent_1 = __importDefault(require("../agents/trust-agent"));
class AssignmentService {
    static async assignWorkerToProject(bookingId, workerId, assignedBy, remarks) {
        const booking = booking_repository_1.BookingRepository.findById(bookingId);
        if (!booking)
            throw new Error('Booking/Project not found');
        const assignment = assignment_repository_1.AssignmentRepository.create({
            booking_id: bookingId,
            worker_id: workerId,
            assigned_by: assignedBy,
            remarks
        });
        // Notify worker
        const workerProfile = user_repository_1.UserRepository.findWorkerProfileById(workerId);
        if (workerProfile) {
            notification_service_1.NotificationService.createNotification(workerProfile.user_id, 'WORKER', 'Naya Project Assignment!', `Contractor has assigned you to project booking: "${booking.requirement_text}"`);
        }
        return assignment;
    }
    static getAssignmentsForBooking(bookingId) {
        return assignment_repository_1.AssignmentRepository.findByBookingId(bookingId);
    }
    static getAssignmentsForWorker(workerId) {
        return assignment_repository_1.AssignmentRepository.findByWorkerId(workerId);
    }
    static async respondToAssignment(assignmentId, response) {
        const assignment = assignment_repository_1.AssignmentRepository.findById(assignmentId);
        if (!assignment)
            throw new Error('Assignment not found');
        const updated = assignment_repository_1.AssignmentRepository.updateStatus(assignmentId, response);
        // If accepted, update worker status to BUSY
        if (response === 'ACCEPTED') {
            user_repository_1.UserRepository.updateWorkerAvailability(assignment.worker_id, 'BUSY', 'SYSTEM_AUTO');
            await trust_agent_1.default.run(assignment.worker_id);
        }
        // Notify contractor
        const contractor = user_repository_1.UserRepository.findContractorProfileById(assignment.assigned_by) || user_repository_1.UserRepository.findContractorProfileByUserId(assignment.assigned_by);
        if (contractor) {
            notification_service_1.NotificationService.createNotification(contractor.user_id, 'CONTRACTOR', `Worker Assignment ${response.toLowerCase()}!`, `Worker has ${response.toLowerCase()} your project assignment request.`);
        }
        return updated;
    }
}
exports.AssignmentService = AssignmentService;
