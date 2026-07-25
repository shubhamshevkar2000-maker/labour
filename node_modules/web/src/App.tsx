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
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setProfileId(data.profileId);
      } else {
        setUser(null);
        setProfileId('');
      }
    } catch (e) {
      setUser(null);
      setProfileId('');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: User, id: string) => {
    setUser(loggedInUser);
    setProfileId(id);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setProfileId('');
    } catch (e) {
      alert('Logout failed');
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
