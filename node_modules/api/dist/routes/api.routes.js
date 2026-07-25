"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const api_controller_1 = __importDefault(require("../controllers/api.controller"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// --- PUBLIC ROUTES ---
router.post('/auth/register', api_controller_1.default.register);
router.post('/auth/login', api_controller_1.default.login);
router.get('/customer/skills', api_controller_1.default.getSkillsTaxonomy);
router.get('/debug/counts', api_controller_1.default.getDebugCounts);
router.get('/debug/seed', api_controller_1.default.runSeedEndpoint);
// --- AUTHENTICATED ROUTES ---
router.get('/auth/me', auth_1.authenticate, api_controller_1.default.me);
router.post('/auth/logout', auth_1.authenticate, api_controller_1.default.logout);
// Worker Routes
router.get('/workers/:id/profile', auth_1.authenticate, api_controller_1.default.getWorkerProfile);
router.get('/workers/:id/trust-score', auth_1.authenticate, api_controller_1.default.getWorkerTrustScore);
router.get('/workers/:id/trust-score/history', auth_1.authenticate, api_controller_1.default.getWorkerTrustScoreHistory);
router.get('/workers/:id/verification-records', auth_1.authenticate, api_controller_1.default.getWorkerVerificationRecords);
router.post('/workers/:id/verification-records', auth_1.authenticate, api_controller_1.default.submitWorkerVerification);
router.patch('/workers/:id/availability', auth_1.authenticate, api_controller_1.default.updateWorkerAvailability);
router.post('/workers/:id/endorsements', auth_1.authenticate, api_controller_1.default.submitEndorsement);
router.get('/workers/:id/endorsements', auth_1.authenticate, api_controller_1.default.getWorkerEndorsements);
router.get('/workers/:id/opportunities', auth_1.authenticate, api_controller_1.default.getWorkerOpportunities);
// Job Routes
router.post('/jobs/requirements', auth_1.authenticate, api_controller_1.default.postJobRequirement);
router.get('/jobs/requirements/:id', auth_1.authenticate, api_controller_1.default.getJobRequirement);
router.get('/jobs/requirements/:requirementId/recommendations', auth_1.authenticate, api_controller_1.default.getRecommendations);
router.post('/jobs/offers', auth_1.authenticate, api_controller_1.default.createJobOffer);
router.patch('/jobs/:id/accept', auth_1.authenticate, api_controller_1.default.acceptJob);
router.post('/jobs/:id/complete', auth_1.authenticate, api_controller_1.default.completeJob);
router.post('/jobs/:id/payments', auth_1.authenticate, api_controller_1.default.submitPayment);
router.post('/jobs/:id/ratings', auth_1.authenticate, api_controller_1.default.submitRating);
router.get('/jobs', auth_1.authenticate, api_controller_1.default.getJobs);
// Customer Bookings & Requests Routes (NEW)
router.get('/customer/find-contractors', auth_1.authenticate, api_controller_1.default.findContractors);
router.get('/customer/find-workers', auth_1.authenticate, api_controller_1.default.findWorkers);
router.post('/customer/service-requests', auth_1.authenticate, api_controller_1.default.postServiceRequest);
router.get('/customer/service-requests/:id', auth_1.authenticate, api_controller_1.default.getServiceRequest);
router.get('/customer/service-requests/:id/recommendations', auth_1.authenticate, api_controller_1.default.getCustomerRecommendations);
router.get('/bookings', auth_1.authenticate, api_controller_1.default.getBookings);
router.post('/bookings', auth_1.authenticate, api_controller_1.default.createBooking);
router.patch('/bookings/:id/accept', auth_1.authenticate, api_controller_1.default.acceptBooking);
router.patch('/bookings/:id/start', auth_1.authenticate, api_controller_1.default.startBooking);
router.post('/bookings/:id/complete', auth_1.authenticate, api_controller_1.default.completeBooking);
router.post('/bookings/:id/payments', auth_1.authenticate, api_controller_1.default.submitBookingPayment);
router.post('/bookings/:id/ratings', auth_1.authenticate, api_controller_1.default.submitBookingRating);
// Contractor & Assignment Routes
router.post('/contractor/assign-worker', auth_1.authenticate, api_controller_1.default.assignWorkerToProject);
router.get('/bookings/:id/assignments', auth_1.authenticate, api_controller_1.default.getAssignmentsForBooking);
router.patch('/assignments/:id/respond', auth_1.authenticate, api_controller_1.default.respondToAssignment);
router.get('/workers/:id/assignments', auth_1.authenticate, api_controller_1.default.getAssignmentsForWorker);
// Timeline (NEW)
router.get('/users/:id/timeline', auth_1.authenticate, api_controller_1.default.getUserTimeline);
// Voice Routes
router.post('/voice/command', auth_1.authenticate, api_controller_1.default.submitVoiceCommand);
router.get('/voice/command/:id', auth_1.authenticate, api_controller_1.default.getVoiceCommand);
router.post('/voice/command/:id/clarify', auth_1.authenticate, api_controller_1.default.clarifyVoiceCommand);
router.get('/voice/command/:id/transcript', auth_1.authenticate, api_controller_1.default.getVoiceCommandTranscript);
// Engagement & Negotiation Routes
router.post('/requests/:id/engage', auth_1.authenticate, api_controller_1.default.startEngagement);
router.get('/engagements/:id', auth_1.authenticate, api_controller_1.default.getEngagement);
router.get('/engagements', auth_1.authenticate, api_controller_1.default.getEngagements);
router.post('/engagements/:id/propose', auth_1.authenticate, api_controller_1.default.proposePriceOffer);
router.post('/engagements/:id/respond', auth_1.authenticate, api_controller_1.default.respondToProposal);
router.post('/engagements/:id/status', auth_1.authenticate, api_controller_1.default.updateEngagementStatus);
// Disputes Routes
router.post('/disputes', auth_1.authenticate, api_controller_1.default.raiseDispute);
router.get('/disputes/:id', auth_1.authenticate, api_controller_1.default.getDispute);
router.get('/disputes', auth_1.authenticate, api_controller_1.default.getDisputes);
router.patch('/disputes/:id/resolve', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.resolveDispute);
// Admin Routes (Admin Only)
router.get('/admin/fraud-flags', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.getFraudFlags);
router.patch('/admin/fraud-flags/:id', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.resolveFraudFlag);
router.get('/admin/agent-runs', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.getAgentRuns);
router.get('/admin/admin-actions', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.getAdminActions);
router.get('/admin/auth-sessions', auth_1.authenticate, (0, auth_1.requireRole)(['ADMIN']), api_controller_1.default.getAuthSessions);
// Analytics
router.get('/analytics/workforce-summary', auth_1.authenticate, api_controller_1.default.getWorkforceSummary);
// Notifications
router.get('/notifications', auth_1.authenticate, api_controller_1.default.getNotifications);
router.patch('/notifications/:id/read', auth_1.authenticate, api_controller_1.default.markNotificationRead);
// Consent
router.post('/consent', auth_1.authenticate, api_controller_1.default.recordConsent);
router.get('/consent/:userId', auth_1.authenticate, api_controller_1.default.getConsent);
exports.default = router;
