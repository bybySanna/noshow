import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import BusinessDashboard from './pages/business/BusinessDashboard';
import AppointmentsPage from './pages/business/AppointmentsPage';
import StaffPage from './pages/business/StaffPage';
import SettingsPage from './pages/business/SettingsPage';
import AnalyticsPage from './pages/business/AnalyticsPage';
import NotificationsPage from './pages/business/NotificationsPage';
import ClientsRiskPage from './pages/business/ClientsRiskPage';
import CalendarPage from './pages/business/CalendarPage';
import ClientsPage from './pages/business/ClientsPage';
import IntegrationsPage from './pages/business/IntegrationsPage';
import MLScoringPage from './pages/business/MLScoringPage';
import TemplatesPage from './pages/business/TemplatesPage';
import ClientRatingsPage from './pages/business/ClientRatingsPage';
import ThankYouPage from './pages/business/ThankYouPage';
import BusinessMessagesPage from './pages/business/BusinessMessagesPage';
import AutomationPage from './pages/business/AutomationPage';
import BusinessOnboardingPage from './pages/business/OnboardingPage';
import CreditsPage from './pages/business/CreditsPage';
import WheelOfFortunePage from './pages/business/WheelOfFortunePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBusinesses from './pages/admin/AdminBusinesses';
import AdminPlans from './pages/admin/AdminPlans';
import AdminUsers from './pages/admin/AdminUsers';
import AdminActivity from './pages/admin/AdminActivity';
import AdminStats from './pages/admin/AdminStats';
import AdminMessaging from './pages/admin/AdminMessaging';
import StaffDashboard from './pages/staff/StaffDashboard';
import ConfirmPage from './pages/public/ConfirmPage';
import PublicWheelPage from './pages/PublicWheelPage';
import './App.css';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-body">Chargement...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const RedirectIfAuth = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
    if (user.role === 'staff') return <Navigate to="/staff-dashboard" replace />;
    if (!user.business_id) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/confirm/:token" element={<ConfirmPage />} />
      <Route path="/play/:code" element={<PublicWheelPage />} />

      {/* Auth */}
      <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
      <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<ProtectedRoute roles={['business_owner']}><OnboardingPage /></ProtectedRoute>} />

      {/* Business */}
      <Route path="/dashboard" element={<ProtectedRoute roles={['business_owner']}><BusinessDashboard /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute roles={['business_owner']}><AppointmentsPage /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute roles={['business_owner']}><StaffPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute roles={['business_owner']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute roles={['business_owner']}><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute roles={['business_owner']}><NotificationsPage /></ProtectedRoute>} />
      <Route path="/clients-risk" element={<ProtectedRoute roles={['business_owner']}><ClientsRiskPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute roles={['business_owner']}><CalendarPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute roles={['business_owner']}><ClientsPage /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute roles={['business_owner']}><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/ml-scoring" element={<ProtectedRoute roles={['business_owner']}><MLScoringPage /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute roles={['business_owner']}><TemplatesPage /></ProtectedRoute>} />
      <Route path="/client-ratings" element={<ProtectedRoute roles={['business_owner']}><ClientRatingsPage /></ProtectedRoute>} />
      <Route path="/thankyou" element={<ProtectedRoute roles={['business_owner']}><ThankYouPage /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute roles={['business_owner']}><BusinessMessagesPage /></ProtectedRoute>} />
      <Route path="/automation" element={<ProtectedRoute roles={['business_owner']}><AutomationPage /></ProtectedRoute>} />
      <Route path="/setup" element={<ProtectedRoute roles={['business_owner']}><BusinessOnboardingPage /></ProtectedRoute>} />
      <Route path="/credits" element={<ProtectedRoute roles={['business_owner']}><CreditsPage /></ProtectedRoute>} />
      <Route path="/wheel" element={<ProtectedRoute roles={['business_owner']}><WheelOfFortunePage /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['super_admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/businesses" element={<ProtectedRoute roles={['super_admin']}><AdminBusinesses /></ProtectedRoute>} />
      <Route path="/admin/plans" element={<ProtectedRoute roles={['super_admin']}><AdminPlans /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['super_admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute roles={['super_admin']}><AdminActivity /></ProtectedRoute>} />
      <Route path="/admin/stats" element={<ProtectedRoute roles={['super_admin']}><AdminStats /></ProtectedRoute>} />
      <Route path="/admin/messaging" element={<ProtectedRoute roles={['super_admin']}><AdminMessaging /></ProtectedRoute>} />

      {/* Staff */}
      <Route path="/staff-dashboard" element={<ProtectedRoute roles={['staff']}><StaffDashboard /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-center" richColors expand />
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}

export default App;
