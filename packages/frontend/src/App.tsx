import React, { useState, useEffect } from 'react';
import { trpc } from './lib/trpc';
import { LoginForm } from './components/LoginForm';
import { ChatApp } from './components/ChatApp';

export default function App() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app load
  const { data: authData, refetch: refetchAuth } = trpc.auth.checkAuth.useQuery(undefined, {
    onSuccess: (data) => {
      console.log('Auth check result:', data);
      setUser(data.isAuthenticated ? data.user : null);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Auth check error:', error);
      setUser(null);
      setIsLoading(false);
    },
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Clear localStorage token
      localStorage.removeItem('auth-token');
      setUser(null);
      refetchAuth();
    },
  });

  const handleLoginSuccess = (userData: { id: number; username: string }) => {
    console.log('Login success, user data:', userData);
    setUser(userData);
    // Refetch to make sure the cookie is properly set
    setTimeout(() => refetchAuth(), 100);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return <ChatApp user={user} onLogout={handleLogout} />;
}