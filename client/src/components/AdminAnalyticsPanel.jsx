import { useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/** Millisekunder fra Firestore Timestamp, Date eller manglende. */
function tsMs(ts) {
  if (ts == null) return null;
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return null;
}

function countSince(items, getTs, sinceMs) {
  return items.filter((item) => {
    const t = tsMs(getTs(item));
    return t != null && t >= sinceMs;
  }).length;
}

export default function AdminAnalyticsPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [stats, setStats] = useState(null);

  const runFetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersSnap, jobsSnap, appsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "jobs")),
        getDocs(collection(db, "applications")),
      ]);

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const jobs = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const applications = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const now = Date.now();
      const d7 = now - 7 * 24 * 60 * 60 * 1000;
      const d30 = now - 30 * 24 * 60 * 60 * 1000;

      const companies = users.filter((u) => u.userType === "company").length;
      const jobseekers = users.filter((u) => u.userType === "jobseeker").length;
      const activeJobs = jobs.filter((j) => j.status === "active").length;

      setStats({
        totals: {
          users: users.length,
          companies,
          jobseekers,
          jobs: jobs.length,
          activeJobs,
          applications: applications.length,
        },
        windows: {
          users7: countSince(users, (u) => u.createdAt, d7),
          users30: countSince(users, (u) => u.createdAt, d30),
          apps7: countSince(applications, (a) => a.appliedAt, d7),
          apps30: countSince(applications, (a) => a.appliedAt, d30),
          jobs7: countSince(jobs, (j) => j.createdAt, d7),
          jobs30: countSince(jobs, (j) => j.createdAt, d30),
        },
      });
      setFetchedAt(new Date());
    } catch (e) {
      console.error("AdminAnalyticsPanel:", e);
      setError(
        e?.message ||
          "Kunne ikke hente data. Sjekk at du er innlogget som admin og at Firestore-regler tillater lesing.",
      );
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="dashboard-content admin-analytics">
      <h1>Analyse</h1>
      <p className="admin-analytics-lead">
        Tall hentes kun når du trykker knappen under — ingenting kjører
        automatisk eller i bakgrunnen. Data kommer fra Firestore (brukere,
        stillinger, søknader), ikke fra Google Analytics.
      </p>

      <div className="admin-analytics-actions">
        <button
          type="button"
          className="button primary"
          onClick={runFetch}
          disabled={loading}
        >
          {loading ? "Henter…" : "Hent oversikt"}
        </button>
        {fetchedAt ? (
          <span className="admin-analytics-fetched">
            Sist hentet:{" "}
            {fetchedAt.toLocaleString("no-NO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ) : (
          <span className="admin-analytics-fetched muted">
            Ingen data hentet ennå.
          </span>
        )}
      </div>

      {error ? (
        <div className="auth-error" role="alert" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      ) : null}

      {stats ? (
        <div className="admin-analytics-grid">
          <section className="admin-analytics-card">
            <h2>Totalt (akkumulert)</h2>
            <ul className="admin-analytics-list">
              <li>
                <strong>{stats.totals.users}</strong> brukere
              </li>
              <li>
                <strong>{stats.totals.companies}</strong> bedrifter ·{" "}
                <strong>{stats.totals.jobseekers}</strong> privatpersoner
              </li>
              <li>
                <strong>{stats.totals.jobs}</strong> stillinger (
                {stats.totals.activeJobs} aktive)
              </li>
              <li>
                <strong>{stats.totals.applications}</strong> søknader
              </li>
            </ul>
          </section>

          <section className="admin-analytics-card">
            <h2>Siste 7 dager</h2>
            <ul className="admin-analytics-list">
              <li>
                <strong>{stats.windows.users7}</strong> nye brukere
              </li>
              <li>
                <strong>{stats.windows.apps7}</strong> søknader
              </li>
              <li>
                <strong>{stats.windows.jobs7}</strong> nye stillinger
                (opprettet)
              </li>
            </ul>
          </section>

          <section className="admin-analytics-card">
            <h2>Siste 30 dager</h2>
            <ul className="admin-analytics-list">
              <li>
                <strong>{stats.windows.users30}</strong> nye brukere
              </li>
              <li>
                <strong>{stats.windows.apps30}</strong> søknader
              </li>
              <li>
                <strong>{stats.windows.jobs30}</strong> nye stillinger
                (opprettet)
              </li>
            </ul>
          </section>
        </div>
      ) : !loading ? (
        <p className="admin-analytics-hint muted">
          Trykk «Hent oversikt» for å laste tall fra databasen.
        </p>
      ) : null}

      <section className="admin-analytics-external">
        <h2>Ekstern trafikk og SEO</h2>
        <p>
          Besøkstall og søkeord ligger i egne verktøy (ikke i Firestore). Åpne
          dem manuelt når du trenger innsikt:
        </p>
        <ul className="admin-analytics-links">
          <li>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Search Console
            </a>{" "}
            — visninger og klikk fra Google-søk
          </li>
          <li>
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Firebase Console
            </a>{" "}
            — Analytics hvis aktivert i prosjektet
          </li>
          <li>
            <a
              href="https://app.netlify.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Netlify
            </a>{" "}
            — trafikk hvis nettsiden hostes der og du har aktivert analyse
          </li>
        </ul>
      </section>
    </div>
  );
}
