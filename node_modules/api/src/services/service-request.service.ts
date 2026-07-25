import { ServiceRequestRepository } from '../repositories/service-request.repository';
import { AgentOrchestrator } from '../orchestration/pipeline';

export class ServiceRequestService {
  static async createServiceRequest(customerId: string, rawText: string) {
    const result = await AgentOrchestrator.runCustomerMatchingPipeline(customerId, rawText);
    return result;
  }

  static getServiceRequest(id: string) {
    const request = ServiceRequestRepository.findById(id);
    if (!request) return null;
    return {
      ...request,
      extracted_skills: typeof request.extracted_skills === 'string' ? JSON.parse(request.extracted_skills) : request.extracted_skills
    };
  }

  static getCustomerRequests(customerId: string) {
    const requests = ServiceRequestRepository.findByCustomerId(customerId);
    return requests.map(r => ({
      ...r,
      extracted_skills: typeof r.extracted_skills === 'string' ? JSON.parse(r.extracted_skills) : r.extracted_skills
    }));
  }

  static updateStatus(id: string, status: string, acceptedById?: string, acceptedByType?: string) {
    return ServiceRequestRepository.updateStatus(id, status, acceptedById, acceptedByType);
  }
}
