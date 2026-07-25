import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Centralized sessionStorage fetch interceptor for independent tab authentication
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const sessionStr = sessionStorage.getItem('session');
  let token = '';
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      token = session.token;
    } catch (e) {}
  }

  const newInit: RequestInit = { ...init };

  // Omit cookies to prevent browser-wide cross-tab session contamination
  newInit.credentials = 'omit';

  // Attach jwt token if session exists
  if (token) {
    const headers = new Headers(newInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    newInit.headers = headers;
  }

  return originalFetch(input, newInit);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
