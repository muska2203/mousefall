import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import App from './ui/App';
import {bootstrap} from './bootstrap';

import './ui/styles/game-screen.css';
import './ui/styles/welcome.css';
import './ui/styles/runtime.css';
import './ui/styles/ending.css';
import './ui/styles/toasts.css';

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100vw',
  height: '100vh',
  background: '#1a120b',
  color: '#e8d4b8',
  fontFamily: 'serif',
  fontSize: '1.5rem',
};

const errorStyles: React.CSSProperties = {
  ...loadingStyles,
  color: '#e74c3c',
  padding: '2rem',
  textAlign: 'center',
  whiteSpace: 'pre-wrap',
};

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    bootstrap()
      .then(() => setReady(true))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      });
  }, []);

  if (error) {
    return <div style={errorStyles}>{error}</div>;
  }
  if (!ready) {
    return <div style={loadingStyles}>Loading...</div>;
  }
  return <App />;
}

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
