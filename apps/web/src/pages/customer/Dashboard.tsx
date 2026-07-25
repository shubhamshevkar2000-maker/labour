import React, { useState, useEffect } from 'react';
import { User } from 'shared-types';
import { 
  Building, 
  Briefcase, 
  Home, 
  CreditCard, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  Sparkles,
  MapPin,
  CheckCircle,
  FileText
} from 'lucide-react';
import ActivityTimeline from '../../components/ActivityTimeline';
import TrustScoreBreakdownModal from '../../components/TrustScoreBreakdownModal';

interface CustomerDashboardProps {
  user: User;
  profileId: string;
  onLogout: () => void;
}

interface ToastMsg {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user, profileId, onLogout }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingAssignments, setBookingAssignments] = useState<{ [bookingId: string]: any[] }>({});
  const [contractors, setContractors] = useState<any[]>([]);
  
  // Hiring States
  const [hireMode, setHireMode] = useState<'WORKER' | 'CONTRACTOR'>('WORKER');
  const [rawText, setRawText] = useState<string>('');
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Recommendations & Matches Feed
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [activeExplainWorkerId, setActiveExplainWorkerId] = useState<string | null>(null);

  // Engagement & Negotiation States
  const [engagements, setEngagements] = useState<any[]>([]);
  const [counterProposalAmount, setCounterProposalAmount] = useState<{ [engagementId: string]: string }>({});

  // Disputes States
  const [disputingEngagementId, setDisputingEngagementId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputePhotos, setDisputePhotos] = useState<string>('');

  // Payout Overlays
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('500');
  const [paymentMethod, setPaymentMethod] = useState<'UPI_VERIFIED' | 'CASH_ATTESTED' | 'BANK_VERIFIED'>('UPI_VERIFIED');

  // Rating Overlays
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingWorkerId, setRatingWorkerId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');

  // Local Page Navigation state
  const [currentPage, setCurrentPage] = useState<'home' | 'bookings' | 'workers' | 'payments' | 'profile'>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [actionPending, setActionPending] = useState<boolean>(false);

  useEffect(() => {
    fetchBookings();
    fetchContractors();
    fetchEngagements();
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

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?userId=${profileId}&role=CUSTOMER`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
        data.forEach((b: any) => {
          if (b.contractor_id) {
            fetchBookingAssignments(b.id);
          }
        });
      }
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingAssignments = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setBookingAssignments(prev => ({ ...prev, [bookingId]: data }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContractors = async () => {
    try {
      const res = await fetch('/api/customer/contractors');
      if (res.ok) {
        const data = await res.json();
        setContractors(data);
        if (data.length > 0) setSelectedContractorId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEngagements = async () => {
    try {
      const res = await fetch(`/api/engagements?userId=${user.id}&role=CUSTOMER`);
      if (res.ok) {
        const data = await res.json();
        setEngagements(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickAction = (skill: string) => {
    setRawText(`Need a certified ${skill} to help with repairs and installations at my residence.`);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() || submitting) return;

    setSubmitting(true);
    setRecommendations([]);

    try {
      if (hireMode === 'WORKER') {
        const res = await fetch('/api/customer/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: profileId,
            requirement_text: rawText
          })
        });

        if (!res.ok) throw new Error('Failed to submit service request');
        const data = await res.json();
        
        setActiveReqId(data.requestId);
        setRecommendations(data.recommendations || []);
        
        showToast(`Service Request submitted! Found ${data.recommendations?.length || 0} matching worker recommendations nearby.`, 'SUCCESS');
        setCurrentPage('workers');
      } else {
        await handleBookContractor(profileId, selectedContractorId);
      }
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookWorker = async (workerId: string) => {
    if (!activeReqId || actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/requests/${activeReqId}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'DIRECT_WORKER',
          initiator_id: user.id,
          counterparty_id: workerId,
          initial_amount: 500,
          note: 'Initial hiring request for direct worker.'
        })
      });

      if (!res.ok) throw new Error('Engagement could not be created');
      showToast('Worker hiring engagement initiated! Awaiting worker response.', 'SUCCESS');
      setActiveReqId(null);
      setRecommendations([]);
      fetchEngagements();
      setCurrentPage('bookings');
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleBookContractor = async (reqId: string, contractorId: string) => {
    try {
      const res = await fetch(`/api/requests/${reqId}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'VIA_CONTRACTOR',
          initiator_id: user.id,
          counterparty_id: contractorId,
          initial_amount: 1500,
          note: 'Initial contractor project engagement.'
        })
      });

      if (!res.ok) throw new Error('Contractor engagement failed');
      showToast('Contractor project engagement initiated successfully!', 'SUCCESS');
      fetchEngagements();
      setCurrentPage('bookings');
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    }
  };

  const handleProposePriceOffer = async (engagementId: string) => {
    if (actionPending) return;
    const amountStr = counterProposalAmount[engagementId];
    if (!amountStr || isNaN(parseFloat(amountStr))) {
      showToast('Please enter a valid counter-offer price.', 'WARNING');
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
          note: 'Customer Counter Proposal'
        })
      });

      if (!res.ok) throw new Error('Failed to submit price counter proposal.');
      showToast('Price counter bid proposed successfully!', 'SUCCESS');
      setCounterProposalAmount(prev => ({ ...prev, [engagementId]: '' }));
      fetchEngagements();
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

      if (!res.ok) throw new Error('Failed to submit response.');
      showToast(`Proposal ${response.toLowerCase()} successfully!`, 'SUCCESS');
      fetchEngagements();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleUpdateEngagementStatus = async (engagementId: string, status: string) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update engagement status.');
      showToast(`Status updated to ${status}!`, 'SUCCESS');
      fetchEngagements();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleRaiseDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingEngagementId || !disputeReason || actionPending) return;

    setActionPending(true);
    try {
      const res = await fetch(`/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_id: disputingEngagementId,
          raised_by: user.id,
          reason: disputeReason,
          evidence_urls: disputePhotos ? [disputePhotos] : []
        })
      });

      if (!res.ok) throw new Error('Failed to raise dispute');
      showToast('Dispute raised successfully. Dispute hold applied.', 'SUCCESS');
      setDisputingEngagementId(null);
      setDisputeReason('');
      setDisputePhotos('');
      fetchEngagements();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark booking as completed');
      showToast('Booking marked as completed successfully!', 'SUCCESS');
      fetchBookings();
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBookingId || !ratingWorkerId || actionPending) return;

    setActionPending(true);
    try {
      const res = await fetch(`/api/bookings/${ratingBookingId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rater_id: user.id,
          ratee_id: ratingWorkerId,
          score: ratingScore,
          comment: ratingComment
        })
      });

      if (!res.ok) throw new Error('Rating submission failed');
      showToast('Performance rating submitted successfully!', 'SUCCESS');
      setRatingBookingId(null);
      setRatingWorkerId(null);
      setRatingComment('');
    } catch (err: any) {
      showToast(err.message, 'ERROR');
    } finally {
      setActionPending(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBookingId || actionPending) return;

    setActionPending(true);
    try {
      const res = await fetch(`/api/bookings/${paymentBookingId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          confirmation_method: paymentMethod
        })
      });

      if (!res.ok) throw new Error('Payment confirmation failed');
      showToast('Payment confirmed and settled successfully!', 'SUCCESS');
      setPaymentBookingId(null);
      fetchBookings();
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
    { id: 'home', label: 'Home', icon: <Home size={16} /> },
    { id: 'bookings', label: 'Bookings', icon: <Briefcase size={16} /> },
    { id: 'workers', label: 'Workers', icon: <Users size={16} /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard size={16} /> },
    { id: 'profile', label: 'Profile', icon: <Building size={16} /> }
  ];

  const activeEngagements = engagements.filter(e => e.status !== 'PENDING' && e.status !== 'NEGOTIATING');
  const negotiatingEngagements = engagements.filter(e => e.status === 'PENDING' || e.status === 'NEGOTIATING');

  const upcomingBooking = bookings.find(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const completedPaymentsCount = bookings.filter(b => b.payment_amount).length;

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
              <Building size={20} color="#0f766e" />
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
                Residential Hiring Portal
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                Namaste, {user.full_name}
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Initiate geofenced matching, confirm cash/UPI settlements, and file disputes.
              </p>
            </div>
            
            {/* Contextual Stats Summary Banners */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Active Booking</span>
                <span className={`badge ${upcomingBooking ? 'badge-success' : 'badge-neutral'}`} style={{ marginTop: '4px', fontSize: '10px' }}>
                  {upcomingBooking ? '1 Active' : 'No active'}
                </span>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Paid Ledgers</span>
                <strong style={{ fontSize: '15px', color: '#0f766e', fontFamily: 'Outfit, sans-serif', display: 'block', marginTop: '2px' }}>
                  {completedPaymentsCount} settlements
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
            {upcomingBooking ? (
              <span>Upcoming Booking active: <strong>"{upcomingBooking.requirement_text.slice(0, 40)}..."</strong> status is currently <strong>{upcomingBooking.status}</strong>.</span>
            ) : (
              <span>No active bookings today. Submit a request below to match instantly.</span>
            )}
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>Settled transactions: <strong style={{ color: '#059669' }}>{completedPaymentsCount} logs verified</strong></span>
          </div>
        </div>

        {/* 1. HOME VIEW */}
        {currentPage === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} color="#0f766e" /> NEED A WORKER TODAY?</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>Describe your requirement below. Our geofenced matching algorithms will list recommended candidates instantly.</p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => { setHireMode('WORKER'); setRecommendations([]); }}
                  className="btn"
                  style={{
                    flex: 1, padding: '12px', fontSize: '13px', fontWeight: '700', borderRadius: '8px', border: 'none',
                    backgroundColor: hireMode === 'WORKER' ? '#0f766e' : '#f1f5f9',
                    color: hireMode === 'WORKER' ? '#ffffff' : '#475569'
                  }}
                >
                  💼 Option 1: Hire a Worker
                </button>
                <button 
                  type="button" 
                  onClick={() => { setHireMode('CONTRACTOR'); setRecommendations([]); }}
                  className="btn"
                  style={{
                    flex: 1, padding: '12px', fontSize: '13px', fontWeight: '700', borderRadius: '8px', border: 'none',
                    backgroundColor: hireMode === 'CONTRACTOR' ? '#0f766e' : '#f1f5f9',
                    color: hireMode === 'CONTRACTOR' ? '#ffffff' : '#475569'
                  }}
                >
                  🏢 Option 2: Hire a Contractor
                </button>
              </div>

              {hireMode === 'WORKER' && (
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Quick Categories:</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleQuickAction('plumber')} style={quickBtnStyle}>🔧 Plumber</button>
                    <button type="button" onClick={() => handleQuickAction('electrician')} style={quickBtnStyle}>⚡ Electrician</button>
                    <button type="button" onClick={() => handleQuickAction('painter')} style={quickBtnStyle}>🎨 Painter</button>
                    <button type="button" onClick={() => handleQuickAction('carpenter')} style={quickBtnStyle}>🪚 Carpenter</button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitRequest}>
                <div className="form-group">
                  <label className="form-label">
                    {hireMode === 'WORKER' ? 'Describe the work needed' : 'Describe the contractor project scope'}
                  </label>
                  <textarea 
                    className="form-control"
                    style={{ minHeight: '90px', resize: 'vertical' }}
                    placeholder={hireMode === 'WORKER' ? "e.g. Need a plumber to fix a leaking tap in the bathroom..." : "e.g. Renovation of a 2BHK flat including tiling, painting, and electric work..."}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    required
                  />
                </div>

                {hireMode === 'CONTRACTOR' && (
                  <div className="form-group">
                    <label className="form-label">Select Contractor</label>
                    <select value={selectedContractorId} onChange={(e) => setSelectedContractorId(e.target.value)} className="form-control" style={{ padding: '10px 14px' }}>
                      {contractors.map(c => (
                        <option key={c.id} value={c.id}>{c.company_name} ({c.full_name})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={submitting}>
                  {submitting ? 'Processing request...' : hireMode === 'WORKER' ? 'Search Matches' : 'Book Contractor'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2. BOOKINGS VIEW */}
        {currentPage === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>ENGAGEMENT HISTORY</h3>
              {bookings.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>No History Bookings Found</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>Engagements appear here once you search and hire matching candidates.</p>
                  <button onClick={() => setCurrentPage('home')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '11px' }}>Create New Request</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {bookings.map((b) => (
                    <div key={b.id} style={{ padding: '18px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>ID: {b.id.substring(0, 8)}...</span>
                          <h4 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                            {b.contractor_id ? `🏢 Contractor: ${b.contractor_name} (${b.contractor_company})` : `👤 Worker: ${b.worker_name}`}
                          </h4>
                        </div>
                        <span className={`badge ${b.status === 'COMPLETED' ? 'badge-success' : (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-neutral')}`}>{b.status}</span>
                      </div>

                      <p style={{ margin: '8px 0', fontSize: '13px', color: '#475569' }}>
                        Requirement: <em>"{b.requirement_text}"</em>
                      </p>

                      {b.contractor_id && bookingAssignments[b.id] && bookingAssignments[b.id].length > 0 && (
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                            Contractor Worker Assignments:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {bookingAssignments[b.id].map((asn: any) => (
                              <div key={asn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                <span style={{ fontWeight: '500', color: '#1e293b' }}>👤 {asn.worker_name}</span>
                                <span className={`badge ${asn.status === 'ACCEPTED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '9px' }}>{asn.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {(b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') && (
                          <button onClick={() => handleCompleteBooking(b.id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Complete Booking</button>
                        )}
                        {b.status === 'COMPLETED' && !b.payment_amount && (
                          <button onClick={() => { setPaymentBookingId(b.id); setPaymentAmount('500'); }} className="btn btn-accent" style={{ padding: '6px 12px', fontSize: '11px' }}>💸 Confirm Payment</button>
                        )}
                        {b.status === 'COMPLETED' && (
                          <button onClick={() => { setRatingBookingId(b.id); setRatingWorkerId(b.worker_id || ''); }} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={!b.worker_id || actionPending}>⭐ Rate Worker</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeEngagements.length > 0 && (
              <div className="card">
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Active Workflow & Disputes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeEngagements.map(eng => (
                    <div key={eng.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#0f172a' }}>{eng.counterparty_name} ({eng.mode === 'DIRECT_WORKER' ? 'Worker' : 'Contractor'})</strong>
                        <span className="badge badge-neutral" style={{ fontSize: '9px' }}>{eng.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px', flexWrap: 'wrap' }}>
                        {eng.status === 'ACCEPTED' && (
                          <>
                            <button onClick={() => handleUpdateEngagementStatus(eng.id, 'IN_PROGRESS')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Start Work</button>
                            <button onClick={() => handleUpdateEngagementStatus(eng.id, 'CANCELLED')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', color: '#e11d48' }} disabled={actionPending}>Cancel</button>
                          </>
                        )}
                        {eng.status === 'IN_PROGRESS' && (
                          <>
                            <button onClick={() => handleUpdateEngagementStatus(eng.id, 'COMPLETED')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#059669' }} disabled={actionPending}>Complete</button>
                            <button onClick={() => setDisputingEngagementId(eng.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }}>Dispute</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. WORKERS VIEW */}
        {currentPage === 'workers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {recommendations.length > 0 ? (
              <div className="card" style={{ backgroundColor: 'rgba(15,118,110,0.02)', borderColor: '#99f6e4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f766e', fontWeight: '700' }}>RECOMMENDED WORKER MATCHES</h3>
                  <button onClick={() => { setRecommendations([]); setActiveReqId(null); }} className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>Clear Results</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {recommendations.map((rec) => (
                    <div key={rec.worker_id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'rgba(15,118,110,0.06)', borderRadius: '6px', fontSize: '11px', color: '#0f766e', fontWeight: '700' }}>
                        <Sparkles size={14} /> EXPLAINABILITY ASSIGNMENT: {rec.explanation}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{rec.full_name}</strong>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {rec.skills.map((s: string, i: number) => (
                              <span key={i} style={{ fontSize: '10px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontWeight: '600' }}>{s}</span>
                            ))}
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f766e', fontFamily: 'Outfit, sans-serif' }}>{rec.match_score}% Match Score</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', borderTop: '1px solid #cbd5e1', paddingTop: '10px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#64748b" /> Distance: {rec.distance_km} km
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} color="#059669" /> Level: {rec.trust_score !== null ? `${rec.trust_score}% Trust` : 'Unestablished'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} color="#2563eb" /> Status: Aadhaar Link ✓
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                        <button onClick={() => setActiveExplainWorkerId(rec.worker_id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Why this score?</button>
                        <button onClick={() => handleBookWorker(rec.worker_id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Book Worker</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>No Worker Recommendations Matches Loaded</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>Matche details appear here immediately once you submit a gig request on the Home tab.</p>
                <button onClick={() => setCurrentPage('home')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '11px' }}>Go to Request Form</button>
              </div>
            )}

            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}><Building size={18} color="#0f766e" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} /> Certified Contractors Directory</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                {contractors.map(c => (
                  <div key={c.id} style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                    <strong style={{ fontSize: '13px', color: '#0f766e' }}>🏢 {c.company_name}</strong>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>Director: {c.full_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Contact: {c.phone}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. PAYMENTS VIEW */}
        {currentPage === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Active Price Negotiations</h3>
              {negotiatingEngagements.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No active negotiation bids.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {negotiatingEngagements.map(eng => {
                    const lastOffer = eng.offers && eng.offers[0];
                    const isPendingOrNegotiating = eng.status === 'PENDING' || eng.status === 'NEGOTIATING';
                    const lastOfferedByMe = lastOffer && lastOffer.offered_by === user.id;

                    return (
                      <div key={eng.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <strong style={{ color: '#0f172a' }}>Counterparty: {eng.counterparty_name}</strong>
                            <p style={{ margin: '4px 0', fontSize: '12px', color: '#475569' }}>Scope: "{eng.request_text}"</p>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Last Bid: ₹{lastOffer?.amount || 500}</span>
                          </div>
                          <span className="badge badge-neutral" style={{ fontSize: '9px' }}>{eng.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {isPendingOrNegotiating && !lastOfferedByMe && (
                            <>
                              <button onClick={() => handleRespondToProposal(eng.id, 'ACCEPTED')} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={actionPending}>Accept Offer (₹{lastOffer?.amount})</button>
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
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Confirmed Client Payments Ledger</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bookings.filter(b => b.payment_amount).length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No payments recorded yet.</div>
                ) : (
                  bookings.filter(b => b.payment_amount).map(b => (
                    <div key={b.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#0f172a' }}>{b.contractor_id ? `🏢 Contractor Project: ${b.contractor_company}` : `👤 Worker Job: ${b.worker_name}`}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Date: {new Date(b.scheduled_start).toLocaleDateString()} | Method: {b.payment_status}</div>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>- Rs. {b.payment_amount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. PROFILE VIEW */}
        {currentPage === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr', gap: '24px' }}>
            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Client Details</h4>
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
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>ACCOUNT TYPE</span>
                  <strong style={{ color: '#0f172a' }}>Residential Customer</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Security Activity Logs</h4>
              <ActivityTimeline userId={user.id} />
            </div>
          </div>
        )}

      </main>

      {activeExplainWorkerId && (
        <TrustScoreBreakdownModal workerId={activeExplainWorkerId} onClose={() => setActiveExplainWorkerId(null)} />
      )}

      {/* Rate worker modal */}
      {ratingBookingId && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Rate Worker Performance</h3>
            </div>
            <form onSubmit={handleRatingSubmit}>
              <div style={{ padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Score (1 to 5 Stars)</label>
                  <select className="form-control" value={ratingScore} onChange={(e) => setRatingScore(parseInt(e.target.value))}>
                    <option value={5}>5 Stars - Excellent (बहुत बढ़िया)</option>
                    <option value={4}>4 Stars - Good (अच्छा)</option>
                    <option value={3}>3 Stars - Average (ठीक ठाक)</option>
                    <option value={2}>2 Stars - Poor (खराब)</option>
                    <option value={1}>1 Star - Critical (बहुत खराब)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Comments / Review</label>
                  <textarea className="form-control" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Enter honest feedback..." style={{ minHeight: '60px' }} required />
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => { setRatingBookingId(null); setRatingWorkerId(null); }} className="btn btn-secondary" style={{ fontSize: '12px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '12px' }} disabled={actionPending}>Submit Rating</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment confirmation modal */}
      {paymentBookingId && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Attest & Confirm Payment</h3>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div style={{ padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">UPI Amount Paid (Rs.)</label>
                  <input type="number" className="form-control" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Attestation Channel</label>
                  <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                    <option value="UPI_VERIFIED">UPI Transaction Verification</option>
                    <option value="CASH_ATTESTED">Cash Hand-to-Hand Attested</option>
                    <option value="BANK_VERIFIED">Direct IMPS/Bank Transferred</option>
                  </select>
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setPaymentBookingId(null)} className="btn btn-secondary" style={{ fontSize: '12px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '12px' }} disabled={actionPending}>Attest Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Dispute Modal */}
      {disputingEngagementId && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#e11d48', fontWeight: '700' }}>Raise Dispute / Conflict Audit</h3>
            </div>
            <form onSubmit={handleRaiseDisputeSubmit}>
              <div style={{ padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Reason for Dispute</label>
                  <textarea className="form-control" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Describe the issue in detail..." style={{ minHeight: '80px' }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Evidence Photo URL (Optional)</label>
                  <input type="text" className="form-control" value={disputePhotos} onChange={(e) => setDisputePhotos(e.target.value)} placeholder="https://evidence.domain.com/photo.jpg" />
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setDisputingEngagementId(null)} className="btn btn-secondary" style={{ fontSize: '12px' }}>Cancel</button>
                <button type="submit" className="btn btn-danger" style={{ fontSize: '12px' }} disabled={actionPending}>Submit Dispute</button>
              </div>
            </form>
          </div>
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

const quickBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #cbd5e1',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
  color: '#334155',
  fontWeight: '600',
  transition: 'all 0.15s ease'
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  width: '90%',
  maxWidth: '420px',
  borderRadius: '12px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  overflow: 'hidden',
  border: '1px solid #e2e8f0'
};

const modalFooterStyle: React.CSSProperties = {
  padding: '14px 20px',
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #cbd5e1',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px'
};

export default CustomerDashboard;
