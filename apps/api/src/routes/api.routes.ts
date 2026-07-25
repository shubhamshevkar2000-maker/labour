import express from 'express';
import ApiController from '../controllers/api.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

// --- PUBLIC ROUTES ---
router.post('/auth/register', ApiController.register);
router.post('/auth/login', ApiController.login);
router.get('/customer/skills', ApiController.getSkillsTaxonomy);
router.get('/debug/counts', ApiController.getDebugCounts);
router.get('/debug/seed', ApiController.runSeedEndpoint);

// --- AUTHENTICATED ROUTES ---
router.get('/auth/me', authenticate, ApiController.me);
router.post('/auth/logout', authenticate, ApiController.logout);

// Worker Routes
router.get('/workers/:id/profile', authenticate, ApiController.getWorkerProfile);
router.get('/workers/:id/trust-score', authenticate, ApiController.getWorkerTrustScore);
router.get('/workers/:id/trust-score/history', authenticate, ApiController.getWorkerTrustScoreHistory);
router.get('/workers/:id/verification-records', authenticate, ApiController.getWorkerVerificationRecords);
router.post('/workers/:id/verification-records', authenticate, ApiController.submitWorkerVerification);
router.patch('/workers/:id/availability', authenticate, ApiController.updateWorkerAvailability);
router.post('/workers/:id/endorsements', authenticate, ApiController.submitEndorsement);
router.get('/workers/:id/endorsements', authenticate, ApiController.getWorkerEndorsements);
router.get('/workers/:id/opportunities', authenticate, ApiController.getWorkerOpportunities);

// Job Routes
router.post('/jobs/requirements', authenticate, ApiController.postJobRequirement);
router.get('/jobs/requirements/:id', authenticate, ApiController.getJobRequirement);
router.get('/jobs/requirements/:requirementId/recommendations', authenticate, ApiController.getRecommendations);
router.post('/jobs/offers', authenticate, ApiController.createJobOffer);
router.patch('/jobs/:id/accept', authenticate, ApiController.acceptJob);
router.post('/jobs/:id/complete', authenticate, ApiController.completeJob);
router.post('/jobs/:id/payments', authenticate, ApiController.submitPayment);
router.post('/jobs/:id/ratings', authenticate, ApiController.submitRating);
router.get('/jobs', authenticate, ApiController.getJobs);

// Customer Bookings & Requests Routes (NEW)
router.get('/customer/find-contractors', authenticate, ApiController.findContractors);
router.get('/customer/find-workers', authenticate, ApiController.findWorkers);
router.post('/customer/service-requests', authenticate, ApiController.postServiceRequest);
router.get('/customer/service-requests/:id', authenticate, ApiController.getServiceRequest);
router.get('/customer/service-requests/:id/recommendations', authenticate, ApiController.getCustomerRecommendations);
router.get('/bookings', authenticate, ApiController.getBookings);
router.post('/bookings', authenticate, ApiController.createBooking);
router.patch('/bookings/:id/accept', authenticate, ApiController.acceptBooking);
router.patch('/bookings/:id/start', authenticate, ApiController.startBooking);
router.post('/bookings/:id/complete', authenticate, ApiController.completeBooking);
router.post('/bookings/:id/payments', authenticate, ApiController.submitBookingPayment);
router.post('/bookings/:id/ratings', authenticate, ApiController.submitBookingRating);

// Contractor & Assignment Routes
router.post('/contractor/assign-worker', authenticate, ApiController.assignWorkerToProject);
router.get('/bookings/:id/assignments', authenticate, ApiController.getAssignmentsForBooking);
router.patch('/assignments/:id/respond', authenticate, ApiController.respondToAssignment);
router.get('/workers/:id/assignments', authenticate, ApiController.getAssignmentsForWorker);

// Timeline (NEW)
router.get('/users/:id/timeline', authenticate, ApiController.getUserTimeline);

// Voice Routes
router.post('/voice/command', authenticate, ApiController.submitVoiceCommand);
router.get('/voice/command/:id', authenticate, ApiController.getVoiceCommand);
router.post('/voice/command/:id/clarify', authenticate, ApiController.clarifyVoiceCommand);
router.get('/voice/command/:id/transcript', authenticate, ApiController.getVoiceCommandTranscript);

// Engagement & Negotiation Routes
router.post('/requests/:id/engage', authenticate, ApiController.startEngagement);
router.get('/engagements/:id', authenticate, ApiController.getEngagement);
router.get('/engagements', authenticate, ApiController.getEngagements);
router.post('/engagements/:id/propose', authenticate, ApiController.proposePriceOffer);
router.post('/engagements/:id/respond', authenticate, ApiController.respondToProposal);
router.post('/engagements/:id/status', authenticate, ApiController.updateEngagementStatus);

// Disputes Routes
router.post('/disputes', authenticate, ApiController.raiseDispute);
router.get('/disputes/:id', authenticate, ApiController.getDispute);
router.get('/disputes', authenticate, ApiController.getDisputes);
router.patch('/disputes/:id/resolve', authenticate, requireRole(['ADMIN']), ApiController.resolveDispute);

// Admin Routes (Admin Only)
router.get('/admin/fraud-flags', authenticate, requireRole(['ADMIN']), ApiController.getFraudFlags);
router.patch('/admin/fraud-flags/:id', authenticate, requireRole(['ADMIN']), ApiController.resolveFraudFlag);
router.get('/admin/agent-runs', authenticate, requireRole(['ADMIN']), ApiController.getAgentRuns);
router.get('/admin/admin-actions', authenticate, requireRole(['ADMIN']), ApiController.getAdminActions);
router.get('/admin/auth-sessions', authenticate, requireRole(['ADMIN']), ApiController.getAuthSessions);

// Analytics
router.get('/analytics/workforce-summary', authenticate, ApiController.getWorkforceSummary);

// Notifications
router.get('/notifications', authenticate, ApiController.getNotifications);
router.patch('/notifications/:id/read', authenticate, ApiController.markNotificationRead);

// Consent
router.post('/consent', authenticate, ApiController.recordConsent);
router.get('/consent/:userId', authenticate, ApiController.getConsent);

export default router;
