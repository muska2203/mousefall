import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import App from './ui/App';
import { bootstrapContent } from './bootstrap';

import './ui/styles/game-screen.css';
import './ui/styles/welcome.css';
import './ui/styles/runtime.css';
import './ui/styles/ending.css';
import './ui/styles/toasts.css';

async function bootstrap() {
  await bootstrapContent();

  const rootElement = document.getElementById('app');
  if (!rootElement) {
    throw new Error('Root element #app not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
