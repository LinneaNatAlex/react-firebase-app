import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BRAND_NAME } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_PATH } from "../config/magazine";
import NavbarSearch from "./NavbarSearch";
import NavbarNotifications from "./NavbarNotifications";
import "../styles/Navbar.css";

function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Feil ved utlogging:", error);
    }
  }

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

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">{BRAND_NAME}</Link>
      </div>

      <NavbarSearch />

      <div className="navbar-links">
        <Link to="/jobs">Finn jobber</Link>
        <Link to={MAGAZINE_PATH}>{MAGAZINE_NAME}</Link>
        <Link to="/priser">Priser</Link>

        {currentUser ? (
          <>
            {userData?.userType === "company" ? (
              <>
                <Link to="/dashboard/company">Dashboard</Link>
                <Link to={`/bedrift/${currentUser.uid}`}>Min bedrift</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard/user">Min side</Link>
              </>
            )}
            <NavbarNotifications />
            <div className="navbar-account">
              {userData?.userType === "jobseeker" && (
                <Link
                  to="/profil/me"
                  className="navbar-user-avatar-link"
                  title="Se offentlig profil"
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
      </div>
    </nav>
  );
}

export default Navbar;
