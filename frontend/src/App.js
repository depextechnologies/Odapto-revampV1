import React, { useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import WorkspacePage from './pages/WorkspacePage';
import BoardPage from './pages/BoardPage';
import TemplatesPage from './pages/TemplatesPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import IntegrationsPage from './pages/IntegrationsPage';
import HelpPage from './pages/HelpPage';
import UpgradePage from './pages/UpgradePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import AnimatedSplashScreen from './components/AnimatedSplashScreen';

// Google OAuth callback component — receives code from Google, sends to backend
const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { processGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      processGoogleCallback(code)
        .then(() => {
          navigate('/dashboard', { replace: true });
        })
        .catch((error) => {
          console.error('Google OAuth error:', error);
          navigate('/login', { replace: true });
        });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, processGoogleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};

// Protected route wrapper
const ProtectedRoute = ({ children, requireAdmin = false, requirePrivileged = false }) => {
  const { user, loading, isAdmin, isPrivileged } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-odapto-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check both React state AND localStorage token (handles race condition after login/register)
  const hasToken = !!localStorage.getItem('odapto_session_token');
  if (!user && !hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requirePrivileged && !isPrivileged) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Root route handler - shows splash on native, landing on web
const RootRoute = () => {
  if (Capacitor.isNativePlatform()) {
    return <AnimatedSplashScreen />;
  }
  return <LandingPage />;
};

// App router
const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/splash" element={<AnimatedSplashScreen />} />
      <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/templates" element={<TemplatesPage />} />
      <Route path="/invite/accept" element={<AcceptInvitePage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:boardId"
        element={
          <ProtectedRoute>
            <BoardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <UpgradePage />
          </ProtectedRoute>
        }
      />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
