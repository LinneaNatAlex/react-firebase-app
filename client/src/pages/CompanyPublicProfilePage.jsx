// Offentlig bedriftsprofil – leser companyProfiles/{companyId}

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  getCompanySocialStats,
  isUserFollowingCompany,
  isCompanyFollowingCompany,
  followCompanyAsUser,
  unfollowCompanyAsUser,
  followCompanyAsCompany,
  unfollowCompanyAsCompany,
  listAllCompanyFollowers,
  listAllCompanyFollowingCompanies,
} from "../services/social";
import PublicListModal from "../components/PublicListModal";
import "../styles/CompanyProfilePage.css";

function CompanyPublicProfilePage() {
  const { companyId } = useParams();
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCompanyCount, setFollowingCompanyCount] = useState(0);
  const [followingAsUser, setFollowingAsUser] = useState(false);
  const [followingAsCompany, setFollowingAsCompany] = useState(false);
  const [socialLoading, setSocialLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersModalLoading, setFollowersModalLoading] = useState(false);
  const [followersModalList, setFollowersModalList] = useState([]);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followingModalLoading, setFollowingModalLoading] = useState(false);
  const [followingModalList, setFollowingModalList] = useState([]);

  const isOwnCompany =
    Boolean(currentUser?.uid && companyId && currentUser.uid === companyId);
  const isJobseeker = userData?.userType === "jobseeker";
  const isCompanyAccount = userData?.userType === "company";
  const viewerCompanyId = isCompanyAccount ? currentUser?.uid : null;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("company-profile-hide-scrollbar");
    return () => root.classList.remove("company-profile-hide-scrollbar");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!companyId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      try {
        const profSnap = await getDoc(doc(db, "companyProfiles", companyId));
        if (cancelled) return;
        if (!profSnap.exists()) {
          setProfile(null);
          setNotFound(true);
          setJobs([]);
          return;
        }
        const p = profSnap.data();
        setProfile(p);
        setNotFound(false);

        const jobsQ = query(
          collection(db, "jobs"),
          where("companyId", "==", companyId),
        );
        const jobsSnap = await getDocs(jobsQ);
        if (cancelled) return;
        const list = jobsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((j) => j.status === "active");
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setJobs(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setProfile(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSocial() {
      if (!companyId || notFound || !profile) {
        setSocialLoading(false);
        return;
      }
      setSocialLoading(true);
      try {
        const stats = await getCompanySocialStats(db, companyId);
        if (cancelled) return;
        setFollowerCount(stats.followerCount);
        setFollowingCompanyCount(stats.followingCompanyCount);

        if (currentUser?.uid) {
          const [u, c] = await Promise.all([
            isUserFollowingCompany(db, currentUser.uid, companyId),
            viewerCompanyId && viewerCompanyId !== companyId
              ? isCompanyFollowingCompany(db, viewerCompanyId, companyId)
              : Promise.resolve(false),
          ]);
          if (cancelled) return;
          setFollowingAsUser(u);
          setFollowingAsCompany(c);
        } else {
          setFollowingAsUser(false);
          setFollowingAsCompany(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setSocialLoading(false);
      }
    }
    loadSocial();
    return () => {
      cancelled = true;
    };
  }, [companyId, notFound, profile, currentUser?.uid, viewerCompanyId]);

  async function handleToggleFollowUser() {
    if (!currentUser || !isJobseeker || !companyId || isOwnCompany) return;
    setFollowBusy(true);
    try {
      if (followingAsUser) {
        await unfollowCompanyAsUser(db, currentUser.uid, companyId);
        setFollowingAsUser(false);
        setFollowerCount((n) => Math.max(0, n - 1));
        toast.success("Du følger ikke lenger denne bedriften.");
      } else {
        await followCompanyAsUser(db, currentUser.uid, companyId);
        setFollowingAsUser(true);
        setFollowerCount((n) => n + 1);
        toast.success("Du følger nå denne bedriften.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke oppdatere følger. Prøv igjen.");
    }
    setFollowBusy(false);
  }

  async function handleToggleFollowCompany() {
    if (!viewerCompanyId || !companyId || viewerCompanyId === companyId) return;
    setFollowBusy(true);
    try {
      if (followingAsCompany) {
        await unfollowCompanyAsCompany(db, viewerCompanyId, companyId);
        setFollowingAsCompany(false);
        toast.success("Bedriften følger ikke lenger denne bedriften.");
      } else {
        await followCompanyAsCompany(db, viewerCompanyId, companyId);
        setFollowingAsCompany(true);
        toast.success("Bedriften følger nå denne bedriften.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke oppdatere følging. Prøv igjen.");
    }
    setFollowBusy(false);
  }

  async function openFollowersModal() {
    if (!companyId) return;
    setFollowersModalOpen(true);
    setFollowersModalLoading(true);
    setFollowersModalList([]);
    try {
      const list = await listAllCompanyFollowers(db, companyId);
      setFollowersModalList(list);
    } catch (e) {
      console.error(e);
      setFollowersModalList([]);
    } finally {
      setFollowersModalLoading(false);
    }
  }

  async function openFollowingModal() {
    if (!companyId) return;
    setFollowingModalOpen(true);
    setFollowingModalLoading(true);
    setFollowingModalList([]);
    try {
      const list = await listAllCompanyFollowingCompanies(db, companyId);
      setFollowingModalList(list);
    } catch (e) {
      console.error(e);
      setFollowingModalList([]);
    } finally {
      setFollowingModalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="company-public-page company-public-page--loading">
        <div className="company-public-skeleton" aria-busy="true">
          <div className="company-public-skeleton-banner" />
          <div className="company-public-skeleton-card" />
        </div>
        <p className="company-public-loading-label">Laster bedriftsprofil…</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="company-public-page">
        <div className="company-public-card company-public-empty">
          <h1>Profil ikke tilgjengelig</h1>
          <p>
            Denne bedriften har ikke publisert en offentlig profil ennå, eller
            lenken er ugyldig.
          </p>
          <Link to="/jobs" className="button primary">
            Se ledige stillinger
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.companyName || "Bedrift";
  const initial = displayName.charAt(0).toUpperCase();
  const logoUrl =
    profile.companyImage && String(profile.companyImage).startsWith("data:")
      ? profile.companyImage
      : null;
  const websiteHref = profile.website?.trim()
    ? profile.website.match(/^https?:\/\//i)
      ? profile.website.trim()
      : `https://${profile.website.trim()}`
    : null;

  return (
    <div className="company-public-page">
      <header className="company-public-topbar">
        <Link to="/jobs" className="company-profile-back">
          ← Finn jobber
        </Link>
        {isOwnCompany ? (
          <nav className="public-profile-topbar-actions" aria-label="Rediger bedriftsprofil">
            <Link
              to="/dashboard/company/profil"
              className="public-profile-topbar-action"
              title="Rediger offentlig bedriftsprofil"
            >
              Profilinnhold
            </Link>
          </nav>
        ) : null}
      </header>

      <div className="company-public-shell">
        <div className="company-public-banner" aria-hidden="true" />

        <article className="company-public-identity">
          <div className="company-public-logo-wrap">
            {logoUrl ? (
              <img className="company-public-logo-img" src={logoUrl} alt="" />
            ) : (
              <div className="company-public-logo-fallback" aria-hidden>
                {initial}
              </div>
            )}
          </div>

          <div className="company-public-identity-text">
            <h1 className="company-public-title">{displayName}</h1>
            {currentUser && isJobseeker && !isOwnCompany && companyId ? (
              <p className="company-public-messages-cta">
                <Link
                  to={`/meldinger?with=${companyId}`}
                  className="button secondary small"
                >
                  Send melding til bedriften
                </Link>
              </p>
            ) : null}
            <div className="company-public-chips">
              {profile.industry ? (
                <span className="company-public-chip company-public-chip--accent">
                  {profile.industry}
                </span>
              ) : null}
              {profile.hqLocation ? (
                <span className="company-public-chip">
                  <span className="company-public-chip-icon" aria-hidden>
                    ◉
                  </span>
                  {profile.hqLocation}
                </span>
              ) : null}
              {websiteHref ? (
                <a
                  className="company-public-chip company-public-chip--link"
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Besøk nettside
                </a>
              ) : null}
            </div>

            {!socialLoading && (
              <div className="company-public-stats" aria-label="Statistikk">
                <button
                  type="button"
                  className="company-public-stat-btn"
                  disabled={followerCount === 0}
                  onClick={() => followerCount > 0 && openFollowersModal()}
                >
                  <strong>{followerCount}</strong>{" "}
                  {followerCount === 1 ? "følger" : "følgere"}
                </button>
                <span className="company-public-stat-sep" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="company-public-stat-btn"
                  disabled={followingCompanyCount === 0}
                  onClick={() => followingCompanyCount > 0 && openFollowingModal()}
                >
                  Følger <strong>{followingCompanyCount}</strong>{" "}
                  {followingCompanyCount === 1 ? "bedrift" : "bedrifter"}
                </button>
              </div>
            )}

            {currentUser && !isOwnCompany && isJobseeker && (
              <div className="company-public-actions">
                <button
                  type="button"
                  className={`button ${followingAsUser ? "secondary" : "primary"}`}
                  onClick={handleToggleFollowUser}
                  disabled={followBusy}
                >
                  {followingAsUser ? "Følger" : "Følg bedrift"}
                </button>
              </div>
            )}

            {currentUser && !isOwnCompany && isCompanyAccount && viewerCompanyId && (
              <div className="company-public-actions">
                <button
                  type="button"
                  className={`button ${followingAsCompany ? "secondary" : "primary"}`}
                  onClick={handleToggleFollowCompany}
                  disabled={followBusy}
                >
                  {followingAsCompany ? "Bedriften følger" : "Følg som bedrift"}
                </button>
              </div>
            )}
          </div>
        </article>

        <div className="company-public-panels">
          {profile.companyAbout ? (
            <section className="company-public-panel company-public-panel--about">
              <h2 className="company-public-panel-title">Om bedriften</h2>
              <div className="company-public-about">{profile.companyAbout}</div>
            </section>
          ) : (
            <section className="company-public-panel company-public-panel--muted">
              <p className="company-public-muted-inline">
                Ingen bedriftspresentasjon er lagt inn ennå.
              </p>
            </section>
          )}

          {jobs.length > 0 ? (
            <section className="company-public-panel company-public-panel--jobs">
              <h2 className="company-public-panel-title">Ledige stillinger</h2>
              <p className="company-public-jobs-sub">
                {jobs.length} {jobs.length === 1 ? "stilling" : "stillinger"}{" "}
                hos {displayName}
              </p>
              <ul className="company-public-job-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      to="/jobs"
                      state={{ openJobId: job.id }}
                      className="company-public-job-card"
                    >
                      <div className="company-public-job-card-body">
                        <span className="company-public-job-title">
                          {job.title}
                        </span>
                        {job.location ? (
                          <span className="company-public-job-meta">
                            {job.location}
                          </span>
                        ) : null}
                        {job.type ? (
                          <span className="company-public-job-badge">
                            {job.type === "full-time"
                              ? "Heltid"
                              : job.type === "part-time"
                                ? "Deltid"
                                : job.type === "contract"
                                  ? "Kontrakt"
                                  : job.type === "internship"
                                    ? "Praksis"
                                    : job.type}
                          </span>
                        ) : null}
                      </div>
                      <span className="company-public-job-chevron" aria-hidden>
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="company-profile-hint company-public-jobs-hint">
                Trykk på en stilling for full beskrivelse og søknad på siden
                «Finn jobber».
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <PublicListModal
        open={followersModalOpen}
        title="Følgere"
        onClose={() => setFollowersModalOpen(false)}
      >
        {followersModalLoading ? (
          <p className="person-public-modal-empty">Laster…</p>
        ) : followersModalList.length === 0 ? (
          <p className="person-public-modal-empty">Ingen følgere ennå.</p>
        ) : (
          <ul className="person-public-modal-list">
            {followersModalList.map((r) => (
              <li key={r.uid}>
                <Link
                  to={`/profil/${r.uid}`}
                  onClick={() => setFollowersModalOpen(false)}
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicListModal>

      <PublicListModal
        open={followingModalOpen}
        title="Bedrifter denne bedriften følger"
        onClose={() => setFollowingModalOpen(false)}
      >
        {followingModalLoading ? (
          <p className="person-public-modal-empty">Laster…</p>
        ) : followingModalList.length === 0 ? (
          <p className="person-public-modal-empty">Følger ingen andre bedrifter.</p>
        ) : (
          <ul className="person-public-modal-list">
            {followingModalList.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/bedrift/${c.id}`}
                  onClick={() => setFollowingModalOpen(false)}
                >
                  {c.companyName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PublicListModal>
    </div>
  );
}

export default CompanyPublicProfilePage;
