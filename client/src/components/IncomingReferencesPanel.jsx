import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import {
  subscribeIncomingReferenceRequests,
  publishWrittenReference,
  declineReferenceRequest,
  MIN_BODY,
  MAX_BODY,
} from "../services/references";
import "../styles/PersonPublicReferences.css";

export default function IncomingReferencesPanel() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [bodies, setBodies] = useState({});
  const [names, setNames] = useState({});
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setRows([]);
      return undefined;
    }
    return subscribeIncomingReferenceRequests(db, currentUser.uid, setRows);
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    async function loadNames() {
      if (!rows.length) {
        setNames({});
        return;
      }
      const next = {};
      for (const r of rows) {
        try {
          const snap = await getDoc(doc(db, "users", r.subjectUid));
          if (cancelled) return;
          const d = snap.exists() ? snap.data() : {};
          next[r.subjectUid] =
            [d.firstName, d.lastName].filter(Boolean).join(" ").trim() ||
            "Venn";
        } catch {
          next[r.subjectUid] = "Venn";
        }
      }
      if (!cancelled) setNames(next);
    }
    loadNames();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  function setBodyFor(subjectUid, text) {
    setBodies((prev) => ({ ...prev, [subjectUid]: text }));
  }

  async function handlePublish(subjectUid) {
    const body = String(bodies[subjectUid] || "").trim();
    if (body.length < MIN_BODY) {
      toast.error(`Skriv minst ${MIN_BODY} tegn`);
      return;
    }
    if (body.length > MAX_BODY) {
      toast.error(`Maks ${MAX_BODY} tegn`);
      return;
    }
    const key = `pub-${subjectUid}`;
    setBusyKey(key);
    try {
      await publishWrittenReference(db, subjectUid, currentUser.uid, body);
      toast.success("Referansen er publisert på vedkommendes CV");
      setBodies((prev) => {
        const n = { ...prev };
        delete n[subjectUid];
        return n;
      });
    } catch (e) {
      toast.error(e?.message || "Kunne ikke publisere");
    }
    setBusyKey(null);
  }

  async function handleDecline(subjectUid) {
    const key = `dec-${subjectUid}`;
    setBusyKey(key);
    try {
      await declineReferenceRequest(db, subjectUid, currentUser.uid);
      toast.success("Forespørsel avslått");
    } catch (e) {
      toast.error("Kunne ikke avslå");
    }
    setBusyKey(null);
  }

  if (!currentUser?.uid || rows.length === 0) {
    return null;
  }

  return (
    <section
      id="incoming-references"
      className="incoming-ref-panel"
      aria-labelledby="incoming-ref-title"
    >
      <h2 id="incoming-ref-title">Referanser å skrive</h2>
      <p className="incoming-ref-lead">
        Venner kan be deg om en kort, skriftlig referanse. Den vises på CV-en deres
        for arbeidsgivere. Du må ha vært venner da de sendte forespørselen.
      </p>
      <ul className="incoming-ref-list">
        {rows.map((r) => {
          const name = names[r.subjectUid] || "…";
          const draft = bodies[r.subjectUid] ?? "";
          return (
            <li key={`${r.subjectUid}-${r.authorUid}`} className="incoming-ref-item">
              <div className="incoming-ref-item-head">
                <strong>{name}</strong>
                <Link to={`/profil/${r.subjectUid}/cv`}>Se CV</Link>
              </div>
              <textarea
                className="incoming-ref-textarea"
                placeholder={`Skriv noen ord om ${name} (arbeid, studie, samarbeid …)`}
                value={draft}
                onChange={(e) => setBodyFor(r.subjectUid, e.target.value)}
                aria-label={`Referansetekst for ${name}`}
              />
              <p className="incoming-ref-hint-count">
                {draft.trim().length} / {MAX_BODY} tegn (minst {MIN_BODY})
              </p>
              <div className="incoming-ref-actions">
                <button
                  type="button"
                  className="incoming-ref-btn incoming-ref-btn--primary"
                  onClick={() => handlePublish(r.subjectUid)}
                  disabled={busyKey !== null}
                >
                  {busyKey === `pub-${r.subjectUid}` ? "Publiserer…" : "Publiser på CV-en deres"}
                </button>
                <button
                  type="button"
                  className="incoming-ref-btn incoming-ref-btn--ghost"
                  onClick={() => handleDecline(r.subjectUid)}
                  disabled={busyKey !== null}
                >
                  {busyKey === `dec-${r.subjectUid}` ? "…" : "Avslå"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
