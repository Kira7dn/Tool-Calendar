import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './shell/AppShell.jsx';
import { LoginPage } from './pages/Login.jsx';
import './styles/globals.css';

import { TooltipProvider } from "@/components/ui/tooltip";

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('auth_token'));

  useEffect(() => {
    document.body.classList.add('app-booting');
    
    // Listen for storage changes (e.g. logout from another tab)
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('auth_token'));
    };

    // Listen for unauthorized event from anywhere in the app
    const handleUnauthorized = () => {
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('auth:unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
