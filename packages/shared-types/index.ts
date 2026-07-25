
// Shared Types for LabourLink

export type UserRole = 'WORKER' | 'CUSTOMER' | 'CONTRACTOR' | 'ADMIN';

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'PARTIALLY_VERIFIED' | 'VERIFIED';

export interface Location {
  latitude: number;
  longitude: number;
  address_text?: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  skills: string[]; // e.g. ["electrician", "plumber"]
  home_lat: number;
  home_lng: number;
  current_lat: number;
  current_lng: number;
  availability_status: AvailabilityStatus;
  verification_status: VerificationStatus;
  trust_score: number | null; // null if unestablished
  trust_score_updated_at: string | null;
  trust_score_version: number;
  created_at: string;
}

export interface ContractorProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  verified_business: boolean;
  created_at: string;
}

export interface CustomerProfile {
  id: string;
  user_id: string;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  preferred_language: string | null;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  raw_text: string;
  extracted_skills: string[];
  lat: number | null;
  lng: number | null;
  radius_km: number;
  urgency_window_start: string;
  urgency_window_end: string;
  budget_min: number | null;
  budget_max: number | null;
  status: 'DRAFT' | 'EXTRACTED' | 'MATCHED' | 'RECOMMENDED' | 'BOOKED' | 'CANCELLED';
  extracted_by_agent_run_id: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  service_request_id: string;
  worker_id: string;
  customer_id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  scheduled_start: string;
  scheduled_end: string;
  actual_completion: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface SkillsTaxonomy {
  id: string;
  category: string;
  name: string;
}

export type VerificationRecordType = 'ID_DOCUMENT' | 'SKILL_CERT' | 'EMPLOYER_ATTESTATION' | 'BIOMETRIC';
export type VerificationRecordStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface VerificationRecord {
  id: string;
  worker_id: string;
  type: VerificationRecordType;
  status: VerificationRecordStatus;
  evidence_url: string;
  verified_by_agent_run_id: string | null;
  created_at: string;
}

export interface JobRequirement {
  id: string;
  contractor_id: string;
  raw_text: string;
  extracted_skills: string[];
  location: Location;
  radius_km: number;
  headcount: number;
  min_trust_score: number | null;
  pay_min: number;
  pay_max: number;
  urgency_window_start: string;
  urgency_window_end: string;
  extracted_by_agent_run_id: string;
  created_at: string;
}

export type JobStatus = 'OFFERED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export interface Recommendation {
  id: string;
  request_reference_type: 'JOB_REQUIREMENT' | 'SERVICE_REQUEST';
  request_reference_id: string;
  worker_id: string;
  rank: number;
  explanation: string;
  evidence: any;
  generated_by_agent_run_id: string;
  created_at: string;
}

export interface Job {
  id: string;
  job_requirement_id: string;
  worker_id: string;
  contractor_id: string;
  status: JobStatus;
  scheduled_start: string;
  scheduled_end: string;
  actual_completion: string | null;
  location: Location;
  created_at: string;
}

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'FAILED';
export type PaymentConfirmationMethod = 'UPI_VERIFIED' | 'CASH_ATTESTED' | 'BANK_VERIFIED';

export interface Payment {
  id: string;
  job_reference_type: 'CONTRACTOR_JOB' | 'CUSTOMER_BOOKING';
  job_reference_id: string;
  amount: number;
  status: PaymentStatus;
  confirmation_method: PaymentConfirmationMethod;
  confirmed_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  job_reference_type: 'CONTRACTOR_JOB' | 'CUSTOMER_BOOKING';
  job_reference_id: string;
  rater_id: string;
  ratee_id: string;
  score: number; // 1 to 5
  comment: string | null;
  created_at: string;
}

export interface Endorsement {
  id: string;
  worker_id: string;
  endorser_id: string;
  skill: string;
  comment: string | null;
  created_at: string;
}

export interface TrustScoreHistory {
  id: string;
  worker_id: string;
  score: number;
  version: number;
  computed_by_agent_run_id: string;
  contributing_factors: {
    jobs_completed: number;
    on_time_rate: number;
    payment_integrity_factor: number;
    average_contractor_rating: number;
    endorsement_factor: number;
    verification_factor: number;
    fraud_penalty: number;
    reliability_consistency_factor: number;
    dispute_outcome_factor: number;
    audit_trail?: {
      endorsements: string[];
      verifications: string[];
      availability_events: string[];
      fraud_flags: string[];
      jobs: string[];
      disputes: string[];
    };
  };
  created_at: string;
}

export type FraudSubjectType = 'WORKER' | 'CONTRACTOR' | 'JOB' | 'RATING';
export type FraudFlagType = 'DUPLICATE_IDENTITY' | 'RATING_COLLUSION' | 'LOCATION_CONFLICT' | 'PAYMENT_MISMATCH' | 'IDENTITY_FARMING' | 'SELF_DEALING_SUSPECTED' | 'OTHER';
export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FraudStatus = 'OPEN' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';

export interface FraudFlag {
  id: string;
  subject_type: FraudSubjectType;
  subject_id: string;
  flag_type: FraudFlagType;
  severity: FraudSeverity;
  evidence: Record<string, any>; // references to evidence record IDs
  status: FraudStatus;
  detected_by_agent_run_id: string;
  created_at: string;
  resolved_at: string | null;
}

export type AgentName = 'VERIFICATION' | 'REQUIREMENT_EXTRACTION' | 'WORKER_MATCHING' | 'TRUST' | 'FRAUD_DETECTION' | 'RECOMMENDATION' | 'VOICE_INTERACTION';
export type AgentRunStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface AgentRunLog {
  id: string;
  agent_name: AgentName;
  agent_version: string;
  input_payload: any;
  output_payload: any;
  evidence_record_ids: string[];
  status: AgentRunStatus;
  latency_ms: number;
  created_at: string;
}

export type VoiceLanguage = 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'en';
export type VoiceIntent = 'JOB_SEARCH' | 'REGISTER' | 'UPDATE_PROFILE' | 'APPLY_JOB' | 'ACCEPT_JOB' | 'NAVIGATE' | 'UNKNOWN';
export type VoiceCommandStatus = 'RECEIVED' | 'PROCESSING' | 'NEEDS_CLARIFICATION' | 'ROUTED_TO_AGENT' | 'COMPLETED' | 'FAILED';
export type RoutedAgent = 'REQUIREMENT_EXTRACTION' | 'WORKER_MATCHING' | 'RECOMMENDATION' | 'VERIFICATION' | 'NONE';

export interface VoiceCommand {
  id: string;
  user_id: string;
  raw_audio_ref: string;
  transcript: string;
  detected_language: VoiceLanguage;
  intent: VoiceIntent;
  slots: {
    skill?: string;
    location?: string;
    [key: string]: any;
  };
  confidence: {
    stt: number;
    intent: number;
    slots: Record<string, number>;
  };
  status: VoiceCommandStatus;
  routed_to_agent: RoutedAgent | null;
  agent_run_id: string | null;
  created_at: string;
}

export interface VoiceClarificationPrompt {
  id: string;
  voice_command_id: string;
  missing_field: string;
  prompt_text: string;
  resolved: boolean;
  resolved_voice_command_id: string | null;
  created_at: string;
}

export type LoginMethod = 'PASSWORD' | 'OTP' | 'VOICE';

export interface AuthSession {
  id: string;
  user_id: string;
  device_fingerprint: string | null;
  ip_address: string | null;
  location: Location | null;
  login_method: LoginMethod;
  created_at: string;
  expired_at: string | null;
}

export type NotificationChannel = 'SMS' | 'VOICE_CALLBACK' | 'PUSH' | 'IN_APP';
export type NotificationType = 'JOB_OFFER' | 'TRUST_SCORE_UPDATE' | 'FRAUD_ALERT' | 'CLARIFICATION_NEEDED' | 'PAYMENT_CONFIRMED' | 'BOOKING_REQUEST' | 'BOOKING_ACCEPTED' | 'VERIFICATION_APPROVED';

export interface Notification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  type: NotificationType;
  payload: any;
  delivered: boolean;
  read_at: string | null;
  created_at: string;
}

export type DisputeStatus = 'OPEN' | 'RESOLVED';

export interface Dispute {
  id: string;
  engagement_id: string;
  raised_by: string;
  reason: string;
  evidence_urls: string[];
  status: DisputeStatus;
  resolution: 'worker_at_fault' | 'contractor_at_fault' | 'no_fault' | null;
  created_at: string;
}

export type EngagementStatus = 
  | 'DRAFT' 
  | 'MATCHED' 
  | 'PENDING_RESPONSE' 
  | 'PENDING'
  | 'NEGOTIATING'
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'PRICE_PROPOSED' 
  | 'PRICE_COUNTERED' 
  | 'PRICE_AGREED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'PAID' 
  | 'RATED' 
  | 'DISPUTED' 
  | 'CANCELLED';

export type EngagementMode = 'DIRECT_WORKER' | 'VIA_CONTRACTOR';

export interface Engagement {
  id: string;
  request_id: string;
  mode: EngagementMode;
  initiator_id: string;
  counterparty_id: string;
  parent_engagement_id: string | null;
  status: EngagementStatus;
  created_at: string;
  updated_at: string;
}

export interface PriceOffer {
  id: string;
  engagement_id: string;
  offered_by: string;
  amount: number;
  note: string | null;
  created_at: string;
}


export interface AvailabilityLog {
  id: string;
  worker_id: string;
  status: AvailabilityStatus;
  set_via: 'UI' | 'VOICE' | 'SYSTEM_AUTO';
  created_at: string;
}

export type ConsentType = 'VOICE_RECORDING' | 'DATA_PROCESSING' | 'LOCATION_TRACKING' | 'BACKGROUND_VERIFICATION';

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_via: 'UI' | 'VOICE';
  created_at: string;
}

export type AdminActionType = 'FRAUD_FLAG_RESOLVED' | 'FRAUD_FLAG_DISMISSED' | 'TRUST_SCORE_EXCEPTION' | 'ACCOUNT_SUSPENDED' | 'VERIFICATION_OVERRIDDEN';
export type AdminActionTargetType = 'WORKER' | 'CONTRACTOR' | 'JOB' | 'FRAUD_FLAG';

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  target_type: AdminActionTargetType;
  target_id: string;
  reason: string;
  created_at: string;
}
