import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shell/AppShell.jsx';
import './styles/globals.css';
import './i18n.js';

import { TooltipProvider } from "@/components/ui/tooltip";

function Root() {
  useEffect(() => {
    document.body.classList.add('app-booting');
  }, []);

  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
