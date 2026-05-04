import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shell/AppShell.jsx';
import './styles/globals.css';

import '@legacy/css/app.css';

function Root() {
  useEffect(() => {
    document.body.classList.add('app-booting');

    import('@legacy/js/main.js').catch((error) => {
      console.error('Frontend bootstrap failed:', error);
    });
  }, []);

  return <AppShell />;
}

createRoot(document.getElementById('root')).render(<Root />);
