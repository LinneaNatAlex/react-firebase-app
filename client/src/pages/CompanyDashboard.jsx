// Dashboard for bedrifter - administrer stillingsannonser og se søkere

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  buildJobPostingTemplate,
  scoreApplicationAgainstJob,
} from "../services/freeTemplates";
import { postAi } from "../services/aiApi";
import AiPaywallModal from "../components/AiPaywallModal";
import CompanyJobLibraryPanel from "../components/CompanyJobLibraryPanel";
import NotificationSettingsPanel from "../components/NotificationSettingsPanel";
import {
  fetchCompanyJobLibrary,
  touchCompanyJobLibraryLastUsed,
} from "../services/companyJobLibrary";
import { notifyJobseekerApplicationUpdate } from "../services/notifications";
// Profilutdrag + søknadstekst i søker-modal (samme logikk som PersonPublicCvPage)
import {
  normalizeCvHyphens,
  splitCvMultilineParagraphs,
  splitProfileIntroParagraphs,
} from "../utils/splitProfileIntroParagraphs";
import "../styles/Dashboard.css";

function firestoreTsMs(t) {
  if (t?.toMillis) return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return 0;
}

/** AI-pass fra Firestore (boolean true). Tolerant hvis verdien av en grunn kommer som streng. */
function companyHasAiPass(userData) {
  if (!userData || userData.userType !== "company") return false;
  const p = userData.aiPass;
  return p === true || p === "true";
}

function CompanyDashboard() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("jobs");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [aiError, setAiError] = useState("");
  const [rankingInProgress, setRankingInProgress] = useState(false);
  const [aiJobLoading, setAiJobLoading] = useState(false);
  const [showAiPaywall, setShowAiPaywall] = useState(false);
  const [reuseSource, setReuseSource] = useState("");
  const [reuseSearch, setReuseSearch] = useState("");
  const [jobLibraryItems, setJobLibraryItems] = useState([]);

  // Melding til søker
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");

  // Skjemadata for ny stilling
  const [newJob, setNewJob] = useState({
    title: "",
    description: "",
    location: "",
    type: "full-time",
    salary: "",
    keywords: "",
  });

  // Hent stillinger og søknader
  async function fetchData() {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Hent stillinger
      const jobsQuery = query(
        collection(db, "jobs"),
        where("companyId", "==", currentUser.uid),
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsList = jobsSnapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

      // Hent job IDs for denne bedriften
      const jobIds = jobsList.map((job) => job.id);

      // Hent alle søknader - først prøv med companyId, deretter filtrer på jobId
      let appsList = [];

      if (jobIds.length > 0) {
        const appsQuery = query(
          collection(db, "applications"),
          where("companyId", "==", currentUser.uid),
        );
        const allAppsSnapshot = await getDocs(appsQuery);

        const relevantApps = allAppsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          return (
            jobIds.includes(data.jobId) || data.companyId === currentUser.uid
          );
        });

        appsList = await Promise.all(
          relevantApps.map(async (document) => {
            const appData = { id: document.id, ...document.data() };

            // Hent søkerens profil hvis den finnes
            if (appData.userId) {
              try {
                const profileDoc = await getDoc(
                  doc(db, "profiles", appData.userId),
                );
                if (profileDoc.exists()) {
                  appData.profile = profileDoc.data();
                }
              } catch (e) {
                console.error("Kunne ikke hente profil:", e);
              }
            }
            return appData;
          }),
        );
      }

      // Oppdater søkertall på hver stilling
      const jobsWithCounts = jobsList.map((job) => ({
        ...job,
        applicantCount: appsList.filter((app) => app.jobId === job.id).length,
      }));

      setJobs(jobsWithCounts);
      setApplications(appsList);

      try {
        const libraryList = await fetchCompanyJobLibrary(currentUser.uid);
        setJobLibraryItems(libraryList);
      } catch (libErr) {
        console.warn("Kunne ikke hente stillingsbibliotek:", libErr);
        setJobLibraryItems([]);
      }
    } catch (error) {
      console.error("Feil ved henting av data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    if (!showNewJobForm) return;
    setReuseSource("");
    setReuseSearch("");
    void refreshUserData();
  }, [showNewJobForm, refreshUserData]);

  // Lagrer ny stilling
  async function handleCreateJob(event) {
    event.preventDefault();

    try {
      await addDoc(collection(db, "jobs"), {
        ...newJob,
        companyId: currentUser.uid,
        companyName: userData?.companyName || "Ukjent bedrift",
        createdAt: new Date(),
        status: "active",
      });

      setNewJob({
        title: "",
        description: "",
        location: "",
        type: "full-time",
        salary: "",
        keywords: "",
      });
      setShowNewJobForm(false);
      setReuseSource("");
      setReuseSearch("");
      fetchData();
    } catch (error) {
      console.error("Feil ved opprettelse av jobb:", error);
    }
  }

  async function handleDeleteJob(jobId) {
    if (!window.confirm("Er du sikker på at du vil slette denne stillingen?"))
      return;

    try {
      await deleteDoc(doc(db, "jobs", jobId));
      fetchData();
    } catch (error) {
      console.error("Feil ved sletting:", error);
    }
  }

  const aiAccessLabel = companyHasAiPass(userData)
    ? "AI: aktiv tilgang (ubegrenset for bedriften)"
    : "AI: krever kjøpt tilgang – ingen gratis prøveperioder.";

  // Stillingsutkast fra skjema – helt lokalt, ingen API
  function handleFillJobTemplate() {
    if (!newJob.title?.trim()) {
      setAiError("Fyll inn stillingstittel først");
      return;
    }
    setAiError("");
    const text = buildJobPostingTemplate({
      title: newJob.title,
      company: userData?.companyName || "Bedriften",
      location: newJob.location,
      type: newJob.type,
      salary: newJob.salary,
      keywords: newJob.keywords,
      companyAbout:
        userData?.companyAbout != null ? String(userData.companyAbout) : "",
    });
    setNewJob({ ...newJob, description: text });
    toast.success("Stillingstekst lagt inn – tilpass som du vil");
  }

  async function handleAiJobPosting() {
    if (!companyHasAiPass(userData)) {
      setShowAiPaywall(true);
      return;
    }
    if (!newJob.title?.trim()) {
      setAiError("Fyll inn stillingstittel først");
      return;
    }
    if (!currentUser) return;
    setAiError("");
    setAiJobLoading(true);
    try {
      const out = await postAi(currentUser, "jobPosting", {
        title: newJob.title,
        company: userData?.companyName || "Bedriften",
        location: newJob.location,
        type: newJob.type,
        salary: newJob.salary,
        keywords: newJob.keywords,
        companyAbout: (userData?.companyAbout != null
          ? String(userData.companyAbout)
          : ""
        ).trim(),
      });
      setNewJob({ ...newJob, description: out.text });
      await refreshUserData();
      toast.success("AI-utkast lagt inn – les gjennom og tilpass");
    } catch (e) {
      if (e.code === "AI_LIMIT") setShowAiPaywall(true);
      else
        toast.error(
          e.message ||
            "AI feilet. Sjekk at Python-tjenesten kjører og at PYTHON_AI_URL er satt på serveren.",
        );
    } finally {
      setAiJobLoading(false);
    }
  }

  const allReuseRows = useMemo(() => {
    const rows = [];
    for (const j of jobs) {
      if (!(j.description || "").trim()) continue;
      rows.push({
        key: `job:${j.id}`,
        kind: "job",
        id: j.id,
        label: `Utlyst: ${j.title?.trim() || "Uten tittel"}`,
        description: j.description,
        sort: firestoreTsMs(j.createdAt),
      });
    }
    for (const l of jobLibraryItems) {
      if (!(l.description || "").trim()) continue;
      rows.push({
        key: `lib:${l.id}`,
        kind: "lib",
        id: l.id,
        label: `Bibliotek: ${l.title?.trim() || "Uten tittel"}`,
        description: l.description,
        sort: Math.max(
          firestoreTsMs(l.updatedAt),
          firestoreTsMs(l.createdAt),
          firestoreTsMs(l.lastUsedAt),
        ),
      });
    }
    rows.sort((a, b) => b.sort - a.sort);
    return rows;
  }, [jobs, jobLibraryItems]);

  const filteredReuseRows = useMemo(() => {
    const q = reuseSearch.trim().toLowerCase();
    if (!q) return allReuseRows;
    return allReuseRows.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        String(r.description).toLowerCase().includes(q),
    );
  }, [allReuseRows, reuseSearch]);

  const reuseRowsForSelect = useMemo(() => {
    const sel = allReuseRows.find((r) => r.key === reuseSource);
    const has = filteredReuseRows.some((r) => r.key === reuseSource);
    if (sel && !has) return [sel, ...filteredReuseRows];
    return filteredReuseRows;
  }, [allReuseRows, filteredReuseRows, reuseSource]);

  async function handleReuseJobDescription() {
    const row = allReuseRows.find((r) => r.key === reuseSource);
    if (!row?.description?.trim()) {
      toast.warning("Velg en kilde med beskrivelsestekst.");
      return;
    }
    const next = String(row.description).trim();
    if (newJob.description.trim() && newJob.description.trim() !== next) {
      if (
        !window.confirm(
          "Erstatte nåværende beskrivelse med teksten fra den valgte kilden?",
        )
      ) {
        return;
      }
    }
    setNewJob({ ...newJob, description: next });
    if (row.kind === "lib") {
      try {
        await touchCompanyJobLibraryLastUsed(row.id);
        await fetchData();
      } catch (e) {
        console.warn(e);
      }
    }
    toast.success("Tekst innlimt – tilpass tittel og detaljer.");
  }

  // Rangering: nøkkelord fra annonsen mot søknad/CV (gratis, uendelig skalerbart)
  async function rankApplicants(job) {
    const jobApplications = applications.filter((app) => app.jobId === job.id);
    if (jobApplications.length === 0) {
      toast.warning("Ingen søkere å rangere");
      return;
    }

    setRankingInProgress(true);

    try {
      const desc = job.description || "";
      for (const app of jobApplications) {
        const { score, reason } = scoreApplicationAgainstJob(desc, app);
        await updateDoc(doc(db, "applications", app.id), {
          aiScore: score,
          aiReason: reason,
        });
      }
      fetchData();
      toast.success("Treff-score beregnet (lokalt – les begrunnelsene)");
    } catch (error) {
      console.error("Rangering feilet:", error);
      toast.error("Kunne ikke oppdatere score. Prøv igjen.");
    }

    setRankingInProgress(false);
  }

  async function rankApplicantsWithAi(job) {
    if (!companyHasAiPass(userData)) {
      setShowAiPaywall(true);
      return;
    }
    const jobApplications = applications.filter((app) => app.jobId === job.id);
    if (jobApplications.length === 0) {
      toast.warning("Ingen søkere å rangere");
      return;
    }
    if (!currentUser) return;

    setRankingInProgress(true);
    try {
      const out = await postAi(currentUser, "rankApplicants", {
        jobDescription: job.description || "",
        applicants: jobApplications.map((app) => ({
          id: app.id,
          applicantName: app.applicantName,
          coverLetter: app.coverLetter,
          profile: app.profile,
        })),
      });
      const rankings = Array.isArray(out.rankings) ? out.rankings : [];
      for (let i = 0; i < jobApplications.length; i++) {
        const app = jobApplications[i];
        let r = rankings.find((x) => String(x.id) === String(app.id));
        if (!r && rankings[i]) r = rankings[i];
        if (r && (r.score != null || r.reason)) {
          await updateDoc(doc(db, "applications", app.id), {
            aiScore: Math.min(100, Math.max(0, Number(r.score) || 0)),
            aiReason: String(r.reason || "").trim() || "AI-vurdering",
          });
        }
      }
      await refreshUserData();
      fetchData();
      toast.success("AI-vurdering lagret – les alltid søknadene selv");
    } catch (e) {
      if (e.code === "AI_LIMIT") setShowAiPaywall(true);
      else toast.error(e.message || "AI-rangering feilet.");
    } finally {
      setRankingInProgress(false);
    }
  }

  // Oppdater søknadsstatus
  // Håndter statusendring - vis meldingsmodal for intervju
  function handleStatusChange(applicant, newStatus) {
    if (newStatus === "interview") {
      // Vis modal for å sende melding
      setMessageRecipient(applicant);
      setPendingStatus(newStatus);
      setMessageText(
        `Hei ${applicant.applicantName || "søker"}!\n\nVi vil gjerne invitere deg til intervju for stillingen "${applicant.jobTitle}".\n\nVi tar kontakt med deg for å avtale tidspunkt.\n\nMed vennlig hilsen\n${userData?.companyName || "Bedriften"}`,
      );
      setShowMessageModal(true);
    } else {
      // Oppdater status direkte for andre statuser
      updateApplicationStatus(applicant.id, newStatus, null);
    }
  }

  // Oppdater status og eventuelt legg til melding
  async function updateApplicationStatus(appId, newStatus, message) {
    try {
      const appRef = doc(db, "applications", appId);
      const beforeSnap = await getDoc(appRef);
      const before = beforeSnap.exists() ? beforeSnap.data() : null;

      const updateData = {
        status: newStatus,
        statusUpdatedAt: new Date(),
      };

      if (message) {
        updateData.companyMessage = message;
        updateData.messageDate = new Date();
        updateData.messageSender = userData?.companyName || "Bedriften";
      }

      await updateDoc(appRef, updateData);
      fetchData();

      if (before?.userId && currentUser?.uid) {
        try {
          await notifyJobseekerApplicationUpdate(db, {
            applicantUid: before.userId,
            companyId: currentUser.uid,
            companyName: userData?.companyName || "Bedrift",
            jobTitle: before.jobTitle,
            applicationId: appId,
            previousStatus: before.status || "pending",
            newStatus,
            hasCompanyMessage: Boolean(message),
          });
        } catch (e) {
          console.warn("notifyJobseekerApplicationUpdate", e);
        }
      }
    } catch (error) {
      console.error("Kunne ikke oppdatere status:", error);
    }
  }

  // Send melding og oppdater status
  async function sendMessageAndUpdateStatus() {
    if (!messageRecipient || !pendingStatus) return;

    await updateApplicationStatus(
      messageRecipient.id,
      pendingStatus,
      messageText,
    );

    toast.success(`Invitasjon sendt til ${messageRecipient.applicantName}.`);

    setShowMessageModal(false);
    setMessageRecipient(null);
    setMessageText("");
    setPendingStatus("");

    if (selectedApplicant?.id === messageRecipient.id) {
      setSelectedApplicant({
        ...selectedApplicant,
        status: pendingStatus,
        companyMessage: messageText,
      });
    }
  }

  // Hent søkere for valgt stilling
  const getApplicantsForJob = (jobId) => {
    return applications
      .filter((app) => app.jobId === jobId)
      .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
  };

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-user-name">{userData?.companyName || "Min bedrift"}</h2>
        </div>
        <button
          type="button"
          className={`sidebar-mobile-toggle${mobileNavOpen ? " is-open" : ""}`}
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
        >
          Meny
          <span className="chev" aria-hidden />
        </button>
        <nav className={`sidebar-nav${mobileNavOpen ? " is-open" : ""}`}>
          <p className="sidebar-label">Oversikt</p>
          <button
            className={activeTab === "jobs" ? "active" : ""}
            onClick={() => {
              setActiveTab("jobs");
              setSelectedJob(null);
              setMobileNavOpen(false);
            }}
          >
            Stillinger ({jobs.length})
          </button>
          <button
            className={activeTab === "applicants" ? "active" : ""}
            onClick={() => {
              setActiveTab("applicants");
              setMobileNavOpen(false);
            }}
          >
            Alle søkere ({applications.length})
          </button>
          <button
            className={activeTab === "library" ? "active" : ""}
            onClick={() => {
              setActiveTab("library");
              setSelectedJob(null);
              setMobileNavOpen(false);
            }}
          >
            Stillingsbibliotek ({jobLibraryItems.length})
          </button>
          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => {
              setActiveTab("settings");
              setSelectedJob(null);
              setMobileNavOpen(false);
            }}
          >
            Instillinger
          </button>
          <Link className="nav-item" to="/meldinger" onClick={() => setMobileNavOpen(false)}>
            Meldinger
          </Link>
          <p className="sidebar-label sidebar-label--spaced">Profil</p>
          <Link className="nav-item" to="/dashboard/company/profil">
            Bedriftsprofil
          </Link>
          {currentUser?.uid ? (
            <Link className="nav-item" to={`/bedrift/${currentUser.uid}`}>
              Offentlig bedriftsside
            </Link>
          ) : null}
        </nav>
      </aside>

      <main className="dashboard-main">
        {activeTab === "settings" && <NotificationSettingsPanel />}

        {activeTab === "library" && currentUser?.uid && (
          <CompanyJobLibraryPanel
            companyId={currentUser.uid}
            jobs={jobs}
            jobLibraryItems={jobLibraryItems}
            onRefresh={fetchData}
          />
        )}

        {/* STILLINGER-FANE */}
        {activeTab === "jobs" && !selectedJob && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Stillingsannonser</h1>
                <p>Administrer dine utlyste stillinger</p>
              </div>
              <button
                className="button primary"
                onClick={() => setShowNewJobForm(true)}
              >
                + Ny stilling
              </button>
            </header>

            <div className="dashboard-content">
              {loading ? (
                <p className="loading-text">Laster stillinger...</p>
              ) : jobs.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-graphic" aria-hidden />
                  <h3>Ingen stillinger ennå</h3>
                  <p>
                    Opprett din første stillingsannonse for å begynne å motta
                    søkere.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setShowNewJobForm(true)}
                  >
                    + Opprett stilling
                  </button>
                </div>
              ) : (
                <div className="jobs-list">
                  {jobs.map((job) => (
                    <div key={job.id} className="job-card">
                      <div className="job-card-header">
                        <h3>{job.title}</h3>
                        <span className={`status-badge ${job.status}`}>
                          {job.status === "active" ? "Aktiv" : "Pauset"}
                        </span>
                      </div>
                      <div className="job-card-meta">
                        <span>Sted: {job.location || "Ikke spesifisert"}</span>
                        <span>
                          Type:{" "}
                          {job.type === "full-time" ? "Heltid" : job.type}
                        </span>
                      </div>
                      <p className="job-card-description">
                        {job.description?.substring(0, 150)}...
                      </p>
                      <div className="job-card-footer">
                        <span
                          className={`applicant-count ${job.applicantCount > 0 ? "has-applicants" : ""}`}
                        >
                          {job.applicantCount || 0} søkere
                        </span>
                        <div className="job-card-actions">
                          <button
                            className="button small primary"
                            onClick={() => setSelectedJob(job)}
                          >
                            Se søkere
                          </button>
                          <button
                            className="button small danger"
                            onClick={() => handleDeleteJob(job.id)}
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* SØKERE FOR VALGT STILLING */}
        {activeTab === "jobs" && selectedJob && (
          <>
            <header className="dashboard-header">
              <div>
                <button
                  className="back-link"
                  onClick={() => setSelectedJob(null)}
                >
                  ← Tilbake til stillinger
                </button>
                <h1>Søkere: {selectedJob.title}</h1>
                <p>{getApplicantsForJob(selectedJob.id).length} søkere</p>
                <p className="template-hint" style={{ marginTop: "0.35rem" }}>
                  {aiAccessLabel}
                </p>
                <p
                  className="template-hint"
                  style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}
                >
                  <strong>Treff-score uten AI:</strong> teller hvor mange ord
                  fra annonsen som også finnes i søknad/CV – enkel tekstmatch,
                  ikke forståelse. <strong>AI-vurdering:</strong> Groq leser
                  sammenhengen og gir score + kort begrunnelse.
                </p>
              </div>
              {getApplicantsForJob(selectedJob.id).length > 0 && (
                <div
                  className="header-actions"
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "0.5rem",
                  }}
                >
                  <button
                    className="button primary ai-btn"
                    type="button"
                    onClick={() => rankApplicantsWithAi(selectedJob)}
                    disabled={rankingInProgress}
                  >
                    {rankingInProgress
                      ? "AI jobber…"
                      : "AI-vurder søkere"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => rankApplicants(selectedJob)}
                    disabled={rankingInProgress}
                  >
                    {rankingInProgress
                      ? "Beregner…"
                      : "Treff-score uten AI (gratis)"}
                  </button>
                </div>
              )}
            </header>

            <div className="dashboard-content">
              {getApplicantsForJob(selectedJob.id).length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-graphic" aria-hidden />
                  <h3>Ingen søkere ennå</h3>
                  <p>Når privatpersoner sender søknader, vil de vises her.</p>
                </div>
              ) : (
                <div className="applicants-list">
                  {getApplicantsForJob(selectedJob.id).map((app, index) => (
                    <div key={app.id} className="applicant-card">
                      <div className="applicant-rank">
                        {app.aiScore ? (
                          <div className="rank-badge">
                            <span className="rank-number">#{index + 1}</span>
                            <span className="rank-score">
                              {app.aiScore}/100
                            </span>
                          </div>
                        ) : (
                          <span className="no-rank">-</span>
                        )}
                      </div>

                      <div className="applicant-info">
                        <div className="applicant-header">
                          {app.profile?.profileImage && (
                            <img
                              src={app.profile.profileImage}
                              alt=""
                              className="applicant-avatar"
                            />
                          )}
                          <div>
                            <h3>{app.applicantName || "Ukjent søker"}</h3>
                            <p className="applicant-email">
                              {app.applicantEmail}
                            </p>
                          </div>
                        </div>

                        {app.aiReason && (
                          <p className="ai-reason">{app.aiReason}</p>
                        )}

                        {app.profile?.skills && (
                          <div className="applicant-skills">
                            {app.profile.skills
                              .split(",")
                              .slice(0, 4)
                              .map((skill, i) => (
                                <span key={i} className="skill-tag small">
                                  {skill.trim()}
                                </span>
                              ))}
                          </div>
                        )}

                        <p className="applicant-date">
                          Søkt:{" "}
                          {app.appliedAt
                            ?.toDate?.()
                            ?.toLocaleDateString("nb-NO") || "-"}
                        </p>
                      </div>

                      <div className="applicant-actions">
                        <select
                          value={app.status || "pending"}
                          onChange={(e) =>
                            handleStatusChange(app, e.target.value)
                          }
                          className="status-select"
                        >
                          <option value="pending">Under vurdering</option>
                          <option value="reviewed">Gjennomgått</option>
                          <option value="interview">Til intervju</option>
                          <option value="accepted">Akseptert</option>
                          <option value="rejected">Avslått</option>
                        </select>
                        <button
                          className="button small primary"
                          onClick={() => handleStatusChange(app, "interview")}
                          title="Send melding og inviter til intervju"
                        >
                          Inviter
                        </button>
                        <button
                          className="button small"
                          onClick={() => setSelectedApplicant(app)}
                        >
                          Se detaljer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ALLE SØKERE-FANE */}
        {activeTab === "applicants" && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Alle søkere</h1>
                <p>Oversikt over alle søknader du har mottatt</p>
              </div>
            </header>

            <div className="dashboard-content">
              {applications.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-graphic" aria-hidden />
                  <h3>Ingen søkere ennå</h3>
                  <p>
                    Når privatpersoner sender søknader på dine stillinger, vil
                    de vises her.
                  </p>
                </div>
              ) : (
                <div className="applicants-list">
                  {applications.map((app) => (
                    <div key={app.id} className="applicant-card">
                      <div className="applicant-info">
                        <div className="applicant-header">
                          {app.profile?.profileImage && (
                            <img
                              src={app.profile.profileImage}
                              alt=""
                              className="applicant-avatar"
                            />
                          )}
                          <div>
                            <h3>{app.applicantName || "Ukjent søker"}</h3>
                            <p className="applicant-job">
                              Søkt på: {app.jobTitle}
                            </p>
                          </div>
                        </div>
                        <p className="applicant-date">
                          {app.appliedAt
                            ?.toDate?.()
                            ?.toLocaleDateString("nb-NO") || "-"}
                        </p>
                      </div>

                      <div className="applicant-actions">
                        <span
                          className={`status-badge ${app.status || "pending"}`}
                        >
                          {app.status === "interview"
                            ? "Til intervju"
                            : app.status === "accepted"
                              ? "Akseptert"
                              : app.status === "rejected"
                                ? "Avslått"
                                : app.status === "reviewed"
                                  ? "Gjennomgått"
                                  : "Under vurdering"}
                        </span>
                        <button
                          className="button small"
                          onClick={() => setSelectedApplicant(app)}
                        >
                          Se detaljer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* NY STILLING MODAL */}
        {showNewJobForm && (
          <div
            className="modal-overlay"
            onClick={() => setShowNewJobForm(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Opprett ny stilling</h2>
              <form onSubmit={handleCreateJob} className="job-form">
                <div className="form-group">
                  <label>Stillingstittel *</label>
                  <input
                    type="text"
                    value={newJob.title}
                    onChange={(e) =>
                      setNewJob({ ...newJob, title: e.target.value })
                    }
                    placeholder="F.eks. Frontend-utvikler"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Nøkkelord (brukes i mal og i treff-score mot søkere)
                  </label>
                  <input
                    type="text"
                    value={newJob.keywords}
                    onChange={(e) =>
                      setNewJob({ ...newJob, keywords: e.target.value })
                    }
                    placeholder="F.eks. React, TypeScript, 3 års erfaring"
                  />
                </div>

                <div className="form-group reuse-previous-block">
                  <label htmlFor="reuse-search">Gjenbruk egen tekst</label>
                  <input
                    id="reuse-search"
                    type="search"
                    className="reuse-search-input"
                    placeholder="Søk i tittel eller tekst…"
                    value={reuseSearch}
                    onChange={(e) => setReuseSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="reuse-previous-actions">
                    <select
                      id="reuse-job-select"
                      value={reuseSource}
                      onChange={(e) => setReuseSource(e.target.value)}
                      className="reuse-source-select"
                    >
                      <option value="">
                        Velg utlyst stilling eller bibliotektekst…
                      </option>
                      {reuseRowsForSelect.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="button secondary reuse-previous-insert"
                      onClick={() => void handleReuseJobDescription()}
                      disabled={!reuseSource}
                    >
                      Lim inn tekst
                    </button>
                  </div>
                  <p className="template-hint">
                    Nyeste først. «Bibliotek» er tekster du lagrer under{" "}
                    <strong>Stillingsbibliotek</strong> (eller kopi fra utlyst
                    stilling). Ved AI-utkast kan serveren bruke utdrag herfra som
                    stilinspirasjon (RAG) hvis embeddings er konfigurert på
                    serveren.
                  </p>
                </div>

                <div className="form-group">
                  <div className="description-header">
                    <label>Beskrivelse *</label>
                    <div className="description-header-actions">
                      <button
                        type="button"
                        className="template-generate-btn"
                        onClick={handleFillJobTemplate}
                      >
                        Mal (gratis)
                      </button>
                      <button
                        type="button"
                        className={
                          aiJobLoading
                            ? "template-generate-btn template-generate-btn--disabled"
                            : "template-generate-btn"
                        }
                        onClick={() => void handleAiJobPosting()}
                        disabled={aiJobLoading}
                        title="Lager utkast via lokal Python (mal). Krever AI-tilgang på bedriftskonto og kjørende backend."
                      >
                        {aiJobLoading ? "AI…" : "AI-utkast"}
                      </button>
                    </div>
                  </div>
                  {aiError && <p className="ai-error">{aiError}</p>}
                  <p className="template-hint">
                    <strong>Mal (gratis):</strong> bruker tittel, sted,
                    nøkkelord og teksten fra{" "}
                    <Link to="/dashboard/company/profil">Bedriftsprofil</Link>{" "}
                    (Om bedriften).
                  </p>
                  <p className="template-hint">
                    <strong>AI-utkast:</strong> krever AI-tilgang på kontoen.
                    Tekst bygges lokalt i Python (strukturert mal – ingen Groq/sky-LLM).
                  </p>
                  <textarea
                    value={newJob.description}
                    onChange={(e) =>
                      setNewJob({ ...newJob, description: e.target.value })
                    }
                    placeholder="Beskriv stillingen..."
                    rows={8}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sted</label>
                    <input
                      type="text"
                      value={newJob.location}
                      onChange={(e) =>
                        setNewJob({ ...newJob, location: e.target.value })
                      }
                      placeholder="F.eks. Oslo"
                    />
                  </div>
                  <div className="form-group">
                    <label>Stillingstype</label>
                    <select
                      value={newJob.type}
                      onChange={(e) =>
                        setNewJob({ ...newJob, type: e.target.value })
                      }
                    >
                      <option value="full-time">Heltid</option>
                      <option value="part-time">Deltid</option>
                      <option value="contract">Kontrakt</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Lønn (valgfritt)</label>
                  <input
                    type="text"
                    value={newJob.salary}
                    onChange={(e) =>
                      setNewJob({ ...newJob, salary: e.target.value })
                    }
                    placeholder="F.eks. 500 000 - 650 000 kr"
                  />
                </div>

                <div className="form-buttons">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setShowNewJobForm(false)}
                  >
                    Avbryt
                  </button>
                  <button type="submit" className="button primary">
                    Publiser stilling
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SØKER-DETALJER MODAL */}
        {selectedApplicant && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedApplicant(null)}
          >
            <div
              className="modal applicant-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close-modal"
                onClick={() => setSelectedApplicant(null)}
              >
                ×
              </button>

              <div className="applicant-detail-header">
                {selectedApplicant.profile?.profileImage && (
                  <img
                    src={selectedApplicant.profile.profileImage}
                    alt=""
                    className="detail-avatar"
                  />
                )}
                <div>
                  <h2>{selectedApplicant.applicantName || "Søker"}</h2>
                  <p>{selectedApplicant.applicantEmail}</p>
                  {selectedApplicant.aiScore && (
                    <span className="detail-score">
                      AI-score: {selectedApplicant.aiScore}/100
                    </span>
                  )}
                </div>
              </div>

              {selectedApplicant.aiReason && (
                <div className="detail-section ai-evaluation">
                  <h3>AI-vurdering</h3>
                  <p>{selectedApplicant.aiReason}</p>
                </div>
              )}

              {/* Profil før søknad: samme split-funksjoner som offentlig CV (.cv-prose i Dashboard.css) */}
              {selectedApplicant.profile && (
                <>
                  {selectedApplicant.profile.summary && (
                    <div className="detail-section">
                      <h3>Om søkeren</h3>
                      <div className="cv-prose" lang="nb">
                        {splitProfileIntroParagraphs(
                          String(selectedApplicant.profile.summary),
                        ).map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApplicant.profile.experience && (
                    <div className="detail-section">
                      <h3>Erfaring</h3>
                      <div className="cv-prose" lang="nb">
                        {splitCvMultilineParagraphs(
                          String(selectedApplicant.profile.experience),
                        ).map((para, i) => (
                          <p key={i} className="cv-prose-multiline">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApplicant.profile.education && (
                    <div className="detail-section">
                      <h3>Utdanning</h3>
                      <div className="cv-prose" lang="nb">
                        {splitCvMultilineParagraphs(
                          String(selectedApplicant.profile.education),
                        ).map((para, i) => (
                          <p key={i} className="cv-prose-multiline">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApplicant.profile.skills && (
                    <div className="detail-section">
                      <h3>Ferdigheter</h3>
                      {/* Komma-separert liste; normalizeCvHyphens unngår brutt ord ved linjeskift */}
                      <div className="applicant-skills">
                        {normalizeCvHyphens(String(selectedApplicant.profile.skills))
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill, i) => (
                            <span key={i} className="skill-tag">
                              {skill}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Søknadstekst: splitCvMultilineParagraphs (som på CV-siden) */}
              <div className="detail-section">
                <h3>Søknadstekst</h3>
                {selectedApplicant.coverLetter ? (
                  <div className="cover-letter-text">
                    <div className="cv-prose" lang="nb">
                      {splitCvMultilineParagraphs(
                        String(selectedApplicant.coverLetter),
                      ).map((para, i) => (
                        <p key={i} className="cv-prose-multiline">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="no-cover-letter">
                    Søkeren sendte ikke med søknadstekst
                  </p>
                )}
                {selectedApplicant.cvPdfUrl ? (
                  <p className="template-hint" style={{ marginTop: "0.75rem" }}>
                    CV/PDF:{" "}
                    <a
                      href={selectedApplicant.cvPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedApplicant.cvPdfName || "Åpne PDF"}
                    </a>
                  </p>
                ) : null}
                {selectedApplicant.coverLetterPdfUrl ? (
                  <p className="template-hint" style={{ marginTop: "0.75rem" }}>
                    PDF-vedlegg:{" "}
                    <a
                      href={selectedApplicant.coverLetterPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedApplicant.coverLetterPdfName || "Åpne PDF"}
                    </a>
                  </p>
                ) : null}
              </div>

              {selectedApplicant.userId ? (
                <p className="template-hint" style={{ marginBottom: "0.75rem" }}>
                  <Link to={`/meldinger?with=${selectedApplicant.userId}`}>
                    Åpne direktechat med søker
                  </Link>
                </p>
              ) : null}

              <div className="detail-actions">
                <select
                  value={selectedApplicant.status || "pending"}
                  onChange={(e) =>
                    handleStatusChange(selectedApplicant, e.target.value)
                  }
                  className="status-select large"
                >
                  <option value="pending">Under vurdering</option>
                  <option value="reviewed">Gjennomgått</option>
                  <option value="interview">Til intervju</option>
                  <option value="accepted">Akseptert</option>
                  <option value="rejected">Avslått</option>
                </select>

                {/* Knapp for å invitere til intervju med melding */}
                <button
                  className="button primary invite-btn"
                  onClick={() =>
                    handleStatusChange(selectedApplicant, "interview")
                  }
                >
                  Inviter til intervju
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for å sende melding til søker ved intervju */}
        {showMessageModal && messageRecipient && (
          <div
            className="modal-overlay"
            onClick={() => setShowMessageModal(false)}
          >
            <div className="message-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Inviter {messageRecipient.applicantName} til intervju</h2>

              <div className="message-modal-body">
                <p className="message-subtitle">
                  Søkeren vil se denne meldingen på sin profil
                </p>

                <div className="message-form">
                  <label>Din melding til kandidaten:</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Skriv en personlig melding til søkeren..."
                  />
                </div>

                <div className="message-actions">
                  <button
                    className="button secondary"
                    onClick={() => setShowMessageModal(false)}
                  >
                    Avbryt
                  </button>
                  <button
                    className="button primary"
                    onClick={sendMessageAndUpdateStatus}
                  >
                    Send invitasjon
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <AiPaywallModal
        open={showAiPaywall}
        onClose={() => setShowAiPaywall(false)}
        title="AI krever tilgang"
        message="Det finnes ingen gratis AI-prøver. Kjøp tilgang (f.eks. via Stripe når det er klart) eller be administrator om å aktivere AI-pass for bedriften."
      />
    </div>
  );
}

export default CompanyDashboard;
