import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';

import './ui/styles/game-screen.css';
import './ui/styles/welcome.css';
import './ui/styles/runtime.css';
import './ui/styles/ending.css';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
