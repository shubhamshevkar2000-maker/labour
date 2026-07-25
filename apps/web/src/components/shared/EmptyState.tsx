import React from 'react';
import { AlertCircle, Inbox, Award, AlertTriangle, ShieldAlert } from 'lucide-react';

interface EmptyStateProps {
  variant: 'trust_score' | 'recommendations' | 'fraud_flags' | 'analytics' | 'agent_failure' | 'contractor_jobs' | 'default';
  count?: number;
  message?: string;
  onRetry?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ variant, count, message, onRetry }) => {
  switch (variant) {
    case 'trust_score':
      return (
        <div style={{ padding: '24px', border: '2px dashed #94a3b8', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
          <Award size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
          <h4 style={{ color: '#475569', fontWeight: 'bold', fontSize: '15px', marginBottom: '6px' }}>Trust Score Not Yet Established</h4>
          <p style={{ color: '#64748b', fontSize: '13px' }}>
            {message || "Complete your first verified job with a confirmed payment to begin building your portable trust identity."}
          </p>
        </div>
      );

    case 'recommendations':
      return (
        <div style={{ padding: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', backgroundColor: '#ffffff', margin: '16px 0' }}>
          <Inbox size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
          <h4 style={{ color: '#334155', fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}>No Worker Recommendations Generated</h4>
          <p style={{ color: '#475569', fontSize: '13px', marginBottom: '16px' }}>
            {message || "Submit a new job requirement query using voice or text matching to generate explainable candidate shortlists."}
          </p>
        </div>
      );

    case 'fraud_flags':
      return (
        <div style={{ padding: '24px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
          <ShieldAlert size={48} color="#16a34a" style={{ marginBottom: '12px' }} />
          <h4 style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>No Open Fraud Flags</h4>
          <p style={{ color: '#475569', fontSize: '13px' }}>
            The system currently has active monitoring logs showing exactly <strong>{count ?? 0}</strong> open cases. All identity, location, and rating feeds are verified clean.
          </p>
        </div>
      );

    case 'analytics':
      return (
        <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f8fafc', color: '#64748b' }}>
          <AlertCircle size={32} color="#d97706" style={{ marginBottom: '8px', display: 'inline-block' }} />
          <h4 style={{ color: '#78350f', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Insufficient Data for Analysis</h4>
          <p style={{ fontSize: '12px' }}>
            {message || `Not enough data yet for a reliable workforce trend (current sample size n = ${count ?? 0}).`}
          </p>
        </div>
      );

    case 'agent_failure':
      return (
        <div style={{ padding: '24px', border: '1px solid #fecaca', borderRadius: '4px', textAlign: 'center', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          <AlertTriangle size={40} color="#dc2626" style={{ marginBottom: '10px', display: 'inline-block' }} />
          <h4 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>Agent Temporarily Unavailable</h4>
          <p style={{ fontSize: '13px', marginBottom: '12px' }}>
            The system encountered an error connecting to the matching/recommendation agent pipelines.
          </p>
          {onRetry && (
            <button className="btn btn-danger" onClick={onRetry}>
              Retry Agent Execution
            </button>
          )}
        </div>
      );

    case 'contractor_jobs':
      return (
        <div style={{ padding: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <Inbox size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
          <h4 style={{ color: '#334155', fontWeight: 'bold', fontSize: '15px', marginBottom: '6px' }}>No Active Job Postings</h4>
          <p style={{ color: '#475569', fontSize: '13px', marginBottom: '16px' }}>
            Welcome to LabourLink. Use the interface below to describe your hiring needs.
          </p>
        </div>
      );

    default:
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
          <Inbox size={32} style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '13px' }}>{message || "No records found in this category."}</p>
        </div>
      );
  }
};
export default EmptyState;
