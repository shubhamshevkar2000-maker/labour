import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import WorkerDashboard from './pages/worker/Dashboard';
import ContractorDashboard from './pages/contractor/Dashboard';
import CustomerDashboard from './pages/customer/Dashboard';
import AdminConsole from './pages/admin/Console';
import { User } from 'shared-types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const sessionStr = sessionStorage.getItem('session');
      if (!sessionStr) {
        setUser(null);
        setProfileId('');
        // Redirect to /auth/worker (landing/role selection start) if not already on an auth route
        const path = window.location.pathname;
        if (!['/auth/worker', '/auth/customer', '/auth/contractor', '/auth/admin'].includes(path)) {
          window.history.replaceState({}, '', '/auth/worker');
        }
        setCheckingAuth(false);
        return;
      }

      const session = JSON.parse(sessionStr);
      // We pass Authorization header specifically
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setProfileId(data.profileId);
        
        // Route protection: make sure path matches expected role dashboard path
        const expectedPath = `/auth/${data.user.role.toLowerCase()}`;
        if (window.location.pathname !== expectedPath) {
          window.history.replaceState({}, '', expectedPath);
        }
      } else {
        sessionStorage.removeItem('session');
        setUser(null);
        setProfileId('');
        window.history.replaceState({}, '', '/auth/worker');
      }
    } catch (e) {
      sessionStorage.removeItem('session');
      setUser(null);
      setProfileId('');
      window.history.replaceState({}, '', '/auth/worker');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: User, id: string, token: string) => {
    sessionStorage.setItem('session', JSON.stringify({ user: loggedInUser, profileId: id, token }));
    setUser(loggedInUser);
    setProfileId(id);
    window.history.pushState({}, '', `/auth/${loggedInUser.role.toLowerCase()}`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout API call failed', e);
    } finally {
      sessionStorage.removeItem('session');
      setUser(null);
      setProfileId('');
      window.history.pushState({}, '', '/auth/worker');
    }
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f1f5f9', color: '#475569' }}>
        <div>Securing official session channel...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render dashboard based on role
  if (user.role === 'WORKER') {
    return <WorkerDashboard user={user} profileId={profileId} onLogout={handleLogout} />;
  }

  if (user.role === 'CONTRACTOR') {
    return <ContractorDashboard user={user} profileId={profileId} onLogout={handleLogout} />;
  }

  if (user.role === 'CUSTOMER') {
    return <CustomerDashboard user={user} profileId={profileId} onLogout={handleLogout} />;
  }

  if (user.role === 'ADMIN') {
    return <AdminConsole user={user} onLogout={handleLogout} />;
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h3>System Error: Unknown role classification</h3>
      <button className="btn btn-primary" onClick={handleLogout} style={{ marginTop: '16px' }}>Reset Connection</button>
    </div>
  );
};
export default App;
