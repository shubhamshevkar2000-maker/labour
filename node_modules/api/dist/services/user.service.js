"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_repository_1 = require("../repositories/user.repository");
class UserService {
    static getWorkerDetails(id) {
        const profile = user_repository_1.UserRepository.findWorkerProfileById(id) || user_repository_1.UserRepository.findWorkerProfileByUserId(id);
        if (!profile)
            return null;
        const user = user_repository_1.UserRepository.findById(profile.user_id);
        return {
            ...profile,
            skills: typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills,
            full_name: user?.full_name || 'Worker',
            phone: user?.phone || '',
            email: user?.email || ''
        };
    }
    static getContractorDetails(id) {
        const profile = user_repository_1.UserRepository.findContractorProfileById(id) || user_repository_1.UserRepository.findContractorProfileByUserId(id);
        if (!profile)
            return null;
        const user = user_repository_1.UserRepository.findById(profile.user_id);
        return {
            ...profile,
            full_name: user?.full_name || 'Contractor',
            phone: user?.phone || '',
            email: user?.email || ''
        };
    }
    static getCustomerDetails(id) {
        const profile = user_repository_1.UserRepository.findCustomerProfileById(id) || user_repository_1.UserRepository.findCustomerProfileByUserId(id);
        if (!profile)
            return null;
        const user = user_repository_1.UserRepository.findById(profile.user_id);
        return {
            ...profile,
            full_name: user?.full_name || 'Customer',
            phone: user?.phone || '',
            email: user?.email || ''
        };
    }
    static updateWorkerAvailability(workerId, status, via = 'UI') {
        return user_repository_1.UserRepository.updateWorkerAvailability(workerId, status, via);
    }
    static searchWorkers(skill) {
        const workers = user_repository_1.UserRepository.findAvailableWorkersBySkill(skill);
        return workers.map(w => {
            const user = user_repository_1.UserRepository.findById(w.user_id);
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
        const contractors = user_repository_1.UserRepository.findAllContractors();
        return contractors.map(c => {
            const user = user_repository_1.UserRepository.findById(c.user_id);
            return {
                ...c,
                full_name: user?.full_name || 'Contractor',
                phone: user?.phone || '',
                email: user?.email || ''
            };
        });
    }
}
exports.UserService = UserService;
