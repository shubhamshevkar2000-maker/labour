import { AssignmentRepository } from '../repositories/assignment.repository';
import { BookingRepository } from '../repositories/booking.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';
import TrustAgent from '../agents/trust-agent';

export class AssignmentService {
  static async assignWorkerToProject(bookingId: string, workerId: string, assignedBy: string, remarks?: string) {
    const booking = BookingRepository.findById(bookingId);
    if (!booking) throw new Error('Booking/Project not found');

    const assignment = AssignmentRepository.create({
      booking_id: bookingId,
      worker_id: workerId,
      assigned_by: assignedBy,
      remarks
    });

    // Notify worker
    const workerProfile = UserRepository.findWorkerProfileById(workerId);
    if (workerProfile) {
      NotificationService.createNotification(
        workerProfile.user_id,
        'WORKER',
        'Naya Project Assignment!',
        `Contractor has assigned you to project booking: "${booking.requirement_text}"`
      );
    }

    return assignment;
  }

  static getAssignmentsForBooking(bookingId: string) {
    return AssignmentRepository.findByBookingId(bookingId);
  }

  static getAssignmentsForWorker(workerId: string) {
    return AssignmentRepository.findByWorkerId(workerId);
  }

  static async respondToAssignment(assignmentId: string, response: 'ACCEPTED' | 'REJECTED') {
    const assignment = AssignmentRepository.findById(assignmentId);
    if (!assignment) throw new Error('Assignment not found');

    const updated = AssignmentRepository.updateStatus(assignmentId, response);

    // If accepted, update worker status to BUSY
    if (response === 'ACCEPTED') {
      UserRepository.updateWorkerAvailability(assignment.worker_id, 'BUSY', 'SYSTEM_AUTO');
      await TrustAgent.run(assignment.worker_id);
    }

    // Notify contractor
    const contractor = UserRepository.findContractorProfileById(assignment.assigned_by) || UserRepository.findContractorProfileByUserId(assignment.assigned_by);
    if (contractor) {
      NotificationService.createNotification(
        contractor.user_id,
        'CONTRACTOR',
        `Worker Assignment ${response.toLowerCase()}!`,
        `Worker has ${response.toLowerCase()} your project assignment request.`
      );
    }

    return updated;
  }
}
