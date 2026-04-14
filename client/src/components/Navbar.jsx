import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BRAND_NAME, BRAND_TAGLINE } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_PATH } from "../config/magazine";
import NavbarSearch from "./NavbarSearch";
import NavbarNotifications from "./NavbarNotifications";
import "../styles/Navbar.css";

function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Feil ved utlogging:", error);
    }
  }

  const links = useMemo(() => {
    const items = [
      { to: "/jobs", label: "Finn jobber" },
      { to: MAGAZINE_PATH, label: MAGAZINE_NAME },
      { to: "/priser", label: "Priser" },
    ];

    if (
      userData?.newspaperRole === "journalist" ||
      userData?.newspaperRole === "editor"
    ) {
      items.push({ to: "/utblikk/redaksjon", label: "Utblikk-redaksjon" });
    }

    if (currentUser) {
      if (userData?.userType === "company") {
        items.push({ to: "/dashboard/company", label: "Dashboard" });
        items.push({ to: `/bedrift/${currentUser.uid}`, label: "Min bedrift" });
      } else {
        items.push({ to: "/dashboard/user", label: "Min side" });
      }
      if (userData?.userType === "jobseeker") {
        items.push({ to: "/profil/me", label: "Profil" });
      }
    }

    return items;
  }, [currentUser, userData]);

  const jobseekerProfileInitial =
    userData?.userType === "jobseeker"
      ? (() => {
          const fn = userData?.firstName?.trim();
          if (fn) return fn.charAt(0).toUpperCase();
          const ln = userData?.lastName?.trim();
          if (ln) return ln.charAt(0).toUpperCase();
          const dn = currentUser?.displayName?.trim();
          if (dn) return dn.charAt(0).toUpperCase();
          const em = currentUser?.email;
          if (em) return em.charAt(0).toUpperCase();
          return "?";
        })()
      : "";

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    if (mobileMenuOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" onClick={() => setMobileMenuOpen(false)}>
          {BRAND_NAME}
        </Link>
        <span className="navbar-tagline">{BRAND_TAGLINE}</span>
      </div>

      <NavbarSearch />

      <div className="navbar-links">
        {links.slice(0, 4).map((l) => (
          <Link key={l.to} to={l.to}>
            {l.label}
          </Link>
        ))}

        {currentUser ? (
          <>
            <NavbarNotifications />
            <div className="navbar-account">
              {userData?.userType === "jobseeker" && (
                <Link
                  to="/profil/me"
                  className="navbar-user-avatar-link"
                  title="Se offentlig profil"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {userData?.profileImage || currentUser?.photoURL ? (
                    <img
                      src={userData.profileImage || currentUser.photoURL}
                      alt=""
                      className="navbar-user-avatar"
                    />
                  ) : (
                    <span className="navbar-user-avatar-fallback" aria-hidden>
                      {jobseekerProfileInitial}
                    </span>
                  )}
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="navbar-button logout"
              >
                Logg ut
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-button">
              Logg inn
            </Link>
            <Link to="/register" className="navbar-button primary">
              Registrer deg
            </Link>
          </>
        )}

        <button
          type="button"
          className="navbar-mobile-toggle"
          aria-label={mobileMenuOpen ? "Lukk meny" : "Åpne meny"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          <span className="navbar-mobile-toggle-bars" aria-hidden />
        </button>
      </div>

      {mobileMenuOpen ? (
        <div
          className="navbar-mobile-overlay"
          role="presentation"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="navbar-mobile-menu"
            role="dialog"
            aria-label="Meny"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="navbar-mobile-menu-links">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="navbar-mobile-link"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            {!currentUser ? null : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="navbar-mobile-logout"
              >
                Logg ut
              </button>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

export default Navbar;
