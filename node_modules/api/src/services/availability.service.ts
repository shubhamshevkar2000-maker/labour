import { db } from '../db/sqlite';

export interface CalculatedAvailability {
  status: 'AVAILABLE' | 'BUSY';
  available_today: boolean;
  busy_until: string | null;
  next_available: string;
  active_booking_id: string | null;
}

export class AvailabilityService {
  static getWorkerAvailability(workerId: string): CalculatedAvailability {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Find active accepted bookings for worker
    const activeBookings = db.prepare(`
      SELECT * FROM bookings 
      WHERE worker_id = ? AND status IN ('ACCEPTED', 'IN_PROGRESS')
      ORDER BY scheduled_end DESC
    `).all(workerId) as any[];

    if (activeBookings.length > 0) {
      const latestBooking = activeBookings[0];
      const endDate = new Date(latestBooking.scheduled_end || Date.now());
      const nextAvailDate = new Date(endDate.getTime() + 24 * 3600 * 1000);

      const busyUntilStr = endDate.toISOString().split('T')[0];
      const nextAvailStr = nextAvailDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

      // If scheduled end is in the future
      if (endDate >= now) {
        return {
          status: 'BUSY',
          available_today: false,
          busy_until: busyUntilStr,
          next_available: nextAvailStr,
          active_booking_id: latestBooking.id
        };
      }
    }

    return {
      status: 'AVAILABLE',
      available_today: true,
      busy_until: null,
      next_available: 'Today',
      active_booking_id: null
    };
  }
}
