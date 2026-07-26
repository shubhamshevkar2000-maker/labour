import React, { useState, useEffect } from 'react';

interface TimelineEvent {
  title: string;
  description: string;
  date: string;
  type: string;
}

interface ActivityTimelineProps {
  userId: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ userId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, [userId]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${userId}/timeline`);
      if (!res.ok) throw new Error('Failed to load official activity timeline records.');
      const data = await res.json();
      setEvents(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getEventBadgeStyles = (type: string) => {
    switch (type) {
      case 'VERIFICATION_APPROVED':
      case 'JOB_COMPLETED':
      case 'BOOKING_COMPLETED':
      case 'PAYMENT_CONFIRMED':
        return { bg: '#e2f5f3', color: '#0f766e', border: '1px solid #99f6e4' };
      case 'FRAUD_FLAG_RAISED':
        return { bg: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
      case 'FRAUD_FLAG_CLEARED':
        return { bg: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  if (loading) {
    return <div style={{ fontSize: '13px', color: '#64748b', padding: '12px' }}>Querying audit logs...</div>;
  }

  if (error) {
    return <div style={{ color: '#ef4444', fontSize: '13px', padding: '12px' }}>Error: {error}</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Official Activity Timeline
        </h4>
        <button 
          onClick={fetchTimeline} 
          style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#334155' }}
        >
          Refresh Feed
        </button>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
          No recorded timeline events for this profile.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #cbd5e1', marginLeft: '8px' }}>
          {events.map((e, index) => {
            const badge = getEventBadgeStyles(e.type);
            return (
              <div key={index} style={{ position: 'relative', marginBottom: '20px' }}>
                {/* Dot */}
                <div style={{ 
                  position: 'absolute', 
                  left: '-31px', 
                  top: '2px', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: badge.color, 
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }} />
                
                {/* Content */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      padding: '2px 6px', 
                      borderRadius: '3px', 
                      backgroundColor: badge.bg, 
                      color: badge.color,
                      border: badge.border,
                      marginRight: '8px'
                    }}>
                      {e.title}
                    </span>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>
                      {e.description}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                    {new Date(e.date).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ActivityTimeline;
