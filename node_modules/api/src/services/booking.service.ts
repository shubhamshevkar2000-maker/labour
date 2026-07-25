import { BookingRepository } from '../repositories/booking.repository';
import { ServiceRequestRepository } from '../repositories/service-request.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';
import TrustAgent from '../agents/trust-agent';

export class BookingService {
  static async bookWorker(serviceRequestId: string, customerId: string, workerId: string) {
    const sr = ServiceRequestRepository.findById(serviceRequestId);
    if (!sr) throw new Error('Service Request not found');

    const booking = BookingRepository.create({
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
    ServiceRequestRepository.updateStatus(serviceRequestId, 'MATCHED');

    // Notify worker
    const workerProfile = UserRepository.findWorkerProfileById(workerId);
    if (workerProfile) {
      NotificationService.createNotification(
        workerProfile.user_id,
        'WORKER',
        'Naya Kaam Request received!',
        `Customer has requested you for work: "${sr.raw_text}"`
      );
    }

    if (workerId) {
      await TrustAgent.run(workerId);
    }

    return booking;
  }

  static async bookContractor(serviceRequestId: string, customerId: string, contractorId: string) {
    const sr = ServiceRequestRepository.findById(serviceRequestId);
    if (!sr) throw new Error('Service Request not found');

    const booking = BookingRepository.create({
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
    ServiceRequestRepository.updateStatus(serviceRequestId, 'MATCHED');

    // Notify contractor
    const contractorProfile = UserRepository.findContractorProfileById(contractorId);
    if (contractorProfile) {
      NotificationService.createNotification(
        contractorProfile.user_id,
        'CONTRACTOR',
        'Naya Project Booking received!',
        `Customer has booked your service for project: "${sr.raw_text}"`
      );
    }

    return booking;
  }

  static async acceptBooking(id: string) {
    const booking = BookingRepository.findById(id);
    if (!booking) throw new Error('Booking not found');

    // Update status to ACCEPTED
    const updated = BookingRepository.updateStatus(id, 'ACCEPTED');

    // Also update Service Request status to ACCEPTED
    ServiceRequestRepository.updateStatus(booking.service_request_id, 'ACCEPTED', booking.worker_id || booking.contractor_id, booking.worker_id ? 'WORKER' : 'CONTRACTOR');

    // If Worker booking, set worker status to BUSY
    if (booking.worker_id) {
      UserRepository.updateWorkerAvailability(booking.worker_id, 'BUSY', 'SYSTEM_AUTO');
      await TrustAgent.run(booking.worker_id);

      // Notify customer
      const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
      if (customerProfile) {
        NotificationService.createNotification(
          customerProfile.user_id,
          'CUSTOMER',
          'Booking swikar kar liya gaya hai!',
          `Worker has accepted your booking request.`
        );
      }
    } else if (booking.contractor_id) {
      // Notify customer
      const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
      if (customerProfile) {
        NotificationService.createNotification(
          customerProfile.user_id,
          'CUSTOMER',
          'Project accepted by Contractor!',
          `Contractor has accepted your project booking.`
        );
      }
    }

    return updated;
  }

  static async startBooking(id: string) {
    const booking = BookingRepository.findById(id);
    if (!booking) throw new Error('Booking not found');

    const updated = BookingRepository.updateStatus(id, 'IN_PROGRESS');
    ServiceRequestRepository.updateStatus(booking.service_request_id, 'IN_PROGRESS');

    // Notify customer
    const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
    if (customerProfile) {
      NotificationService.createNotification(
        customerProfile.user_id,
        'CUSTOMER',
        'Work In Progress!',
        `The work has started.`
      );
    }

    return updated;
  }

  static async completeBooking(id: string) {
    const booking = BookingRepository.findById(id);
    if (!booking) throw new Error('Booking not found');

    const now = new Date().toISOString();
    const updated = BookingRepository.updateStatus(id, 'COMPLETED', now);
    ServiceRequestRepository.updateStatus(booking.service_request_id, 'COMPLETED');

    // If Worker booking, reset worker availability status to AVAILABLE
    if (booking.worker_id) {
      UserRepository.updateWorkerAvailability(booking.worker_id, 'AVAILABLE', 'SYSTEM_AUTO');
      await TrustAgent.run(booking.worker_id);

      // Notify customer
      const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
      if (customerProfile) {
        NotificationService.createNotification(
          customerProfile.user_id,
          'CUSTOMER',
          'Booking Completed!',
          `The worker has completed the booking.`
        );
      }
    } else if (booking.contractor_id) {
      // Notify customer
      const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
      if (customerProfile) {
        NotificationService.createNotification(
          customerProfile.user_id,
          'CUSTOMER',
          'Project Completed!',
          `The contractor has completed the project.`
        );
      }
    }

    return updated;
  }

  static async cancelBooking(id: string) {
    const booking = BookingRepository.findById(id);
    if (!booking) throw new Error('Booking not found');

    const updated = BookingRepository.updateStatus(id, 'CANCELLED');
    ServiceRequestRepository.updateStatus(booking.service_request_id, 'CANCELLED');

    // Reset worker availability if applicable
    if (booking.worker_id) {
      UserRepository.updateWorkerAvailability(booking.worker_id, 'AVAILABLE', 'SYSTEM_AUTO');
      await TrustAgent.run(booking.worker_id);
    }

    // Notify other party
    const customerProfile = UserRepository.findCustomerProfileById(booking.customer_id);
    if (customerProfile) {
      NotificationService.createNotification(
        customerProfile.user_id,
        'CUSTOMER',
        'Booking Cancelled',
        `The booking has been cancelled.`
      );
    }

    return updated;
  }

  static getBookingsForUser(userId: string, role: string) {
    return BookingRepository.findByUserIdAndRole(userId, role);
  }

  static getAllBookings() {
    return BookingRepository.findAll();
  }
}
