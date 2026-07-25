import React from 'react';
import { Award, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import EmptyState from '../shared/EmptyState';

interface TrustScoreGaugeProps {
  score: number | null;
  version?: number;
  contributingFactors?: {
    jobs_completed: number;
    on_time_rate: number;
    payment_integrity_factor: number;
    average_contractor_rating: number;
    endorsement_factor: number;
    verification_factor: number;
    fraud_penalty: number;
    reliability_consistency_factor: number;
    dispute_outcome_factor: number;
  } | null;
}

export const TrustScoreGauge: React.FC<TrustScoreGaugeProps> = ({ score, version, contributingFactors }) => {
  const [showModal, setShowModal] = React.useState(false);

  if (score === null) {
    return <EmptyState variant="trust_score" />;
  }

  // Determine trust level and color
  let level = 'UNESTABLISHED';
  let color = 'var(--trust-unestablished)';
  let desc = 'Not yet calculated';
  let Icon = AlertTriangle;

  if (score >= 85) {
    level = 'HIGH';
    color = 'var(--trust-high)';
    desc = 'Highly Reliable & Verified';
    Icon = ShieldCheck;
  } else if (score >= 70) {
    level = 'MEDIUM';
    color = 'var(--trust-medium)';
    desc = 'Established Trust Identity';
    Icon = Award;
  } else {
    level = 'LOW';
    color = 'var(--trust-low)';
    desc = 'Caution: Negative Signals Detected';
    Icon = ShieldAlert;
  }

  const f = contributingFactors || {
    jobs_completed: 0,
    on_time_rate: 0,
    payment_integrity_factor: 0,
    average_contractor_rating: 0,
    endorsement_factor: 0,
    verification_factor: 0,
    reliability_consistency_factor: 0,
    dispute_outcome_factor: 0,
    fraud_penalty: 0
  };

  const rows = [
    { name: 'Completed Jobs', score: f.jobs_completed, max: 10, pct: '10%' },
    { name: 'Average Rating', score: f.average_contractor_rating, max: 30, pct: '30%' },
    { name: 'Payment Integrity', score: f.payment_integrity_factor, max: 15, pct: '15%' },
    { name: 'Verification Status', score: f.verification_factor, max: 20, pct: '20%' },
    { name: 'On-Time rate ratio', score: f.on_time_rate, max: 15, pct: '15%' },
    { name: 'Endorsements Weight', score: f.endorsement_factor, max: 10, pct: '10%' },
    { name: 'Availability switch volatility', score: f.reliability_consistency_factor, max: 0, pct: 'Penalty' },
    { name: 'Disputes resolved against worker', score: f.dispute_outcome_factor, max: 0, pct: 'Penalty' },
    { name: 'Fraud Flag Penalties', score: -f.fraud_penalty, max: 0, pct: 'Penalty' }
  ];

  return (
    <div style={{ border: `1px solid var(--border-color)`, borderRadius: 'var(--border-radius)', padding: '16px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--secondary-color)' }}>Portable Trust Score</h4>
        <span className="badge" style={{ backgroundColor: color + '20', color: color, borderColor: color, borderStyle: 'solid', borderWidth: '1px' }}>
          Level {level}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          border: `6px solid ${color}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <span style={{ fontSize: '26px', fontWeight: 'bold', color: color }}>{score}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Index</span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '14px', color: color }}>
            <Icon size={16} />
            {desc}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Auditable Score Version: <strong>v{version || 1}</strong>
          </div>
          
          <button 
            type="button"
            onClick={() => setShowModal(true)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#0f766e', 
              fontSize: '11px', 
              textDecoration: 'underline', 
              cursor: 'pointer', 
              padding: 0,
              marginTop: '6px',
              display: 'block'
            }}
          >
            Why am I seeing this score?
          </button>
        </div>
      </div>

      {contributingFactors && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
          <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '8px' }}>Contributing Factors (Auditable Logs)</h5>
          <table className="table" style={{ margin: 0, fontSize: '12px' }}>
            <tbody>
              <tr>
                <td>Jobs Completed Weight</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{contributingFactors.jobs_completed} pts</td>
              </tr>
              <tr>
                <td>On-Time rate ratio</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{Math.round(contributingFactors.on_time_rate)} pts</td>
              </tr>
              <tr>
                <td>Payment Integrity Confirmation</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{Math.round(contributingFactors.payment_integrity_factor)} pts</td>
              </tr>
              <tr>
                <td>Average Contractor Ratings</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{Math.round(contributingFactors.average_contractor_rating)} pts</td>
              </tr>
              <tr>
                <td>Contractor Endorsements</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{contributingFactors.endorsement_factor} pts</td>
              </tr>
              <tr>
                <td>Verification Audit Weight</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>+{contributingFactors.verification_factor} pts</td>
              </tr>
              {contributingFactors.reliability_consistency_factor !== 0 && (
                <tr style={{ color: 'var(--accent-color)' }}>
                  <td>Availability Volatility penalty</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{contributingFactors.reliability_consistency_factor} pts</td>
                </tr>
              )}
              {contributingFactors.dispute_outcome_factor !== 0 && (
                <tr style={{ color: 'var(--error-color)' }}>
                  <td>Disputes Resolved Against Worker</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{contributingFactors.dispute_outcome_factor} pts</td>
                </tr>
              )}
              {contributingFactors.fraud_penalty > 0 && (
                <tr style={{ color: 'var(--error-color)', backgroundColor: '#fee2e2' }}>
                  <td>Active Fraud Penalties (Deducted)</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>-{contributingFactors.fraud_penalty} pts</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f766e' }}>
                Trust Score Factor Breakdown
              </h3>
              <button onClick={() => setShowModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2f5f3', border: '1px solid #99f6e4', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e', marginRight: '16px' }}>{score}</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 'bold' }}>Overall Trust Score</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>
                    Real-time metrics parsed from secure ledger transaction audits.
                  </p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', color: '#475569', fontWeight: 'bold' }}>
                    <th style={{ padding: '8px 4px' }}>Contribution Factor</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Points</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Max Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isPenalty = row.score < 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isPenalty ? '#fffafb' : 'transparent' }}>
                        <td style={{ padding: '8px 4px', color: '#1e293b' }}>{row.name}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center', color: isPenalty ? '#b91c1c' : '#0f766e', fontWeight: 'bold' }}>
                          {row.score > 0 ? `+${row.score.toFixed(1)}` : row.score.toFixed(1)}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#64748b' }}>{row.pct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button 
                onClick={() => setShowModal(false)} 
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
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
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
  zIndex: 99999,
  fontFamily: 'Arial, sans-serif'
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  width: '100%',
  maxWidth: '500px',
  borderRadius: '6px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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

export default TrustScoreGauge;
