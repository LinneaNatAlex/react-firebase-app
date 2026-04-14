import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import ConfirmModal from "./ConfirmModal";
import {
  subscribePublishedReferences,
  subscribeOutgoingReferenceRequests,
  sendReferenceRequest,
  cancelReferenceRequest,
  removePublishedReference,
} from "../services/references";
import { listAllFriendUids, fetchFriendAvatarsForUids } from "../services/social";
import { BRAND_NAME } from "../config/brand";
import "../styles/ConfirmModal.css";
import "../styles/PersonPublicReferences.css";

function excerpt(s, max = 80) {
  const t = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function ProfileReferencesSection({ subjectUid }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const viewerUid = currentUser?.uid || null;
  const isOwnProfile = Boolean(viewerUid && viewerUid === subjectUid);

  const [published, setPublished] = useState([]);
  const [outgoingPending, setOutgoingPending] = useState([]);
  const [authorMeta, setAuthorMeta] = useState({});
  const [detail, setDetail] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [requestBusy, setRequestBusy] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [outgoingLabels, setOutgoingLabels] = useState({});

  useEffect(() => {
    return subscribePublishedReferences(db, subjectUid, setPublished);
  }, [subjectUid]);

  useEffect(() => {
    if (!isOwnProfile) {
      setOutgoingPending([]);
      return undefined;
    }
    return subscribeOutgoingReferenceRequests(db, subjectUid, setOutgoingPending);
  }, [subjectUid, isOwnProfile]);

  useEffect(() => {
    let cancelled = false;
    async function labels() {
      if (!outgoingPending.length) {
        setOutgoingLabels({});
        return;
      }
      try {
        const avatars = await fetchFriendAvatarsForUids(
          db,
          outgoingPending.map((o) => o.authorUid),
        );
        if (cancelled) return;
        const map = {};
        avatars.forEach((a) => {
          map[a.uid] = a.label || "Venn";
        });
        setOutgoingLabels(map);
      } catch {
        if (!cancelled) setOutgoingLabels({});
      }
    }
    labels();
    return () => {
      cancelled = true;
    };
  }, [outgoingPending]);

  useEffect(() => {
    let cancelled = false;
    async function loadAuthors() {
      if (!published.length) {
        setAuthorMeta({});
        return;
      }
      const meta = {};
      for (const p of published) {
        const uid = p.authorUid;
        try {
          const [uSnap, prSnap] = await Promise.all([
            getDoc(doc(db, "users", uid)),
            getDoc(doc(db, "profiles", uid)),
          ]);
          if (cancelled) return;
          const u = uSnap.exists() ? uSnap.data() : {};
          const pr = prSnap.exists() ? prSnap.data() : {};
          const name =
            [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
            "Referanse";
          meta[uid] = { name, photo: pr.profileImage || "" };
        } catch {
          if (!cancelled) meta[uid] = { name: "Referanse", photo: "" };
        }
      }
      if (!cancelled) setAuthorMeta(meta);
    }
    loadAuthors();
    return () => {
      cancelled = true;
    };
  }, [published]);

  const openRequestModal = useCallback(async () => {
    if (!isOwnProfile || !viewerUid) return;
    setRequestOpen(true);
    setFriendsLoading(true);
    try {
      const uids = await listAllFriendUids(db, viewerUid);
      const avatars = await fetchFriendAvatarsForUids(db, uids);
      const refsSnap = await getDocs(
        collection(db, "users", viewerUid, "writtenReferences"),
      );
      const statusByAuthor = {};
      refsSnap.docs.forEach((d) => {
        statusByAuthor[d.id] = d.data()?.status || null;
      });
      setFriends(
        avatars.map((f) => ({
          ...f,
          refStatus: statusByAuthor[f.uid] || null,
        })),
      );
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke laste venner.");
      setFriends([]);
    }
    setFriendsLoading(false);
  }, [isOwnProfile, viewerUid, toast]);

  async function handleAskFriend(authorUid) {
    if (!viewerUid) return;
    setRequestBusy(authorUid);
    try {
      await sendReferenceRequest(db, viewerUid, authorUid);
      toast.success("Forespørsel sendt");
      setFriends((prev) =>
        prev.map((f) =>
          f.uid === authorUid ? { ...f, refStatus: "pending" } : f,
        ),
      );
    } catch (e) {
      toast.error(e?.message || "Kunne ikke sende forespørsel");
    }
    setRequestBusy(null);
  }

  async function handleCancelOutgoing(authorUid) {
    if (!viewerUid) return;
    setRequestBusy(authorUid);
    try {
      await cancelReferenceRequest(db, viewerUid, authorUid);
      toast.success("Forespørsel trukket tilbake");
      setFriends((prev) =>
        prev.map((f) =>
          f.uid === authorUid ? { ...f, refStatus: null } : f,
        ),
      );
    } catch (e) {
      toast.error("Kunne ikke trekke tilbake");
    }
    setRequestBusy(null);
  }

  async function runRemovePublished() {
    if (!removeTarget || !viewerUid) return;
    setRemoveBusy(true);
    try {
      await removePublishedReference(db, subjectUid, removeTarget.authorUid);
      setRemoveTarget(null);
      setDetail(null);
      toast.success("Referansen er fjernet");
    } catch (e) {
      toast.error("Kunne ikke fjerne referansen");
    }
    setRemoveBusy(false);
  }

  const canRemoveInDetail =
    detail &&
    viewerUid &&
    (viewerUid === subjectUid || viewerUid === detail.authorUid);

  if (!isOwnProfile && published.length === 0) {
    return null;
  }

  return (
    <section
      id="referanser"
      className="person-ref-section"
      aria-labelledby="person-ref-heading"
    >
      <div className="person-ref-head">
        <h2 id="person-ref-heading" className="person-ref-title">
          Referanser
        </h2>
        {isOwnProfile ? (
          <button
            type="button"
            className="person-ref-request-btn"
            onClick={openRequestModal}
          >
            Be venn om skriftlig referanse
          </button>
        ) : null}
      </div>
      <p className="person-ref-lead">
        Korte anbefalinger fra venner på {BRAND_NAME}. Kun gjensidige venner kan be
        om eller skrive referanse.
      </p>

      {isOwnProfile && outgoingPending.length > 0 ? (
        <p className="person-ref-pending-out">
          Venter på svar fra:{" "}
          {outgoingPending.map((o) => (
            <span key={o.authorUid} className="person-ref-pending-chip">
              {outgoingLabels[o.authorUid] || "…"}
              <button
                type="button"
                className="person-ref-pending-cancel"
                title="Trekk tilbake forespørsel"
                onClick={() => handleCancelOutgoing(o.authorUid)}
                disabled={requestBusy === o.authorUid}
              >
                ×
              </button>
            </span>
          ))}
        </p>
      ) : null}

      {published.length === 0 ? (
        isOwnProfile ? (
          <p className="person-ref-empty">
            Ingen publiserte referanser ennå. Når en venn skriver om deg, vises
            den her for alle som ser CV-en din.
          </p>
        ) : null
      ) : (
        <ul className="person-ref-grid" role="list">
          {published.map((p) => {
            const m = authorMeta[p.authorUid] || {
              name: "…",
              photo: "",
            };
            const initial = m.name.charAt(0).toUpperCase();
            return (
              <li key={p.id} className="person-ref-cell">
                <button
                  type="button"
                  className="person-ref-bubble-hit"
                  onClick={() => setDetail({ ...p, displayName: m.name, photo: m.photo })}
                  aria-label={`Les referanse fra ${m.name}`}
                >
                  <span className="person-ref-avatar-ring">
                    {m.photo ? (
                      <img src={m.photo} alt="" className="person-ref-avatar" />
                    ) : (
                      <span className="person-ref-avatar-fallback" aria-hidden>
                        {initial}
                      </span>
                    )}
                  </span>
                  <span className="person-ref-speech" aria-hidden>
                    <span className="person-ref-speech-inner">
                      {excerpt(p.body, 42)}
                    </span>
                  </span>
                  <span className="person-ref-name">{m.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <div
          className="person-ref-modal-overlay"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="person-ref-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-ref-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="person-ref-modal-title" className="person-ref-modal-title">
              Referanse fra {detail.displayName}
            </h3>
            <div className="person-ref-modal-author">
              {detail.photo ? (
                <img src={detail.photo} alt="" className="person-ref-modal-avatar" />
              ) : (
                <span className="person-ref-modal-avatar-fallback">
                  {detail.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <blockquote className="person-ref-modal-body">{detail.body}</blockquote>
            <div className="person-ref-modal-actions">
              {canRemoveInDetail ? (
                <button
                  type="button"
                  className="person-ref-modal-remove"
                  onClick={() =>
                    setRemoveTarget({ authorUid: detail.authorUid })
                  }
                >
                  Fjern referanse
                </button>
              ) : null}
              <button
                type="button"
                className="person-ref-modal-close"
                onClick={() => setDetail(null)}
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestOpen ? (
        <div
          className="person-ref-modal-overlay"
          role="presentation"
          onClick={() => !friendsLoading && setRequestOpen(false)}
        >
          <div
            className="person-ref-modal person-ref-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-ref-req-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="person-ref-req-title" className="person-ref-modal-title">
              Velg venn
            </h3>
            <p className="person-ref-req-hint">
              Vi sender en forespørsel. Vennen svarer under{" "}
              <Link to="/dashboard/user#incoming-references" onClick={() => setRequestOpen(false)}>
                Min side → Referanser å skrive
              </Link>
              .
            </p>
            {friendsLoading ? (
              <p className="person-ref-muted">Laster…</p>
            ) : friends.length === 0 ? (
              <p className="person-ref-muted">
                Du har ingen venner å be ennå.{" "}
                <Link to="/dashboard/user?tab=network" onClick={() => setRequestOpen(false)}>
                  Nettverk
                </Link>
              </p>
            ) : (
              <ul className="person-ref-friend-list">
                {friends.map((f) => {
                  const disabled =
                    f.refStatus === "pending" || f.refStatus === "published";
                  return (
                    <li key={f.uid} className="person-ref-friend-row">
                      <span className="person-ref-friend-who">
                        {f.photoUrl ? (
                          <img src={f.photoUrl} alt="" className="person-ref-friend-av" />
                        ) : (
                          <span className="person-ref-friend-av-fallback">
                            {(f.label || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{f.label || "Venn"}</span>
                      </span>
                      <span className="person-ref-friend-actions">
                        {f.refStatus === "pending" ? (
                          <>
                            <span className="person-ref-badge">Venter</span>
                            <button
                              type="button"
                              className="person-ref-linkish"
                              onClick={() => handleCancelOutgoing(f.uid)}
                              disabled={requestBusy === f.uid}
                            >
                              Trekk tilbake
                            </button>
                          </>
                        ) : f.refStatus === "published" ? (
                          <span className="person-ref-badge person-ref-badge--ok">
                            Har skrevet
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="person-ref-send-req"
                            onClick={() => handleAskFriend(f.uid)}
                            disabled={requestBusy === f.uid}
                          >
                            Send forespørsel
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              className="person-ref-modal-close person-ref-modal-close--block"
              onClick={() => setRequestOpen(false)}
            >
              Lukk
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(removeTarget)}
        onClose={() => !removeBusy && setRemoveTarget(null)}
        title="Fjerne referanse?"
        confirmLabel="Ja, fjern"
        cancelLabel="Avbryt"
        variant="danger"
        confirmBusy={removeBusy}
        onConfirm={runRemovePublished}
      >
        <p className="confirm-modal-body-tail">
          Referansen vises ikke lenger på CV-en. Du kan be om ny referanse fra
          samme person senere.
        </p>
      </ConfirmModal>
    </section>
  );
}
