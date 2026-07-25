import { UserRepository } from '../repositories/user.repository';

export class UserService {
  static getWorkerDetails(id: string) {
    const profile = UserRepository.findWorkerProfileById(id) || UserRepository.findWorkerProfileByUserId(id);
    if (!profile) return null;

    const user = UserRepository.findById(profile.user_id);
    return {
      ...profile,
      skills: typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills,
      full_name: user?.full_name || 'Worker',
      phone: user?.phone || '',
      email: user?.email || ''
    };
  }

  static getContractorDetails(id: string) {
    const profile = UserRepository.findContractorProfileById(id) || UserRepository.findContractorProfileByUserId(id);
    if (!profile) return null;

    const user = UserRepository.findById(profile.user_id);
    return {
      ...profile,
      full_name: user?.full_name || 'Contractor',
      phone: user?.phone || '',
      email: user?.email || ''
    };
  }

  static getCustomerDetails(id: string) {
    const profile = UserRepository.findCustomerProfileById(id) || UserRepository.findCustomerProfileByUserId(id);
    if (!profile) return null;

    const user = UserRepository.findById(profile.user_id);
    return {
      ...profile,
      full_name: user?.full_name || 'Customer',
      phone: user?.phone || '',
      email: user?.email || ''
    };
  }

  static updateWorkerAvailability(workerId: string, status: string, via: string = 'UI') {
    return UserRepository.updateWorkerAvailability(workerId, status, via);
  }

  static searchWorkers(skill: string) {
    const workers = UserRepository.findAvailableWorkersBySkill(skill);
    return workers.map(w => {
      const user = UserRepository.findById(w.user_id);
      return {
        ...w,
        skills: typeof w.skills === 'string' ? JSON.parse(w.skills) : w.skills,
        full_name: user?.full_name || 'Worker',
        phone: user?.phone || '',
        email: user?.email || ''
      };
    });
  }

  static searchContractors() {
    const contractors = UserRepository.findAllContractors();
    return contractors.map(c => {
      const user = UserRepository.findById(c.user_id);
      return {
        ...c,
        full_name: user?.full_name || 'Contractor',
        phone: user?.phone || '',
        email: user?.email || ''
      };
    });
  }
}
