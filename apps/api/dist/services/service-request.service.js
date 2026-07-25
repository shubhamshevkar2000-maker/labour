"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestService = void 0;
const service_request_repository_1 = require("../repositories/service-request.repository");
const pipeline_1 = require("../orchestration/pipeline");
class ServiceRequestService {
    static async createServiceRequest(customerId, rawText) {
        const result = await pipeline_1.AgentOrchestrator.runCustomerMatchingPipeline(customerId, rawText);
        return result;
    }
    static getServiceRequest(id) {
        const request = service_request_repository_1.ServiceRequestRepository.findById(id);
        if (!request)
            return null;
        return {
            ...request,
            extracted_skills: typeof request.extracted_skills === 'string' ? JSON.parse(request.extracted_skills) : request.extracted_skills
        };
    }
    static getCustomerRequests(customerId) {
        const requests = service_request_repository_1.ServiceRequestRepository.findByCustomerId(customerId);
        return requests.map(r => ({
            ...r,
            extracted_skills: typeof r.extracted_skills === 'string' ? JSON.parse(r.extracted_skills) : r.extracted_skills
        }));
    }
    static updateStatus(id, status, acceptedById, acceptedByType) {
        return service_request_repository_1.ServiceRequestRepository.updateStatus(id, status, acceptedById, acceptedByType);
    }
}
exports.ServiceRequestService = ServiceRequestService;
