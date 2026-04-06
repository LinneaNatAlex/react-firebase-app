import { useState } from "react";
import {
  addCompanyJobLibraryItem,
  deleteCompanyJobLibraryItem,
  updateCompanyJobLibraryItem,
} from "../services/companyJobLibrary";
import { useToast } from "./Toast";

/**
 * Lagre og redigere egne stillingstekster – brukes til gjenbruk og kan mates inn i RAG på server.
 */
export default function CompanyJobLibraryPanel({
  companyId,
  jobs,
  jobLibraryItems,
  onRefresh,
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [copyJobId, setCopyJobId] = useState("");

  const jobsWithText = (jobs || []).filter(
    (j) => (j.description || "").trim().length > 0,
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!companyId) return;
    const t = title.trim();
    const d = description.trim();
    if (!d) {
      toast.warning("Skriv inn tekst som skal lagres.");
      return;
    }
    setSaving(true);
    try {
      await addCompanyJobLibraryItem(companyId, {
        title: t || "Uten tittel",
        description: d,
      });
      setTitle("");
      setDescription("");
      toast.success("Lagret i biblioteket.");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Kunne ikke lagre.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyFromJob() {
    if (!copyJobId) return;
    const job = jobs.find((j) => j.id === copyJobId);
    if (!job?.description?.trim()) {
      toast.warning("Velg en stilling med beskrivelse.");
      return;
    }
    if (!companyId) return;
    setSaving(true);
    try {
      await addCompanyJobLibraryItem(companyId, {
        title: `${job.title?.trim() || "Kopi"} (kopi)`,
        description: String(job.description).trim(),
      });
      setCopyJobId("");
      toast.success("Kopi lagret i biblioteket.");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Kunne ikke kopiere.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await updateCompanyJobLibraryItem(editingId, {
        title: editTitle,
        description: editDescription,
      });
      setEditingId(null);
      toast.success("Oppdatert.");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Kunne ikke lagre.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Slette denne teksten fra biblioteket?")) return;
    try {
      await deleteCompanyJobLibraryItem(id);
      if (editingId === id) setEditingId(null);
      toast.success("Slettet.");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Kunne ikke slette.");
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Stillingsbibliotek</h1>
          <p>
            Lagre egne tekster her (utdrag fra gamle annonser, Word, intranett).
            De brukes til rask gjenbruk i «Ny stilling» og kan hentes inn som
            kontekst når AI-utkast for stillinger blir tilgjengelig igjen
            (server med embeddings).
          </p>
        </div>
      </header>

      <div className="dashboard-content company-library-content">
        <section className="library-section library-section--copy">
          <h2 className="library-section-title">Kopier fra utlyst stilling</h2>
          <div className="library-copy-row">
            <select
              value={copyJobId}
              onChange={(e) => setCopyJobId(e.target.value)}
              className="library-select"
            >
              <option value="">Velg stilling…</option>
              {jobsWithText.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title?.trim() || "Uten tittel"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button secondary"
              onClick={handleCopyFromJob}
              disabled={!copyJobId || saving}
            >
              Lagre kopi i biblioteket
            </button>
          </div>
        </section>

        <section className="library-section">
          <h2 className="library-section-title">Ny tekst i biblioteket</h2>
          <form onSubmit={handleCreate} className="library-new-form">
            <div className="form-group">
              <label htmlFor="lib-title">Tittel / merkelapp</label>
              <input
                id="lib-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Butikkmedarbeider Oslo 2024"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lib-body">Full stillingstekst</label>
              <textarea
                id="lib-body"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder="Lim inn eller skriv teksten her…"
              />
            </div>
            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving ? "Lagrer…" : "Lagre i biblioteket"}
            </button>
          </form>
        </section>

        <section className="library-section">
          <h2 className="library-section-title">
            Lagrede tekster ({jobLibraryItems.length})
          </h2>
          {jobLibraryItems.length === 0 ? (
            <p className="template-hint">Ingen tekster lagret ennå.</p>
          ) : (
            <ul className="library-item-list">
              {jobLibraryItems.map((item) => (
                <li key={item.id} className="library-item-card">
                  {editingId === item.id ? (
                    <div className="library-edit-form">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="library-edit-title"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={8}
                      />
                      <div className="library-edit-actions">
                        <button
                          type="button"
                          className="button primary small"
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          Lagre
                        </button>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => setEditingId(null)}
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="library-item-header">
                        <h3>{item.title || "Uten tittel"}</h3>
                        <div className="library-item-actions">
                          <button
                            type="button"
                            className="button small"
                            onClick={() => startEdit(item)}
                          >
                            Rediger
                          </button>
                          <button
                            type="button"
                            className="button small danger"
                            onClick={() => handleDelete(item.id)}
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                      <p className="library-item-preview">
                        {(item.description || "").slice(0, 280)}
                        {(item.description || "").length > 280 ? "…" : ""}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
