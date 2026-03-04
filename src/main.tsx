import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept fetch to prepend API base URL for Capacitor app
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    resource = baseUrl + resource;
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
