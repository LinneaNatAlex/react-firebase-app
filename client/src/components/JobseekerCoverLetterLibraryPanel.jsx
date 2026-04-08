import { useMemo, useState } from "react";
import {
  deleteJobseekerCoverLetter,
  updateJobseekerCoverLetter,
} from "../services/jobseekerCoverLetters";
import { useToast } from "./Toast";

function tsLabel(t) {
  const d = t?.toDate?.();
  if (!d) return "";
  try {
    return d.toLocaleDateString("nb-NO");
  } catch {
    return "";
  }
}

export default function JobseekerCoverLetterLibraryPanel({
  items,
  onRefresh,
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const FREE_LIMIT = 10;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => {
      const hay = `${x.companyName || ""} ${x.jobTitle || ""} ${x.location || ""} ${x.coverLetter || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const visible = useMemo(
    () => filtered.slice(0, FREE_LIMIT),
    [filtered],
  );

  function startEdit(item) {
    setEditingId(item.id);
    setEditText(String(item.coverLetter || ""));
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    try {
      await updateJobseekerCoverLetter(editingId, { coverLetter: editText });
      toast.success("Oppdatert.");
      setEditingId(null);
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Slette denne lagrede søknaden?")) return;
    setBusy(true);
    try {
      await deleteJobseekerCoverLetter(id);
      toast.success("Slettet.");
      if (editingId === id) setEditingId(null);
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Kunne ikke slette.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Søknadsbibliotek</h1>
          <p>
            Her ligger søknadstekster du har sendt tidligere. Du kan gjenbruke,
            redigere og kopiere dem – uten AI.
          </p>
        </div>
      </header>

      <div className="dashboard-content company-library-content">
        <div className="form-group cover-letter-library-search-wrap">
          <label htmlFor="cl-search">Søk</label>
          <input
            id="cl-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk på bedrift, stilling, sted eller tekst…"
          />
        </div>

        {filtered.length > FREE_LIMIT ? (
          <div className="library-limit-callout">
            <strong>Gratisgrense:</strong> Du ser de siste {FREE_LIMIT} søknadene her.
            For flere, legg inn abonnement (kommer i «Priser»).
          </div>
        ) : null}

        {visible.length === 0 ? (
          <p className="template-hint">Ingen lagrede søknader å vise.</p>
        ) : (
          <ul className="library-item-list">
            {visible.map((item) => {
              const metaParts = [
                item.companyName,
                item.jobTitle,
                item.location,
                tsLabel(item.createdAt) ? `Sendt ${tsLabel(item.createdAt)}` : "",
              ].filter(Boolean);
              return (
                <li key={item.id} className="library-item-card">
                  <div className="library-item-header">
                    <div style={{ minWidth: 0 }}>
                      <h3>{item.companyName || "Bedrift"}</h3>
                      <p className="template-hint" style={{ margin: "0.25rem 0 0" }}>
                        {metaParts.join(" · ")}
                      </p>
                    </div>
                    <div className="library-item-actions">
                      {editingId === item.id ? (
                        <>
                          <button
                            type="button"
                            className="button small primary"
                            onClick={saveEdit}
                            disabled={busy}
                          >
                            Lagre
                          </button>
                          <button
                            type="button"
                            className="button small"
                            onClick={() => setEditingId(null)}
                            disabled={busy}
                          >
                            Avbryt
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="button small"
                            onClick={() => startEdit(item)}
                            disabled={busy}
                          >
                            Rediger
                          </button>
                          <button
                            type="button"
                            className="button small"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  String(item.coverLetter || ""),
                                );
                                toast.success("Kopiert til utklippstavle.");
                              } catch {
                                toast.error("Kunne ikke kopiere.");
                              }
                            }}
                            disabled={busy}
                          >
                            Kopier
                          </button>
                          <button
                            type="button"
                            className="button small danger"
                            onClick={() => void remove(item.id)}
                            disabled={busy}
                          >
                            Slett
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === item.id ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={10}
                      className="library-edit-textarea"
                    />
                  ) : (
                    <p className="library-item-preview">
                      {String(item.coverLetter || "").slice(0, 420)}
                      {String(item.coverLetter || "").length > 420 ? "…" : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

