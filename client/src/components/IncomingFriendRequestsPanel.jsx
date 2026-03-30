import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import {
  subscribeIncomingFriendRequests,
  fetchUserLabelsForIds,
  acceptFriendRequest,
  declineFriendRequest,
} from "../services/social";

/**
 * Viser innkommende venneforespørsler (Firestore friendRequests), uavhengig av varslingsbjelle.
 */
export default function IncomingFriendRequestsPanel() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState({});
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setRows([]);
      return undefined;
    }
    return subscribeIncomingFriendRequests(db, currentUser.uid, setRows);
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const uids = [...new Set(rows.map((r) => r.fromUid).filter(Boolean))];
      if (uids.length === 0) {
        if (!cancelled) setLabels({});
        return;
      }
      const list = await fetchUserLabelsForIds(db, uids);
      if (cancelled) return;
      const map = {};
      list.forEach((x) => {
        map[x.uid] = x.label;
      });
      setLabels(map);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  async function handleAccept(fromUid) {
    if (!currentUser?.uid) return;
    setBusyId(fromUid);
    try {
      await acceptFriendRequest(db, currentUser.uid, fromUid);
      toast.success("Dere er nå venner.");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke godta. Prøv igjen.");
    }
    setBusyId(null);
  }

  async function handleDecline(fromUid) {
    if (!currentUser?.uid) return;
    setBusyId(fromUid);
    try {
      await declineFriendRequest(db, currentUser.uid, fromUid);
      toast.success("Forespørsel avslått.");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke avslå. Prøv igjen.");
    }
    setBusyId(null);
  }

  if (!currentUser || rows.length === 0) return null;

  return (
    <section className="dashboard-friend-requests" aria-label="Innkommende venneforespørsler">
      <div className="dashboard-friend-requests-head">
        <h2 className="dashboard-friend-requests-title">Venneforespørsler</h2>
        <p className="dashboard-friend-requests-lead">
          {rows.length === 1
            ? "Én person vil bli venn med deg."
            : `${rows.length} personer vil bli venn med deg.`}
        </p>
      </div>
      <ul className="dashboard-friend-requests-list">
        {rows.map((r) => {
          const fromUid = r.fromUid;
          const name = labels[fromUid] || "Bruker";
          const loading = busyId === fromUid;
          return (
            <li key={r.id} className="dashboard-friend-requests-item">
              <div className="dashboard-friend-requests-text">
                <strong>{name}</strong>
                <span className="dashboard-friend-requests-sub">vil være venn</span>
              </div>
              <div className="dashboard-friend-requests-actions">
                <Link to={`/profil/${fromUid}`} className="dashboard-friend-requests-link">
                  Se profil
                </Link>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => handleDecline(fromUid)}
                  disabled={loading}
                >
                  Avslå
                </button>
                <button
                  type="button"
                  className="button primary small"
                  onClick={() => handleAccept(fromUid)}
                  disabled={loading}
                >
                  {loading ? "…" : "Godta"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
