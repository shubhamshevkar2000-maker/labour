import React, { useState, useEffect } from 'react';

interface TrustFactors {
  jobs_completed: number;
  on_time_rate: number;
  payment_integrity_factor: number;
  average_contractor_rating: number;
  endorsement_factor: number;
  verification_factor: number;
  reliability_consistency_factor: number;
  dispute_outcome_factor: number;
  fraud_penalty: number;
}

interface TrustScoreBreakdownModalProps {
  workerId: string;
  onClose: () => void;
}

export const TrustScoreBreakdownModal: React.FC<TrustScoreBreakdownModalProps> = ({ workerId, onClose }) => {
  const [data, setData] = useState<{ score: number; contributing_factors: TrustFactors } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScoreDetails();
  }, [workerId]);

  const fetchScoreDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workers/${workerId}/trust-score`);
      if (!res.ok) throw new Error('Could not retrieve worker trust score breakdown.');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={backdropStyle}>
        <div style={modalStyle}>
          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Parsing verification and dispute audits...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={backdropStyle}>
        <div style={modalStyle}>
          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
            <p style={{ color: '#ef4444', margin: '0 0 16px 0' }}>Error: {error || 'No data available'}</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const f = data.contributing_factors;

  const rows = [
    { name: 'Completed Jobs (Kaam Pura Kiya)', score: f.jobs_completed, max: 10, pct: '10%' },
    { name: 'On-Time Rate (समय पर पहुंचना)', score: f.on_time_rate, max: 15, pct: '15%' },
    { name: 'Payment Integrity (भुगतान सच्चाई)', score: f.payment_integrity_factor, max: 15, pct: '15%' },
    { name: 'Average Rating (रेटिंग का औसत)', score: f.average_contractor_rating, max: 30, pct: '30%' },
    { name: 'Worker Endorsements (सहमति पत्र)', score: f.endorsement_factor, max: 10, pct: '10%' },
    { name: 'Identity & Skill Verification (सत्यापन)', score: f.verification_factor, max: 20, pct: '20%' },
    { name: 'Availability Switch Consistency (समय विसंगति)', score: f.reliability_consistency_factor, max: 0, pct: 'Penalty (Deduction)' },
    { name: 'Dispute Resolutions (विवाद परिणाम)', score: f.dispute_outcome_factor, max: 0, pct: 'Penalty (Deduction)' },
    { name: 'Fraud Flag Penalties (धोखाधड़ी जुर्माना)', score: -f.fraud_penalty, max: 0, pct: 'Penalty (Deduction)' }
  ];

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f766e' }}>
            Trust Score Audit Transparency Breakdown
          </h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2f5f3', border: '1px solid #99f6e4', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e', marginRight: '16px' }}>{data.score}</div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 'bold' }}>Overall Trust Index</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>
                Calculated on-the-fly from verified database ledger entries. Language options are never used as scoring signals.
              </p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', color: '#475569', fontWeight: 'bold' }}>
                <th style={{ padding: '8px 4px' }}>Contribution Factor</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Points Applied</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Max Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isPenalty = row.score < 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isPenalty ? '#fffafb' : 'transparent' }}>
                    <td style={{ padding: '10px 4px', color: '#1e293b' }}>
                      <strong>{row.name}</strong>
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'center', color: isPenalty ? '#b91c1c' : '#0f766e', fontWeight: 'bold' }}>
                      {row.score > 0 ? `+${row.score.toFixed(1)}` : row.score.toFixed(1)}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: '#64748b' }}>
                      {row.pct}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
          <button 
            onClick={onClose} 
            style={{ 
              backgroundColor: '#0f766e', 
              color: '#ffffff', 
              border: 'none', 
              padding: '8px 16px', 
              fontSize: '13px', 
              fontWeight: 'bold', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            Acknowledge Audit
          </button>
        </div>
      </div>
    </div>
  );
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  fontFamily: 'Arial, sans-serif'
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  width: '100%',
  maxWidth: '560px',
  borderRadius: '8px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  overflow: 'hidden'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px'
};

export default TrustScoreBreakdownModal;
