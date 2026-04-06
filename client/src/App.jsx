// Hovedfil - setter opp alle sider og beskytter de som krever innlogging

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";

import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CompanyDashboard from "./pages/CompanyDashboard";
import UserDashboard from "./pages/UserDashboard";
import JobsPage from "./pages/JobsPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import PricingPage from "./pages/PricingPage";
import CompanyPublicProfilePage from "./pages/CompanyPublicProfilePage";
import CompanyProfileEditPage from "./pages/CompanyProfileEditPage";
import MagazinePage from "./pages/MagazinePage";
import MagazineArticlePage from "./pages/MagazineArticlePage";
import MagazineStaffDashboardPage from "./pages/MagazineStaffDashboardPage";
import MagazineEditorPage from "./pages/MagazineEditorPage";
import PersonPublicProfilePage from "./pages/PersonPublicProfilePage";
import PersonPublicCvPage from "./pages/PersonPublicCvPage";
import SearchPage from "./pages/SearchPage";

import "./index.css";

// /profil/me → redirect til innlogget brukers offentlige profil
function ProfilMeRoute() {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Laster...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (userData?.userType === "company") {
    return <Navigate to={`/bedrift/${currentUser.uid}`} replace />;
  }
  return <Navigate to={`/profil/${currentUser.uid}`} replace />;
}

function ProfilMeCvRoute() {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Laster...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (userData?.userType === "company") {
    return <Navigate to={`/bedrift/${currentUser.uid}`} replace />;
  }
  return <Navigate to={`/profil/${currentUser.uid}/cv`} replace />;
}

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
    if (userData?.userType === "company") {
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
    if (userData.userType === "company") {
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
    if (userData.userType === "company") {
      return <Navigate to="/dashboard/company" />;
    } else {
      return <Navigate to="/dashboard/user" />;
    }
  }

  return children;
}

/** Innlogget bruker med rolle journalist eller redaktør i Utblikk (henter fersk rolle fra Firestore) */
function NewspaperStaffRoute({ children }) {
  const { currentUser, loading, refreshUserData } = useAuth();
  const [ready, setReady] = useState(false);
  const [staffRole, setStaffRole] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!currentUser) {
        setStaffRole(null);
        setReady(true);
        return;
      }
      const merged = await refreshUserData();
      if (!cancelled) {
        setStaffRole(merged?.newspaperRole ?? null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, currentUser, refreshUserData]);

  if (loading || !ready) {
    return <div className="loading-screen">Laster...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (staffRole !== "journalist" && staffRole !== "editor") {
    return <Navigate to="/utblikk" replace />;
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
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          }
        />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/sok" element={<SearchPage />} />
        <Route
          path="/bedrift/:companyId"
          element={<CompanyPublicProfilePage />}
        />
        <Route path="/profil/me" element={<ProfilMeRoute />} />
        <Route path="/profil/me/cv" element={<ProfilMeCvRoute />} />
        <Route path="/profil/:userId/cv" element={<PersonPublicCvPage />} />
        <Route path="/profil/:userId" element={<PersonPublicProfilePage />} />
        <Route path="/priser" element={<PricingPage />} />
        <Route
          path="/utblikk/redaksjon"
          element={
            <NewspaperStaffRoute>
              <MagazineStaffDashboardPage />
            </NewspaperStaffRoute>
          }
        />
        <Route
          path="/utblikk/rediger/:articleId"
          element={
            <NewspaperStaffRoute>
              <MagazineEditorPage />
            </NewspaperStaffRoute>
          }
        />
        <Route path="/utblikk/sak/:slug" element={<MagazineArticlePage />} />
        <Route path="/utblikk" element={<MagazinePage />} />
        <Route path="/jobbposten" element={<Navigate to="/utblikk" replace />} />

        {/* Kun for bedrifter */}
        <Route
          path="/dashboard/company"
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/company/profil"
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyProfileEditPage />
            </ProtectedRoute>
          }
        />

        {/* Privatkonto (userType jobseeker i Firestore) */}
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

export default App;
