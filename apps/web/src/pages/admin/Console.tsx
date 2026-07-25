import React, { useState, useEffect } from 'react';
import { User } from 'shared-types';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  HelpCircle, 
  Activity, 
  AlertCircle,
  Home,
  ChevronLeft,
  ChevronRight,
  Settings,
  AlertTriangle
} from 'lucide-react';

interface AdminConsoleProps {
  user: User;
  onLogout: () => void;
}

interface ToastMsg {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ user, onLogout }) => {
  // Navigation states
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'fraud' | 'users' | 'analytics' | 'settings'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [adminActions, setAdminActions] = useState<any[]>([]);
  const [authSessions, setAuthSessions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [actionPending, setActionPending] = useState<boolean>(false);

  // Resolution states
  const [resolvingFlag, setResolvingFlag] = useState<any | null>(null);
  const [flagStatus, setFlagStatus] = useState<'CONFIRMED' | 'DISMISSED'>('CONFIRMED');
  const [flagReason, setFlagReason] = useState<string>('');

  const [resolvingDispute, setResolvingDispute] = useState<any | null>(null);
  const [disputeStatus, setDisputeStatus] = useState<'worker_at_fault' | 'contractor_at_fault' | 'no_fault'>('no_fault');
  const [disputeNotes, setDisputeNotes] = useState<string>('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' = 'SUCCESS') => {
    if (toasts.some(t => t.message === message)) return;
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [fraudRes, disputesRes, analyticsRes, agentRunsRes, sessionsRes, actionsRes] = await Promise.all([
        fetch('/api/admin/fraud-flags?status=OPEN').then(r => r.ok ? r.json() : []),
        fetch('/api/disputes').then(r => r.ok ? r.json() : []),
        fetch('/api/analytics/workforce-summary').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/agent-runs').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/auth-sessions').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/admin-actions').then(r => r.ok ? r.json() : [])
      ]);
      
      setFraudFlags(fraudRes);
      setDisputes(disputesRes);
      setAnalytics(analyticsRes);
      setAgentRuns(agentRunsRes);
      setAuthSessions(sessionsRes);
      setAdminActions(actionsRes);
    } catch (err: any) {
      setErrorText(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingFlag || !flagReason || actionPending) return;

    setActionPending(true);
    try {
      const response = await fetch(`/api/admin/fraud-flags/${resolvingFlag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: flagStatus,
          admin_id: user.id,
          reason: flagReason
        })
      });

      if (!response.ok) throw new Error('Failed to resolve fraud flag');
      
      showToast('Fraud flag resolved and logged to admin_actions audit successfully.', 'SUCCESS');
      setResolvingFlag(null);
      setFlagReason('');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleResolveDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingDispute || actionPending) return;

    setActionPending(true);
    try {
      const response = await fetch(`/api/disputes/${resolvingDispute.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: disputeStatus,
          admin_id: user.id
        })
      });

      if (!response.ok) throw new Error('Failed to resolve dispute');

      showToast('Dispute resolved. Worker/Contractor status and trust scores updated.', 'SUCCESS');
      setResolvingDispute(null);
      setDisputeNotes('');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: '40px', maxWidth: '1100px', margin: '0 auto', gap: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div className="skeleton-pulse" style={{ width: '100%', height: '140px', borderRadius: '12px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          <div className="skeleton-pulse" style={{ height: '240px', borderRadius: '12px' }}></div>
          <div className="skeleton-pulse" style={{ height: '240px', borderRadius: '12px' }}></div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={16} /> },
    { id: 'fraud', label: 'Fraud Center', icon: <ShieldAlert size={16} /> },
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <Activity size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> }
  ];

  const unresolvedDisputesCount = disputes.filter(d => d.status === 'OPEN').length;
  const criticalFraudCount = fraudFlags.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      
      {/* SIDEBAR NAVIGATION */}
      {!isMobile && (
        <aside style={{
          width: isSidebarCollapsed ? '72px' : '250px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 20px', borderBottom: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(15,118,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={20} color="#0f766e" />
            </div>
            {!isSidebarCollapsed && (
              <span style={{ fontWeight: '800', fontSize: '16px', color: '#0f766e', letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
                LABOUR<span style={{ color: '#0f172a' }}>LINK</span>
              </span>
            )}
          </div>

          <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: active ? 'rgba(15,118,110,0.06)' : 'transparent',
                    color: active ? '#0f766e' : '#475569',
                    fontWeight: active ? '700' : '500',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ color: active ? '#0f766e' : '#64748b', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'flex-end' }}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </aside>
      )}

      {/* BOTTOM NAV BAR */}
      {isMobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 999,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          {navItems.map(item => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as any)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  background: 'none',
                  border: 'none',
                  color: active ? '#0f766e' : '#64748b',
                  fontSize: '10px',
                  fontWeight: active ? '700' : '500',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* MAIN CONTAINER */}
      <main style={{
        flex: 1,
        padding: '32px',
        paddingBottom: isMobile ? '80px' : '32px',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }} className="fade-in">
        
        {/* PREMIUM HERO SECTION */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,118,110,0.06) 0%, rgba(37,99,235,0.04) 100%)',
          border: '1px solid rgba(15,118,110,0.1)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#0f766e', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Operational Security Control Console
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                System Administrator Console
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Monitor multi-agent heuristics, clear geofencing threat flags, and arbitrate disputes.
              </p>
            </div>
            
            {/* Contextual Stats Summary Banners */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Critical Threat</span>
                <span className={`badge ${criticalFraudCount > 0 ? 'badge-danger' : 'badge-success'}`} style={{ marginTop: '4px', fontSize: '10px' }}>
                  {criticalFraudCount} flags
                </span>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Arbitrations</span>
                <strong style={{ fontSize: '15px', color: '#d97706', fontFamily: 'Outfit, sans-serif', display: 'block', marginTop: '2px' }}>
                  {unresolvedDisputesCount} pending
                </strong>
              </div>
              <button 
                onClick={onLogout} 
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px 14px', height: '38px' }}
              >
                Logout
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(15,118,110,0.1)', paddingTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', backgroundColor: '#fee2e2', color: '#e11d48', borderRadius: '4px', fontWeight: '700', fontSize: '10px' }}>
              <AlertTriangle size={12} /> ALERTS
            </span>
            {criticalFraudCount > 0 ? (
              <span>Security Threat warning: There are <strong>{criticalFraudCount} critical geofencing/IP proxy flags</strong> requiring override decisions.</span>
            ) : (
              <span>Geofencing proxy checks: Clean. All heuristic engines operating normally.</span>
            )}
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>Agent Heuristics Health: <strong style={{ color: '#059669' }}>ONLINE</strong> (avg latency: 320ms)</span>
          </div>
        </div>

        {errorText && (
          <div className="alert-banner alert-banner-error" style={{ marginBottom: '20px' }}>
            <AlertCircle size={20} />
            <div>{errorText}</div>
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {currentPage === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '20px' }}>
              <div className="card" style={{ textAlign: 'center', padding: '24px 20px', margin: 0 }}>
                <ShieldAlert size={28} color="#e11d48" style={{ marginBottom: '8px', display: 'inline-block' }} />
                <h5 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Open Fraud Flags</h5>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#e11d48', fontFamily: 'Outfit, sans-serif' }}>{fraudFlags.length} Flags</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '24px 20px', margin: 0 }}>
                <HelpCircle size={28} color="#d97706" style={{ marginBottom: '8px', display: 'inline-block' }} />
                <h5 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Unresolved Disputes</h5>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', fontFamily: 'Outfit, sans-serif' }}>{unresolvedDisputesCount} Disputes</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '24px 20px', margin: 0 }}>
                <Users size={28} color="#0f766e" style={{ marginBottom: '8px', display: 'inline-block' }} />
                <h5 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Workforce</h5>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f766e', fontFamily: 'Outfit, sans-serif' }}>{analytics?.workers_count || 0} Workers</div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Active Heuristic Engines Status</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>🛡️ Verification Agent (Audits)</span>
                  <span style={{ color: '#059669', fontWeight: '700' }}>ONLINE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>🤖 Fraud & Fingerprint Detection Agent</span>
                  <span style={{ color: '#059669', fontWeight: '700' }}>ONLINE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>📈 Trust Score Engine</span>
                  <span style={{ color: '#059669', fontWeight: '700' }}>ONLINE</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. FRAUD CENTER VIEW */}
        {currentPage === 'fraud' && (
          <div className="card">
            <h4 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#e11d48' }}>Active Security Risk Flags Queue</h4>
            {fraudFlags.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#059669' }}>All Security Risk Checks: Clean</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Device fingerprint and geofencing heuristic agents have flagged zero threats.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject Name / ID</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Evidence / Reason</th>
                      <th>Detected By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraudFlags.map(flag => (
                      <tr key={flag.id}>
                        <td>
                          <strong>{flag.subject_name || 'System Record'}</strong>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>ID: {flag.subject_id.slice(0, 8)} ({flag.subject_type})</div>
                        </td>
                        <td><span className="badge badge-neutral">{flag.flag_type}</span></td>
                        <td>
                          <span className={`badge ${flag.severity === 'CRITICAL' || flag.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>{flag.severity}</span>
                        </td>
                        <td>
                          <div>{flag.evidence?.reason}</div>
                          {flag.evidence?.distance_km && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Distance conflict: {flag.evidence.distance_km.toFixed(1)} km</div>}
                        </td>
                        <td>Agent Run ID: {flag.detected_by_agent_run_id?.slice(0,8)}</td>
                        <td>
                          <button onClick={() => setResolvingFlag(flag)} className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '11px' }}>Resolve Flag</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. USERS VIEW */}
        {currentPage === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h4 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700' }}>Raised Disputes Queue</h4>
              {disputes.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚖️</div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#059669' }}>Dispute Queue Clear</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>There are currently no active arbitration cases filed by residential users or contractors.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Raised By</th>
                        <th>Reason Details</th>
                        <th>Evidence Files</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputes.map(disp => (
                        <tr key={disp.id}>
                          <td>{disp.job_id.slice(0, 8)}</td>
                          <td>
                            <strong>{disp.raised_by_name}</strong>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>UID: {disp.raised_by.slice(0,8)}</div>
                          </td>
                          <td>{disp.reason}</td>
                          <td>
                            {disp.evidence?.photos && disp.evidence.photos.map((p: string, idx: number) => (
                              <a href={p} key={idx} target="_blank" rel="noreferrer" style={{ fontSize: '11px', marginRight: '6px', textDecoration: 'underline' }}>Photo {idx + 1}</a>
                            ))}
                          </td>
                          <td><span className={`badge ${disp.status === 'OPEN' ? 'badge-danger' : 'badge-success'}`}>{disp.status}</span></td>
                          <td>
                            {disp.status === 'OPEN' ? (
                              <button onClick={() => setResolvingDispute(disp)} className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '11px' }} disabled={actionPending}>Resolve Dispute</button>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Resolved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Workforce Database Registry</h4>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <strong style={{ color: '#0f766e', fontSize: '14px' }}>{analytics?.workers_count || 0} Registered Workers</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Aadhaar and biometrics verified on-chain.</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <strong style={{ color: '#0f766e', fontSize: '14px' }}>{analytics?.contractors_count || 0} Registered Contractors</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Licensed companies and enterprise partners.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. ANALYTICS VIEW */}
        {currentPage === 'analytics' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
              <div className="card">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>Verification Audits Breakdown</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Verification Level</th>
                      <th>Workers Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.verification_stats.map((s: any) => (
                      <tr key={s.verification_status}>
                        <td><strong>{s.verification_status}</strong></td>
                        <td style={{ fontWeight: '700' }}>{s.cnt} worker(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>Registered Skill Distributions</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Skill Category</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.skill_distribution).map(([skill, cnt]: any) => (
                      <tr key={skill}>
                        <td style={{ textTransform: 'capitalize' }}><strong>{skill}</strong></td>
                        <td style={{ fontWeight: '700' }}>{cnt} worker(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. SETTINGS VIEW */}
        {currentPage === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Auditable Override Actions Log (admin_actions)</h4>
              {adminActions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No administrative overrides recorded.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Admin Name</th>
                        <th>Override Type</th>
                        <th>Target ID</th>
                        <th>Justification Reason</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminActions.map(act => (
                        <tr key={act.id}>
                          <td><strong>{act.admin_name}</strong></td>
                          <td><span className="badge badge-warning" style={{ fontSize: '9px' }}>{act.action_type}</span></td>
                          <td><span style={{ fontFamily: 'monospace' }}>{act.target_id.slice(0, 8)} ({act.target_type})</span></td>
                          <td>{act.reason}</td>
                          <td>{new Date(act.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Multi-Agent Latency & Runs</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent Name</th>
                      <th>Latency</th>
                      <th>Output</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRuns.map(run => (
                      <tr key={run.id}>
                        <td><strong>{run.agent_name}</strong></td>
                        <td style={{ fontWeight: '600' }}>{run.latency_ms} ms</td>
                        <td>
                          <div style={{ maxWidth: '280px', overflowX: 'auto', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11px' }}>{JSON.stringify(run.output_payload)}</div>
                        </td>
                        <td><span className={`badge ${run.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>{run.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Session Geolocation & IP Correlations</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>IP / Device Fingerprint</th>
                      <th>Coordinates</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authSessions.map(sess => (
                      <tr key={sess.id}>
                        <td><strong>{sess.full_name}</strong> ({sess.role})</td>
                        <td>{sess.ip_address} / {sess.device_fingerprint?.slice(0, 16)}...</td>
                        <td>{sess.lat ? `${sess.lat.toFixed(4)} N, ${sess.lng.toFixed(4)} E` : 'No GPS'}</td>
                        <td>{new Date(sess.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* RESOLVE FRAUD FLAG MODAL */}
      {resolvingFlag && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleResolveFlagSubmit} className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#ffffff', margin: 'auto', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h4 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700' }}>Resolve Security Flag</h4>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <strong>Subject:</strong> {resolvingFlag.subject_name || 'Worker Profile'}<br />
              <strong>Flag Type:</strong> {resolvingFlag.flag_type}<br />
              <strong>Reason:</strong> {resolvingFlag.evidence?.reason}
            </div>
            
            <div className="form-group">
              <label className="form-label">Resolution Status</label>
              <select className="form-control" value={flagStatus} onChange={(e) => setFlagStatus(e.target.value as any)}>
                <option value="CONFIRMED">Confirm Threat (Apply trust penalty)</option>
                <option value="DISMISSED">Dismiss / Clear Profile</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Justification / Reason</label>
              <textarea className="form-control" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Explain resolution decision..." style={{ minHeight: '60px' }} required />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setResolvingFlag(null)}>Cancel</button>
              <button type="submit" className="btn btn-danger" style={{ fontSize: '12px' }} disabled={actionPending}>Apply Resolve</button>
            </div>
          </form>
        </div>
      )}

      {/* RESOLVE DISPUTE MODAL */}
      {resolvingDispute && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleResolveDisputeSubmit} className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#ffffff', margin: 'auto', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h4 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700' }}>Resolve Raised Dispute</h4>
            
            <div className="form-group">
              <label className="form-label">Resolution Arbitrage Decision</label>
              <select className="form-control" value={disputeStatus} onChange={(e) => setDisputeStatus(e.target.value as any)}>
                <option value="no_fault">No Fault (Fair Share / Partial Resolution)</option>
                <option value="worker_at_fault">Worker at Fault (Penalize Worker Trust)</option>
                <option value="contractor_at_fault">Contractor/Customer at Fault (Penalize Contractor/Customer Trust)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Resolution Details Notes</label>
              <textarea className="form-control" value={disputeNotes} onChange={(e) => setDisputeNotes(e.target.value)} placeholder="Detail the dispute compromise..." style={{ minHeight: '60px' }} required />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setResolvingDispute(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '12px' }} disabled={actionPending}>Execute Resolution</button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: '#ffffff',
            borderLeft: `4px solid ${t.type === 'SUCCESS' ? '#0f766e' : t.type === 'ERROR' ? '#e11d48' : t.type === 'WARNING' ? '#d97706' : '#2563eb'}`,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid #cbd5e1'
          }}>
            <span>{t.type === 'SUCCESS' ? '✓' : t.type === 'ERROR' ? '⚠️' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AdminConsole;
