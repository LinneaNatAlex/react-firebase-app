// Admin Dashboard - oversikt og kontroll over plattformen

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";
import "../styles/Dashboard.css";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Sjekk admin-tilgang
  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");
    if (!isAdmin) {
      navigate("/admin");
    }
  }, [navigate]);

  // Hent all data
  useEffect(() => {
    async function fetchData() {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const jobsSnap = await getDocs(collection(db, "jobs"));
        const appsSnap = await getDocs(collection(db, "applications"));

        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setJobs(jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setApplications(appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Feil ved henting av data:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleLogout() {
    localStorage.removeItem("isAdmin");
    await signOut(auth);
    navigate("/admin");
  }

  async function deleteUser(userId) {
    if (!window.confirm("Er du sikker på at du vil slette denne brukeren?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Kunne ikke slette bruker:", error);
    }
  }

  async function deleteJob(jobId) {
    if (!window.confirm("Er du sikker på at du vil slette denne stillingen?")) return;
    try {
      await deleteDoc(doc(db, "jobs", jobId));
      setJobs(jobs.filter(j => j.id !== jobId));
    } catch (error) {
      console.error("Kunne ikke slette stilling:", error);
    }
  }

  // Statistikk
  const stats = {
    totalUsers: users.length,
    companies: users.filter(u => u.userType === "company").length,
    jobSeekers: users.filter(u => u.userType === "jobseeker").length,
    totalJobs: jobs.length,
    activeJobs: jobs.filter(j => j.status === "active").length,
    totalApplications: applications.length,
  };

  if (loading) {
    return <div className="dashboard-loading">Laster admin-panel...</div>;
  }

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>🔐 Admin</h2>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            📊 Oversikt
          </button>
          <button 
            className={activeTab === "users" ? "active" : ""}
            onClick={() => setActiveTab("users")}
          >
            👥 Brukere
          </button>
          <button 
            className={activeTab === "jobs" ? "active" : ""}
            onClick={() => setActiveTab("jobs")}
          >
            💼 Stillinger
          </button>
          <button 
            className={activeTab === "applications" ? "active" : ""}
            onClick={() => setActiveTab("applications")}
          >
            📝 Søknader
          </button>
          
          <div className="sidebar-divider"></div>
          <p className="sidebar-label">Forhåndsvisning</p>
          
          <button 
            className={activeTab === "preview-company" ? "active" : ""}
            onClick={() => setActiveTab("preview-company")}
          >
            🏢 Bedrift-dashboard
          </button>
          <button 
            className={activeTab === "preview-user" ? "active" : ""}
            onClick={() => setActiveTab("preview-user")}
          >
            👤 Jobbsøker-dashboard
          </button>
        </nav>

        <button className="sidebar-logout" onClick={handleLogout}>
          🚪 Logg ut
        </button>
      </aside>

      <main className="dashboard-main">
        {activeTab === "overview" && (
          <div className="dashboard-content">
            <h1>Admin Oversikt</h1>
            
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.totalUsers}</span>
                <span className="stat-label">Totalt brukere</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.companies}</span>
                <span className="stat-label">Bedrifter</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.jobSeekers}</span>
                <span className="stat-label">Jobbsøkere</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.totalJobs}</span>
                <span className="stat-label">Stillinger</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.activeJobs}</span>
                <span className="stat-label">Aktive stillinger</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.totalApplications}</span>
                <span className="stat-label">Søknader</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="dashboard-content">
            <h1>Alle brukere ({users.length})</h1>
            
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>E-post</th>
                    <th>Type</th>
                    <th>Navn/Bedrift</th>
                    <th>Registrert</th>
                    <th>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge ${user.userType}`}>
                          {user.userType === "company" ? "Bedrift" : "Jobbsøker"}
                        </span>
                      </td>
                      <td>{user.companyName || `${user.firstName || ""} ${user.lastName || ""}`}</td>
                      <td>{user.createdAt?.toDate?.()?.toLocaleDateString("no-NO") || "-"}</td>
                      <td>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteUser(user.id)}
                        >
                          Slett
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="dashboard-content">
            <h1>Alle stillinger ({jobs.length})</h1>
            
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tittel</th>
                    <th>Bedrift</th>
                    <th>Sted</th>
                    <th>Status</th>
                    <th>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
                      <td>{job.title}</td>
                      <td>{job.companyName}</td>
                      <td>{job.location}</td>
                      <td>
                        <span className={`badge ${job.status}`}>
                          {job.status === "active" ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteJob(job.id)}
                        >
                          Slett
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "applications" && (
          <div className="dashboard-content">
            <h1>Alle søknader ({applications.length})</h1>
            
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Søker</th>
                    <th>Stilling</th>
                    <th>Bedrift</th>
                    <th>Status</th>
                    <th>Dato</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => (
                    <tr key={app.id}>
                      <td>{app.applicantName || app.applicantEmail}</td>
                      <td>{app.jobTitle}</td>
                      <td>{app.companyName}</td>
                      <td>
                        <span className={`badge ${app.status}`}>
                          {app.status === "pending" ? "Venter" : 
                           app.status === "reviewed" ? "Sett" : 
                           app.status === "accepted" ? "Godtatt" : "Avslått"}
                        </span>
                      </td>
                      <td>{app.appliedAt?.toDate?.()?.toLocaleDateString("no-NO") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "preview-company" && (
          <div className="dashboard-content">
            <div className="preview-header">
              <h1>🏢 Bedrift-dashboard (forhåndsvisning)</h1>
              <p>Slik ser dashboardet ut for bedrifter</p>
            </div>
            
            <div className="preview-frame">
              <div className="preview-section">
                <h2>Mine stillingsannonser</h2>
                <p className="preview-description">Her ser bedrifter sine publiserte stillinger</p>
                
                {jobs.length > 0 ? (
                  <div className="jobs-list">
                    {jobs.slice(0, 3).map(job => (
                      <div key={job.id} className="job-card">
                        <div className="job-card-header">
                          <h3>{job.title}</h3>
                          <span className={`status-badge ${job.status === "active" ? "green" : "gray"}`}>
                            {job.status === "active" ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                        <div className="job-card-meta">
                          <span>📍 {job.location}</span>
                          <span>💼 {job.type}</span>
                        </div>
                        <p className="job-card-description">{job.description?.slice(0, 100)}...</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📋</span>
                    <h3>Ingen stillinger ennå</h3>
                    <p>Bedrifter kan opprette stillinger via "Ny stilling"-knappen</p>
                  </div>
                )}
              </div>

              <div className="preview-section">
                <h2>Søkere</h2>
                <p className="preview-description">Bedrifter ser hvem som har søkt på deres stillinger</p>
                
                {applications.length > 0 ? (
                  <div className="applications-list">
                    {applications.slice(0, 3).map(app => (
                      <div key={app.id} className="application-card">
                        <div>
                          <h3>{app.applicantName || "Søker"}</h3>
                          <p className="company-name">Søkt på: {app.jobTitle}</p>
                        </div>
                        <span className={`status-badge ${app.status === "pending" ? "yellow" : "green"}`}>
                          {app.status === "pending" ? "Ny" : "Behandlet"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">👥</span>
                    <h3>Ingen søkere ennå</h3>
                    <p>Søknader vises her når jobbsøkere søker på stillinger</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "preview-user" && (
          <div className="dashboard-content">
            <div className="preview-header">
              <h1>👤 Jobbsøker-dashboard (forhåndsvisning)</h1>
              <p>Slik ser dashboardet ut for jobbsøkere</p>
            </div>
            
            <div className="preview-frame">
              <div className="preview-section">
                <h2>Mine søknader</h2>
                <p className="preview-description">Jobbsøkere ser status på søknadene sine her</p>
                
                {applications.length > 0 ? (
                  <div className="applications-list">
                    {applications.slice(0, 3).map(app => (
                      <div key={app.id} className="application-card">
                        <div>
                          <h3>{app.jobTitle}</h3>
                          <p className="company-name">{app.companyName}</p>
                          <p className="application-date">
                            Søkt: {app.appliedAt?.toDate?.()?.toLocaleDateString("no-NO") || "-"}
                          </p>
                        </div>
                        <span className={`status-badge ${
                          app.status === "pending" ? "yellow" : 
                          app.status === "accepted" ? "green" : "blue"
                        }`}>
                          {app.status === "pending" ? "Sendt" : 
                           app.status === "reviewed" ? "Sett" : 
                           app.status === "accepted" ? "Godtatt" : "Avslått"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <h3>Ingen søknader ennå</h3>
                    <p>Når jobbsøkere sender søknader, vises de her med status</p>
                  </div>
                )}
              </div>

              <div className="preview-section">
                <h2>Anbefalte stillinger</h2>
                <p className="preview-description">Jobbsøkere ser ledige stillinger de kan søke på</p>
                
                {jobs.filter(j => j.status === "active").length > 0 ? (
                  <div className="jobs-list">
                    {jobs.filter(j => j.status === "active").slice(0, 3).map(job => (
                      <div key={job.id} className="job-card">
                        <div className="job-card-header">
                          <h3>{job.title}</h3>
                        </div>
                        <p className="company-name">{job.companyName}</p>
                        <div className="job-card-meta">
                          <span>📍 {job.location}</span>
                          <span>💼 {job.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">💼</span>
                    <h3>Ingen aktive stillinger</h3>
                    <p>Når bedrifter publiserer stillinger, vises de her</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
