// Admin-innlogging - kun for deg som eier plattformen

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import "../styles/Auth.css";

// Din admin-epost - kun denne kan logge inn som admin
const ADMIN_EMAIL = "linneahetty94@gmail.com";

function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleGoogleLogin() {
    try {
      setError("");
      setLoading(true);
      
      const result = await signInWithPopup(auth, googleProvider);
      
      // Sjekk at det er riktig admin-epost
      if (result.user.email !== ADMIN_EMAIL) {
        setError("Du har ikke admin-tilgang");
        setLoading(false);
        return;
      }
      
      // Lagre admin-status
      localStorage.setItem("isAdmin", "true");
      navigate("/admin/dashboard");
      
    } catch (error) {
      console.error("Admin innlogging feilet:", error);
      if (error.code === "auth/popup-closed-by-user") {
        setError("Innlogging avbrutt");
      } else {
        setError("Kunne ikke logge inn");
      }
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>🔐 Admin</h1>
        <p className="auth-subtitle">Logg inn som administrator</p>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="social-button google full-width"
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {loading ? "Logger inn..." : "Logg inn med Google"}
        </button>
      </div>
    </div>
  );
}

export default AdminLoginPage;
