// Hovedfil - setter opp alle sider og beskytter de som krever innlogging

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CompanyDashboard from './pages/CompanyDashboard';
import UserDashboard from './pages/UserDashboard';
import JobsPage from './pages/JobsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';

import './index.css';

// Beskytter sider som krever innlogging
// Sender bruker til login hvis de ikke er logget inn
function ProtectedRoute({ children, requiredUserType }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Laster...</div>;
  }

  // Ikke innlogget? Send til login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Feil brukertype? Send til riktig dashboard
  if (requiredUserType && userData?.userType !== requiredUserType) {
    if (userData?.userType === 'company') {
      return <Navigate to="/dashboard/company" />;
    } else {
      return <Navigate to="/dashboard/user" />;
    }
  }

  return children;
}

// Landingsside - sender innloggede brukere til sitt dashboard
function HomeRoute() {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Laster...</div>;
  }

  // Innlogget? Send til riktig dashboard
  if (currentUser && userData) {
    if (userData.userType === 'company') {
      return <Navigate to="/dashboard/company" />;
    } else {
      return <Navigate to="/dashboard/user" />;
    }
  }

  // Ikke innlogget? Vis landingssiden
  return <LandingPage />;
}

// Auth-sider (login/register) - sender innloggede brukere til dashboard
function AuthRoute({ children }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Laster...</div>;
  }

  // Allerede innlogget? Send til dashboard
  if (currentUser && userData) {
    if (userData.userType === 'company') {
      return <Navigate to="/dashboard/company" />;
    } else {
      return <Navigate to="/dashboard/user" />;
    }
  }

  return children;
}

function AppContent() {
  return (
    <BrowserRouter>
      <Navbar />
      
      <Routes>
        {/* Offentlige sider - omdirigerer innloggede brukere */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
        <Route path="/jobs" element={<JobsPage />} />

        {/* Kun for bedrifter */}
        <Route 
          path="/dashboard/company" 
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Kun for jobbsøkere */}
        <Route 
          path="/dashboard/user" 
          element={
            <ProtectedRoute requiredUserType="jobseeker">
              <UserDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Admin-sider (skjult fra vanlige brukere) */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Ukjent URL? Send til forsiden */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App