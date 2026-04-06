import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { MAGAZINE_NAME } from "../config/magazine";
import {
  fetchArticleById,
  publishArticle,
  saveArticleDraft,
  stripHtml,
  unpublishArticle,
} from "../services/magazineArticles";
import ConfirmModal from "../components/ConfirmModal";
import "../styles/ConfirmModal.css";
import "../styles/MagazineEditorPage.css";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ script: "sub" }, { script: "super" }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ],
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "script",
  "list",
  "bullet",
  "indent",
  "align",
  "blockquote",
  "code-block",
  "link",
  "image",
];

function firebaseErrMessage(e) {
  const code = e?.code || "";
  const msg = e?.message || String(e);
  if (code === "permission-denied" || msg.includes("permission")) {
    return "Ingen tilgang (Firestore). Logg ut og inn igjen, og sjekk at redaktør-rollen er lagret i Firebase og at reglene for magazineArticles er publisert.";
  }
  return msg;
}

export default function MagazineEditorPage() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData, refreshUserData } = useAuth();
  const { success, error: toastError } = useToast();
  /** Satt fra Firestore i load() – ikke bare userData (kan være utdatert i context) */
  const [isEditorRole, setIsEditorRole] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [status, setStatus] = useState("draft");
  const [slug, setSlug] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [error, setError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);

  const canEdit = useMemo(() => {
    if (!currentUser || !articleId) return false;
    return true;
  }, [currentUser, articleId]);

  const load = useCallback(async () => {
    if (!articleId || !currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const merged = await refreshUserData();
      const editor = merged?.newspaperRole === "editor";
      setIsEditorRole(Boolean(editor));
      const a = await fetchArticleById(articleId);
      if (!a) {
        setError("Fant ikke artikkelen.");
        setLoading(false);
        return;
      }
      const allowed = a.authorId === currentUser.uid || editor;
      if (!allowed) {
        setError("Du har ikke tilgang til å redigere denne artikkelen.");
        setLoading(false);
        return;
      }
      if (a.status === "published" && !editor) {
        setError(
          "Publiserte artikler kan bare redigeres av redaktør. Kontakt redaksjonen.",
        );
        setLoading(false);
        return;
      }
      setTitle(a.title || "");
      setBodyHtml(a.bodyHtml || "");
      setStatus(a.status || "draft");
      setSlug(a.slug || "");
      setAuthorName(a.authorName || "");
      setCoverImageUrl(typeof a.coverImageUrl === "string" ? a.coverImageUrl : "");
    } catch (e) {
      console.error(e);
      setError("Kunne ikke laste artikkelen.");
    }
    setLoading(false);
  }, [articleId, currentUser, refreshUserData]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!articleId || saving) return;
    setSaving(true);
    try {
      const merged = await refreshUserData();
      setIsEditorRole(merged?.newspaperRole === "editor");
      const plain = stripHtml(bodyHtml);
      const excerpt =
        plain.slice(0, 160) + (plain.length > 160 ? "…" : "");
      await saveArticleDraft(articleId, {
        title: title.trim() || "Uten tittel",
        bodyHtml,
        excerpt,
        coverImageUrl: coverImageUrl.trim(),
      });
      setLastSavedAt(new Date());
      success("Kladd lagret");
    } catch (e) {
      console.error(e);
      toastError(firebaseErrMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function openPublishModal() {
    if (!articleId || saving) return;
    if (!isEditorRole) {
      toastError(
        "Bare redaktør kan publisere. Be administrator om rollen «Redaktør», eller be en redaktør publisere kladden.",
      );
      return;
    }
    setPublishModalOpen(true);
  }

  async function runPublish() {
    if (!articleId || saving) return;
    const t = title.trim() || "Uten tittel";
    setSaving(true);
    try {
      const merged = await refreshUserData();
      setIsEditorRole(merged?.newspaperRole === "editor");
      if (merged?.newspaperRole !== "editor") {
        toastError("Du er ikke redaktør lenger. Oppdater siden eller kontakt admin.");
        setPublishModalOpen(false);
        return;
      }
      const plain = stripHtml(bodyHtml);
      const excerpt =
        plain.slice(0, 160) + (plain.length > 160 ? "…" : "");
      await saveArticleDraft(articleId, {
        title: t,
        bodyHtml,
        excerpt,
        coverImageUrl: coverImageUrl.trim(),
      });
      const newSlug = await publishArticle(articleId, t);
      setPublishModalOpen(false);
      setStatus("published");
      setSlug(newSlug);
      success("Publisert");
      navigate(`/utblikk/sak/${newSlug}`, { replace: true });
    } catch (e) {
      console.error(e);
      toastError(firebaseErrMessage(e));
      setPublishModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function openUnpublishModal() {
    if (!articleId || !isEditorRole || saving) return;
    setUnpublishModalOpen(true);
  }

  async function runUnpublish() {
    if (!articleId || !isEditorRole || saving) return;
    setSaving(true);
    try {
      const merged = await refreshUserData();
      setIsEditorRole(merged?.newspaperRole === "editor");
      await unpublishArticle(articleId);
      setUnpublishModalOpen(false);
      setStatus("draft");
      setSlug("");
      success("Artikkelen er avpublisert (kladd)");
    } catch (e) {
      console.error(e);
      toastError(firebaseErrMessage(e));
      setUnpublishModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="magazine-editor-page">
        <p className="magazine-editor-loading">Laster redigeringsprogram…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="magazine-editor-page">
        <p className="magazine-editor-error">{error}</p>
        <Link to="/utblikk/redaksjon">← Tilbake til redaksjon</Link>
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="magazine-editor-page">
      <div className="magazine-editor-toolbar">
        <div className="magazine-editor-toolbar-left">
          <Link to="/utblikk/redaksjon" className="magazine-editor-back">
            ← Redaksjon
          </Link>
          <Link to="/utblikk" className="magazine-editor-utblikk-link">
            Se {MAGAZINE_NAME}
          </Link>
        </div>
        <div className="magazine-editor-toolbar-actions">
          <button
            type="button"
            className="magazine-editor-btn secondary"
            onClick={handleSave}
            disabled={saving}
            title="Lagrer som kladd (vises ikke offentlig før du publiserer)"
          >
            {saving ? "Lagrer…" : "Lagre kladd"}
          </button>
          {status === "draft" && isEditorRole && (
            <button
              type="button"
              className="magazine-editor-btn primary"
              onClick={openPublishModal}
              disabled={saving}
              title="Gjør artikkelen synlig på Utblikk"
            >
              Publiser i Utblikk
            </button>
          )}
          {status === "published" && isEditorRole && (
            <button
              type="button"
              className="magazine-editor-btn warn"
              onClick={openUnpublishModal}
              disabled={saving}
            >
              Avpubliser
            </button>
          )}
        </div>
      </div>

      <p className="magazine-editor-hint">
        {lastSavedAt ? (
          <span className="magazine-editor-saved">
            Sist lagret {lastSavedAt.toLocaleTimeString("no-NO")}
            {" · "}
          </span>
        ) : null}
        {status === "published" ? (
          <>
            Publisert
            {slug ? (
              <>
                {" "}
                · <Link to={`/utblikk/sak/${slug}`}>Vis på nett</Link>
              </>
            ) : null}
          </>
        ) : (
          <>
            Kladd — vises ikke på Utblikk før du trykker{" "}
            <strong>Publiser i Utblikk</strong>
            {userData?.newspaperRole === "journalist" ? (
              <> (som journalist må en redaktør publisere)</>
            ) : null}
            .
          </>
        )}
      </p>

      {authorName && (
        <p className="magazine-editor-byline">
          Skrevet av <strong>{authorName}</strong>
          {isEditorRole && status === "draft" ? " — du kan publisere som redaktør" : null}
        </p>
      )}

      <input
        type="text"
        className="magazine-editor-title-input"
        placeholder="Tittel"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Tittel"
      />

      <div className="magazine-editor-cover-block">
        <label className="magazine-editor-cover-label" htmlFor="magazine-cover-url">
          Forsidebilde (valgfritt)
        </label>
        <input
          id="magazine-cover-url"
          type="url"
          className="magazine-editor-cover-input"
          placeholder="https://… lim inn lenke til bilde (vises øverst på Utblikk og i saken)"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          autoComplete="off"
        />
        <p className="magazine-editor-cover-hint">
          På Utblikk-listen vises forsidebildet (eller første bilde i teksten), deretter tittel og
          maks fem setninger fra brødteksten. Bruk direkte bilde-URL (HTTPS anbefales).
        </p>
        {coverImageUrl.trim() ? (
          <div className="magazine-editor-cover-preview">
            <img
              src={coverImageUrl.trim()}
              alt=""
              onError={(e) => {
                e.currentTarget.style.opacity = "0.2";
              }}
              onLoad={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="magazine-editor-quill-wrap">
        <ReactQuill
          theme="snow"
          value={bodyHtml}
          onChange={setBodyHtml}
          modules={quillModules}
          formats={quillFormats}
          placeholder="Skriv brødtekst her…"
        />
      </div>

      <ConfirmModal
        open={publishModalOpen}
        onClose={() => !saving && setPublishModalOpen(false)}
        title={`Publisere på ${MAGAZINE_NAME}?`}
        confirmLabel="Ja, publiser"
        cancelLabel="Avbryt"
        variant="primary"
        confirmBusy={saving}
        onConfirm={runPublish}
      >
        <p>
          Saken blir synlig for alle på{" "}
          <strong>{MAGAZINE_NAME}</strong> med tittelen «
          {title.trim() || "Uten tittel"}».
        </p>
        <p className="confirm-modal-body-tail">
          Du kan redigere eller avpublisere senere som redaktør.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={unpublishModalOpen}
        onClose={() => !saving && setUnpublishModalOpen(false)}
        title="Avpublisere?"
        confirmLabel="Ja, fjern fra nett"
        cancelLabel="Avbryt"
        variant="danger"
        confirmBusy={saving}
        onConfirm={runUnpublish}
      >
        <p className="confirm-modal-body-tail">
          Artikkelen vises ikke lenger offentlig og lagres som kladd.
        </p>
      </ConfirmModal>
    </div>
  );
}
