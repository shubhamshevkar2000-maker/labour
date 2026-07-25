import React, { useState, useEffect } from 'react';
import { User, WorkerProfile, VerificationRecord, Endorsement, Notification } from 'shared-types';
import TrustScoreGauge from '../../components/trust/TrustScoreGauge';
import VoiceControl from '../../components/shared/VoiceControl';
import ActivityTimeline from '../../components/ActivityTimeline';
import { 
  Clock, 
  ShieldCheck, 
  Radio, 
  Briefcase, 
  Home, 
  CreditCard, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  UserCheck,
  CheckCircle,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';

interface WorkerDashboardProps {
  user: User;
  profileId: string;
  onLogout: () => void;
}

interface WorkerAssignment {
  id: string;
  booking_id: string;
  status: string;
  remarks: string | null;
  assigned_at: string;
  scheduled_start: string;
  booking_status: string;
  requirement_text: string;
  contractor_company: string | null;
  contractor_name: string | null;
}

interface ToastMsg {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, profileId, onLogout }) => {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [trustDetails, setTrustDetails] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [actionPending, setActionPending] = useState<boolean>(false);

  // Navigation states
  const [currentPage, setCurrentPage] = useState<'home' | 'jobs' | 'trust' | 'wallet' | 'profile'>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Engagement & Negotiation States
  const [engagements, setEngagements] = useState<any[]>([]);
  const [counterProposalAmount, setCounterProposalAmount] = useState<{ [engagementId: string]: string }>({});

  // Verification upload simulation
  const [uploading, setUploading] = useState<boolean>(false);
  const [docType, setDocType] = useState<'ID_DOCUMENT' | 'SKILL_CERT'>('ID_DOCUMENT');
  const [docUrl, setDocUrl] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [profileId]);

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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const profRes = await fetch(`/api/workers/${profileId}/profile`);
      if (!profRes.ok) throw new Error('Failed to fetch worker profile credentials.');
      const profData = await profRes.json();
      setProfile(profData);

      const trustRes = await fetch(`/api/workers/${profileId}/trust-score`);
      if (trustRes.ok) {
        const trustData = await trustRes.json();
        setTrustDetails(trustData.status === 'NOT_YET_ESTABLISHED' ? null : trustData);
      }

      const bookingsRes = await fetch(`/api/bookings?userId=${profileId}&role=WORKER`);
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);
      }

      const assignmentsRes = await fetch(`/api/workers/${profileId}/assignments`);
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        setAssignments(assignmentsData);
      }

      const verifRes = await fetch(`/api/workers/${profileId}/verification-records`);
      if (verifRes.ok) {
        const verifData = await verifRes.json();
        setVerifications(verifData);
      }

      const notifRes = await fetch(`/api/notifications?userId=${user.id}`);
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData);
      }

      const endorsementsRes = await fetch(`/api/workers/${profileId}/endorsements`).catch(() => null);
      if (endorsementsRes && endorsementsRes.ok) {
        const endData = await endorsementsRes.json();
        setEndorsements(Array.isArray(endData) ? endData : (endData.data || []));
      }

      const oppRes = await fetch(`/api/workers/${profileId}/opportunities`);
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setOpportunities(oppData);
      }

      const engagementsRes = await fetch(`/api/engagements?userId=${user.id}&role=WORKER`);
      if (engagementsRes.ok) {
        const engagementsData = await engagementsRes.json();
        setEngagements(engagementsData);
      }

    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityToggle = async (status: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const response = await fetch(`/api/workers/${profileId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, set_via: 'UI' })
      });

      if (!response.ok) throw new Error('Failed to update availability status.');
      showToast(`Availability updated to ${status} successfully.`, 'SUCCESS');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleProposePriceOffer = async (engagementId: string) => {
    if (actionPending) return;
    const amountStr = counterProposalAmount[engagementId];
    if (!amountStr || isNaN(parseFloat(amountStr))) {
      showToast('Please enter a valid counter-offer bid.', 'WARNING');
      return;
    }

    setActionPending(true);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offered_by: user.id,
          amount: parseFloat(amountStr),
          note: 'Worker Counter Proposal'
        })
      });

      if (!res.ok) throw new Error('Failed to submit counter proposal.');
      showToast('Price counter bid proposed successfully!', 'SUCCESS');
      setCounterProposalAmount(prev => ({ ...prev, [engagementId]: '' }));
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleRespondToProposal = async (engagementId: string, response: 'ACCEPTED' | 'REJECTED') => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });

      if (!res.ok) throw new Error('Failed to respond to price proposal.');
      showToast(`Proposal ${response.toLowerCase()} successfully!`, 'SUCCESS');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docUrl || uploading) return;

    setUploading(true);
    try {
      const response = await fetch(`/api/workers/${profileId}/verification-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, evidence_url: docUrl })
      });

      if (!response.ok) throw new Error('Document validation failed.');
      
      setDocUrl('');
      showToast('Document uploaded and processed by Verification Agent.', 'SUCCESS');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setUploading(false);
    }
  };

  const handleRespondToAssignment = async (assignmentId: string, response: 'ACCEPTED' | 'REJECTED') => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      if (!res.ok) throw new Error('Failed to submit assignment response.');
      showToast(`Assignment ${response.toLowerCase()} successfully!`, 'SUCCESS');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to accept booking.');
      
      showToast('Booking accepted! Your availability status set to BUSY.', 'SUCCESS');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleAcceptOpportunity = async (opp: any) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      if (opp.type === 'CUSTOMER_BOOKING') {
        const bookRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_request_id: opp.id,
            worker_id: profileId,
            customer_id: opp.customer_id
          })
        });
        if (!bookRes.ok) throw new Error('Failed to create booking.');
        const data = await bookRes.json();
        const acceptRes = await fetch(`/api/bookings/${data.bookingId}/accept`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!acceptRes.ok) throw new Error('Failed to accept booking.');
        showToast('Residential Booking accepted successfully! Status: BUSY.', 'SUCCESS');
      } else {
        const jobRes = await fetch('/api/jobs/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_requirement_id: opp.id,
            worker_id: profileId,
            contractor_id: opp.contractor_id
          })
        });
        if (!jobRes.ok) throw new Error('Failed to apply for contractor job.');
        const data = await jobRes.json();
        const acceptRes = await fetch(`/api/jobs/${data.jobId}/accept`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!acceptRes.ok) throw new Error('Failed to accept job offer.');
        showToast('Contractor Job accepted successfully! Status: BUSY.', 'SUCCESS');
      }
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleReadNotification = async (notifId: string) => {
    try {
      await fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
      fetchDashboardData();
    } catch (e) {}
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
    { id: 'home', label: 'Home', icon: <Home size={16} /> },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
    { id: 'trust', label: 'Trust', icon: <ShieldCheck size={16} /> },
    { id: 'wallet', label: 'Wallet', icon: <CreditCard size={16} /> },
    { id: 'profile', label: 'Profile', icon: <Users size={16} /> }
  ];

  const currentActiveJob = bookings.find(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const recentEndorsement = endorsements[0];
  const verifiedCount = verifications.filter(v => v.status === 'VERIFIED').length;
  const isAadhaarVerified = verifications.some(v => v.type === 'ID_DOCUMENT' && v.status === 'VERIFIED');

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
                Verified Worker Profile
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                Namaste, {user.full_name}
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                UID: {profileId.slice(0, 8)} | Verified Skills: {profile?.skills.join(', ')}
              </p>
            </div>
            
            {/* Live Contextual Status Summary Banner */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Availability</span>
                <span className={`badge ${profile?.availability_status === 'AVAILABLE' ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '4px', fontSize: '10px' }}>
                  {profile?.availability_status}
                </span>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Trust score</span>
                <strong style={{ fontSize: '15px', color: '#0f766e', fontFamily: 'Outfit, sans-serif', display: 'block', marginTop: '2px' }}>
                  {trustDetails?.score !== undefined ? `${trustDetails.score}/100` : 'N/A'}
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', backgroundColor: '#e2f5f3', color: '#0f766e', borderRadius: '4px', fontWeight: '700', fontSize: '10px' }}>
              <Zap size={12} /> LIVE STATUS
            </span>
            {currentActiveJob ? (
              <span>Currently on project: <strong>"{currentActiveJob.requirement_text.slice(0, 40)}..."</strong> (Status: {currentActiveJob.status})</span>
            ) : (
              <span>No active bookings today. Matched opportunity feeds are live!</span>
            )}
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>Recent Trust Change: <strong style={{ color: '#059669' }}>{isAadhaarVerified ? '+20 points (Aadhaar Verified)' : 'Score established'}</strong></span>
          </div>
        </div>

        {/* 1. HOME VIEW */}
        {currentPage === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ borderLeft: '4px solid #0f766e' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Today's Verified Achievements</h4>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle size={20} color="#059669" />
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block' }}>Identity Verified</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{isAadhaarVerified ? 'Official Aadhaar Link confirmed' : 'No Aadhaar uploaded yet'}</span>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TrendingUp size={20} color="#0f766e" />
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block' }}>Recent Endorsement Gain</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{recentEndorsement ? `Endorsed for ${recentEndorsement.skill}` : 'No contractor ratings yet'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: '24px' }}>
              <div className="card">
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Live Dispatch Toggle</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>Update your availability below to refresh geofence matches instantly.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleAvailabilityToggle('AVAILABLE')} className="btn" style={{ flex: 1, backgroundColor: profile?.availability_status === 'AVAILABLE' ? '#0f766e' : '#f1f5f9', color: profile?.availability_status === 'AVAILABLE' ? '#ffffff' : '#475569' }} disabled={actionPending}>
                    <Radio size={14} /> Available
                  </button>
                  <button onClick={() => handleAvailabilityToggle('BUSY')} className="btn" style={{ flex: 1, backgroundColor: profile?.availability_status === 'BUSY' ? '#d97706' : '#f1f5f9', color: profile?.availability_status === 'BUSY' ? '#ffffff' : '#475569' }} disabled={actionPending}>
                    <Clock size={14} /> Busy
                  </button>
                </div>
              </div>

              <div className="card">
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Direct Links</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setCurrentPage('jobs')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '12px' }}>
                    🔍 Apply for New Gig matching
                  </button>
                  <button onClick={() => setCurrentPage('trust')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '12px' }}>
                    📂 Complete Aadhaar verification
                  </button>
                </div>
              </div>
            </div>

            {notifications.length > 0 && (
              <div className="card">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Recent Dispatch Alerts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.slice(0, 3).map(notif => (
                    <div key={notif.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: notif.read_at ? '#ffffff' : '#fffbeb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{notif.payload?.title}</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>{notif.payload?.message}</p>
                      </div>
                      {!notif.read_at && (
                        <button onClick={() => handleReadNotification(notif.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px' }}>Read</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. JOBS VIEW */}
        {currentPage === 'jobs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <VoiceControl userId={user.id} onCommandProcessed={() => fetchDashboardData()} />

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Contractor Project Invitations</h4>
              {assignments.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏢</div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>No Contractor Invitations Awaiting Approval</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 12px 0' }}>Contractor companies direct hire workers for large commercial projects.</p>
                  <button onClick={() => setCurrentPage('profile')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Update skills in profile to match</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {assignments.map(asn => (
                    <div key={asn.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{asn.contractor_company || 'Independent Contractor'}</strong>
                          <p style={{ margin: '4px 0', fontSize: '12px', color: '#475569' }}>Scope: "{asn.requirement_text}"</p>
                        </div>
                        <span className="badge badge-warning" style={{ fontSize: '9px' }}>{asn.status}</span>
                      </div>
                      {asn.status === 'ASSIGNED' && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button onClick={() => handleRespondToAssignment(asn.id, 'REJECTED')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', color: '#e11d48' }} disabled={actionPending}>Decline</button>
                          <button onClick={() => handleRespondToAssignment(asn.id, 'ACCEPTED')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Accept Opportunity</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Geofenced Gig Matches</h4>
              {opportunities.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📍</div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>No Nearby Gig Opportunities Found</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>All matches are calculated within a 5 km geofence of your registered home coordinates.</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => handleAvailabilityToggle('AVAILABLE')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '11px' }} disabled={actionPending}>Toggle Available Status</button>
                    <button onClick={() => setCurrentPage('profile')} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '11px' }}>Update Location GPS</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {opportunities.map(opp => (
                    <div key={opp.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{opp.title}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>{opp.description}</p>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px', fontWeight: '500' }}>Earnings: Rs. {opp.estimated_earnings} | Distance: {opp.distance_km} km</span>
                      </div>
                      <button onClick={() => handleAcceptOpportunity(opp)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '11px' }} disabled={actionPending}>Accept gig</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Secured Gig History</h4>
              {bookings.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>No completed gigs logged.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bookings.map(b => (
                    <div key={b.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{b.contractor_company ? `🏢 ${b.contractor_company}` : `👤 Customer: ${b.customer_name}`}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Scope: "{b.requirement_text.slice(0, 40)}..."</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${b.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{b.status}</span>
                        {b.status === 'REQUESTED' && (
                          <button onClick={() => handleAcceptBooking(b.id)} className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '10px' }} disabled={actionPending}>Accept Booking</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. TRUST VIEW */}
        {currentPage === 'trust' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <TrustScoreGauge 
              score={trustDetails?.score ?? null} 
              version={trustDetails?.version}
              contributingFactors={trustDetails?.contributing_factors}
            />

            <div className="card" style={{ borderLeft: '4px solid #0f766e', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>Verification Progress Milestones</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Complete all verification checklist milestones to unlock elite priority dispatch matching.</p>
                </div>
                <strong style={{ fontSize: '16px', color: '#0f766e', fontFamily: 'Outfit, sans-serif' }}>
                  {verifiedCount === 0 ? '0%' : verifiedCount === 1 ? '50%' : '100%'} Completed
                </strong>
              </div>
              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ height: '100%', backgroundColor: '#0f766e', width: verifiedCount === 0 ? '0%' : verifiedCount === 1 ? '50%' : '100%', transition: 'width 0.4s ease' }}></div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isAadhaarVerified ? '#059669' : '#475569' }}>
                  <Award size={16} /> <strong>Milestone 1:</strong> Link Aadhaar Identity Verification {isAadhaarVerified ? '(Verified ✓)' : '(Pending)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: verifications.some(v => v.type === 'SKILL_CERT' && v.status === 'VERIFIED') ? '#059669' : '#475569' }}>
                  <Award size={16} /> <strong>Milestone 2:</strong> Upload official skill credentials certification {verifications.some(v => v.type === 'SKILL_CERT' && v.status === 'VERIFIED') ? '(Verified ✓)' : '(Pending)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: '24px' }}>
              <div className="card">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Submit Audit Verification Document</h4>
                <form onSubmit={handleDocSubmit}>
                  <div className="form-group">
                    <label className="form-label">Document Type</label>
                    <select className="form-control" value={docType} onChange={e => setDocType(e.target.value as any)}>
                      <option value="ID_DOCUMENT">Aadhaar Card ID</option>
                      <option value="SKILL_CERT">Skill Certificate (Government / Agency)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Verification File Link URL</label>
                    <input type="text" placeholder="https://evidence.domain.in/file.pdf" value={docUrl} onChange={e => setDocUrl(e.target.value)} className="form-control" required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploading}>
                    {uploading ? 'Processing file...' : 'Submit to Verification Agent'}
                  </button>
                </form>
              </div>

              <div className="card">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Submitted Files Checklist</h4>
                {verifications.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>No verifications uploaded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {verifications.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', backgroundColor: '#f8fafc' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{v.type.toLowerCase().replace('_', ' ')}</span>
                        <span className={`badge ${v.status === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}>{v.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. WALLET VIEW */}
        {currentPage === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Active Contracts & Price Negotiations</h4>
              {engagements.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>💸</div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>No Active Negotiations or Contracts Awaiting Review</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 12px 0' }}>Initiate a gig match to bid pricing counter-proposals with customers.</p>
                  <button onClick={() => setCurrentPage('jobs')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Search matching jobs</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {engagements.map(eng => {
                    const lastOffer = eng.offers && eng.offers[0];
                    const isPendingOrNegotiating = eng.status === 'PENDING' || eng.status === 'NEGOTIATING';
                    const lastOfferedByMe = lastOffer && lastOffer.offered_by === user.id;

                    return (
                      <div key={eng.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Client: {eng.initiator_name}</strong>
                            <p style={{ margin: '4px 0', fontSize: '12px', color: '#475569' }}>Scope: "{eng.request_text}"</p>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Current Proposed Price: ₹{lastOffer?.amount || 500}</span>
                          </div>
                          <span className="badge badge-neutral" style={{ fontSize: '9px' }}>{eng.status}</span>
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {isPendingOrNegotiating && !lastOfferedByMe && (
                            <>
                              <button onClick={() => handleRespondToProposal(eng.id, 'ACCEPTED')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Accept (₹{lastOffer?.amount})</button>
                              <button onClick={() => handleRespondToProposal(eng.id, 'REJECTED')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', color: '#e11d48' }} disabled={actionPending}>Reject</button>
                            </>
                          )}
                          {isPendingOrNegotiating && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input type="number" placeholder="Counter offer price" value={counterProposalAmount[eng.id] || ''} onChange={e => setCounterProposalAmount({ ...counterProposalAmount, [eng.id]: e.target.value })} className="form-control" style={{ width: '130px', padding: '6px 10px', fontSize: '11px' }} />
                              <button onClick={() => handleProposePriceOffer(eng.id)} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '11px' }} disabled={actionPending}>Counter</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Verified Transaction Ledger</h4>
              {bookings.filter(b => b.payment_amount).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>No payments logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bookings.filter(b => b.payment_amount).map(b => (
                    <div key={b.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{b.contractor_company ? `🏢 ${b.contractor_company}` : `👤 Customer: ${b.customer_name}`}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Date: {new Date(b.scheduled_start).toLocaleDateString()} | Method: {b.payment_status}</div>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#059669', fontFamily: 'Outfit, sans-serif' }}>+ Rs. {b.payment_amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. PROFILE VIEW */}
        {currentPage === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr', gap: '24px' }}>
            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={16} /> Personal Information
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#475569' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>FULL NAME</span>
                  <strong style={{ color: '#0f172a' }}>{user.full_name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>PHONE NUMBER</span>
                  <strong style={{ color: '#0f172a' }}>{user.phone}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>EMAIL ADDRESS</span>
                  <strong style={{ color: '#0f172a' }}>{user.email || 'None Registered'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>HOME LAT/LNG COORDINATES</span>
                  <strong style={{ color: '#0f172a' }}>{profile?.home_lat?.toFixed(4)} N, {profile?.home_lng?.toFixed(4)} E</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Registered Skills Taxonomy</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {profile?.skills.map((s, idx) => (
                  <span key={idx} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#334155', fontWeight: '600', textTransform: 'capitalize' }}>
                    🔨 {s}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
                <ActivityTimeline userId={user.id} />
              </div>
            </div>
          </div>
        )}

      </main>

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

export default WorkerDashboard;
