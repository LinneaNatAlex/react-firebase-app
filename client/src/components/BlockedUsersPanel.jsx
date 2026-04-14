// Liste over blokkerte brukere – innstillinger (alle kontotyper)

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { listBlockedUsers, unblockUser, fetchParticipantLabel } from "../services/chat";

export default function BlockedUsersPanel() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listBlockedUsers(db, currentUser.uid);
        const enriched = await Promise.all(
          list.map(async (r) => {
            const u = await getDoc(doc(db, "users", r.id));
            const t = u.exists() ? u.data().userType : "";
            const href = t === "company" ? `/bedrift/${r.id}` : `/profil/${r.id}`;
            let label = "Bruker";
            try {
              label = await fetchParticipantLabel(db, r.id);
            } catch {
              /* */
            }
            return { id: r.id, href, label };
          }),
        );
        if (!cancelled) setRows(enriched);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Kunne ikke laste blokkerte brukere.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  async function handleUnblock(blockedUid) {
    if (!currentUser?.uid) return;
    try {
      await unblockUser(db, currentUser.uid, blockedUid);
      setRows((r) => r.filter((x) => x.id !== blockedUid));
      toast.success("Blokkering opphevet.");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke oppheve blokkering.");
    }
  }

  if (loading) {
    return (
      <section className="notification-settings-card">
        <h2 className="notification-settings-section-title">Blokkerte brukere</h2>
        <p className="blocked-users-hint">Laster…</p>
      </section>
    );
  }

  return (
    <section className="notification-settings-card">
      <h2 className="notification-settings-section-title">Blokkerte brukere</h2>
      <p className="blocked-users-hint">
        Du kan ikke sende eller motta meldinger med blokkerte brukere. Opphev blokkering her for å
        tillate kontakt igjen.
      </p>
      {rows.length === 0 ? (
        <p className="blocked-users-empty">Ingen blokkerte brukere.</p>
      ) : (
        <ul className="blocked-users-list">
          {rows.map((r) => (
            <li key={r.id} className="blocked-users-item">
              <div className="blocked-users-item-text">
                <span className="blocked-users-name">{r.label}</span>
                <Link to={r.href} className="blocked-users-profile-link">
                  Se profil
                </Link>
              </div>
              <button
                type="button"
                className="button ghost small"
                onClick={() => handleUnblock(r.id)}
              >
                Opphev blokkering
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
