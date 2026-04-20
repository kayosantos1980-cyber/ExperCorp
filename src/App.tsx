import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import EmployeeFlow from './components/EmployeeFlow';
import ManagerDashboard from './components/Dashboard';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  if (profile.role === 'manager') {
    return <ManagerDashboard />;
  }

  return <EmployeeFlow />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
