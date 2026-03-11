import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Feil ved utlogging:', error);
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">JobbPortal</Link>
      </div>

      <div className="navbar-links">
        <Link to="/jobs">Finn jobber</Link>
        
        {currentUser ? (
          <>
            {userData?.userType === 'company' ? (
              <Link to="/dashboard/company">Dashboard</Link>
            ) : (
              <Link to="/dashboard/user">Mine søknader</Link>
            )}
            <button onClick={handleLogout} className="navbar-button logout">
              Logg ut
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-button">Logg inn</Link>
            <Link to="/register" className="navbar-button primary">Registrer deg</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
