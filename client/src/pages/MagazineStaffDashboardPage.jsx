import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { MAGAZINE_NAME } from "../config/magazine";
import {
  createDraftArticle,
  deleteArticle,
  fetchAllDrafts,
  fetchDraftsForAuthor,
  fetchPublishedArticles,
} from "../services/magazineArticles";
import "../styles/ConfirmModal.css";
import "../styles/MagazineStaffDashboardPage.css";

function authorLabel(userData) {
  if (!userData) return "";
  if (userData.userType === "company") {
    return userData.companyName?.trim() || userData.email || "";
  }
  const n = [userData.firstName, userData.lastName].filter(Boolean).join(" ");
  return n || userData.email || "";
}

export default function MagazineStaffDashboardPage() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();

  /** Fersk rolle fra Firestore (userData i context kan være utdatert) */
  const [editorRole, setEditorRole] = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [published, setPublished] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [listError, setListError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) {
        setEditorRole(false);
        setRoleReady(true);
        return;
      }
      const merged = await refreshUserData();
      if (cancelled) return;
      setEditorRole(merged?.newspaperRole === "editor");
      setRoleReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, refreshUserData]);

  useEffect(() => {
    if (!roleReady || !currentUser) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setListError(null);
      try {
        const d = editorRole
          ? await fetchAllDrafts()
          : await fetchDraftsForAuthor(currentUser.uid);
        const p = await fetchPublishedArticles(12);
        if (!cancelled) {
          setDrafts(d);
          setPublished(p);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setDrafts([]);
          setPublished([]);
          setListError(
            e?.message ||
              e?.code ||
              "Kunne ikke hente artikler. Sjekk nettverk og Firestore-regler.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, editorRole, roleReady]);

  async function handleNew() {
    if (!currentUser) return;
    setCreating(true);
    try {
      const merged = await refreshUserData();
      const name = authorLabel(merged || userData);
      const id = await createDraftArticle({
        authorId: currentUser.uid,
        authorName: name,
      });
      navigate(`/utblikk/rediger/${id}`);
    } catch (e) {
      console.error(e);
      toastError(
        `Kunne ikke opprette artikkel: ${e?.message || e?.code || "ukjent feil"}. Sjekk Firestore-regler for magazineArticles.`,
      );
    } finally {
      setCreating(false);
    }
  }

  async function runDeleteDraft() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteArticle(deleteTarget.id);
      setDrafts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      toastError(`Kunne ikke slette: ${e?.message || e?.code || ""}`);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!roleReady || loading) {
    return (
      <div className="magazine-staff-page">
        <p className="magazine-staff-loading">Laster redaksjon…</p>
      </div>
    );
  }

  return (
    <div className="magazine-staff-page">
      <header className="magazine-staff-header">
        <h1>{MAGAZINE_NAME} — redaksjon</h1>
        <p className="magazine-staff-intro">
          {editorRole
            ? "Som redaktør ser du alle kladder og kan publisere saker."
            : "Som journalist kan du skrive og lagre kladder. En redaktør publiserer på nett."}
        </p>
        <div className="magazine-staff-actions">
          <button
            type="button"
            className="magazine-staff-btn primary"
            onClick={handleNew}
            disabled={creating}
          >
            {creating ? "Oppretter…" : "Ny artikkel"}
          </button>
          <Link to="/utblikk" className="magazine-staff-btn secondary">
            Til {MAGAZINE_NAME}
          </Link>
        </div>
      </header>

      {listError ? (
        <div className="magazine-staff-error" role="alert">
          <strong>Kunne ikke laste lister:</strong> {listError}
          <p className="magazine-staff-error-hint">
            Vanlige årsaker: Firestore-regler er ikke publisert for{" "}
            <code>magazineArticles</code>, eller du mangler tilgang. Sjekk også
            nettleserkonsollen (F12).
          </p>
        </div>
      ) : null}

      <section className="magazine-staff-section" aria-labelledby="drafts-heading">
        <h2 id="drafts-heading">Kladder</h2>
        {drafts.length === 0 ? (
          <p className="magazine-staff-empty">Ingen kladder ennå.</p>
        ) : (
          <ul className="magazine-staff-list">
            {drafts.map((a) => (
              <li key={a.id} className="magazine-staff-row">
                <div>
                  <strong>{a.title || "Uten tittel"}</strong>
                  {editorRole && a.authorId !== currentUser?.uid && (
                    <span className="magazine-staff-byline">
                      {" "}
                      · {a.authorName || a.authorId}
                    </span>
                  )}
                </div>
                <div className="magazine-staff-row-meta">
                  {a.updatedAt?.toDate?.()?.toLocaleString("no-NO") ?? "—"}
                </div>
                <div className="magazine-staff-row-actions">
                  <Link to={`/utblikk/rediger/${a.id}`} className="magazine-staff-link">
                    Rediger
                  </Link>
                  <button
                    type="button"
                    className="magazine-staff-link danger"
                    onClick={() =>
                      setDeleteTarget({
                        id: a.id,
                        title: a.title || "Uten tittel",
                      })
                    }
                  >
                    Slett
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="magazine-staff-section" aria-labelledby="pub-heading">
        <h2 id="pub-heading">Nylig publisert</h2>
        {published.length === 0 ? (
          <p className="magazine-staff-empty">Ingen publiserte artikler ennå.</p>
        ) : (
          <ul className="magazine-staff-list">
            {published.map((a) => (
              <li key={a.id} className="magazine-staff-row">
                <div>
                  <Link to={`/utblikk/sak/${a.slug}`} className="magazine-staff-article-link">
                    {a.title}
                  </Link>
                </div>
                <div className="magazine-staff-row-meta">
                  {a.publishedAt?.toDate?.()?.toLocaleDateString("no-NO") ?? "—"}
                </div>
                {editorRole && (
                  <div className="magazine-staff-row-actions">
                    <Link to={`/utblikk/rediger/${a.id}`} className="magazine-staff-link">
                      Rediger
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        title="Slette kladd?"
        confirmLabel="Ja, slett"
        cancelLabel="Avbryt"
        variant="danger"
        confirmBusy={deleteBusy}
        onConfirm={runDeleteDraft}
      >
        <p className="confirm-modal-body-tail">
          Kladden «<strong>{deleteTarget?.title}</strong>» slettes permanent.
        </p>
      </ConfirmModal>
    </div>
  );
}
