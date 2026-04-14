import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteAllNotifications,
} from "../services/notifications";
import { fetchProfilePhotoUrl, fetchCompanyLogoUrl } from "../services/social";
import { useToast } from "./Toast";
import ConfirmModal from "./ConfirmModal";
import "../styles/ConfirmModal.css";

function notificationHref(n) {
  if (n.type === "application_update") {
    return "/dashboard/user?tab=applications";
  }
  if (n.type === "reference_request") {
    return "/dashboard/user#incoming-references";
  }
  if (n.type === "company_follow_company") {
    return `/bedrift/${n.actorId}`;
  }
  return `/profil/${n.actorId}`;
}

const PREVIEW_LIMIT = 15;

function notificationText(n) {
  const name = n.actorLabel || "Noen";
  switch (n.type) {
    case "company_follow":
      return `${name} følger nå bedriften din.`;
    case "company_follow_company":
      return `${name} følger bedriften din.`;
    case "friend_request":
      return `${name} sendte en venneforespørsel.`;
    case "friend_accepted":
      return `${name} godtok – dere er venner.`;
    case "reference_request":
      return `${name} ber om skriftlig referanse (venner).`;
    case "application_update": {
      const job = n.jobTitle ? ` · ${n.jobTitle}` : "";
      return `${n.previewText || "Søknad oppdatert"}${job} (${name})`;
    }
    default:
      return "Ny aktivitet.";
  }
}

export default function NavbarNotifications() {
  const { currentUser } = useAuth();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarByActor, setAvatarByActor] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setItems([]);
      setUnreadCount(0);
      return undefined;
    }
    const unsub = subscribeToNotifications(db, currentUser.uid, (list, unread) => {
      setItems(list);
      setUnreadCount(unread);
    });
    return unsub;
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    async function loadAvatars() {
      if (!items.length) {
        setAvatarByActor({});
        return;
      }
      const seen = new Set();
      const next = {};
      for (const n of items) {
        if (!n.actorId || seen.has(n.actorId)) continue;
        seen.add(n.actorId);
        try {
          if (n.type === "company_follow_company" || n.type === "application_update") {
            next[n.actorId] = (await fetchCompanyLogoUrl(db, n.actorId)) || "";
          } else {
            next[n.actorId] = (await fetchProfilePhotoUrl(db, n.actorId)) || "";
          }
        } catch {
          next[n.actorId] = "";
        }
        if (cancelled) return;
      }
      if (!cancelled) setAvatarByActor(next);
    }
    loadAvatars();
    return () => {
      cancelled = true;
    };
  }, [items]);

  async function handleOpenItem(notificationId) {
    if (!currentUser?.uid) return;
    try {
      await markNotificationRead(db, currentUser.uid, notificationId);
    } catch (e) {
      console.warn(e);
    }
    setOpen(false);
  }

  async function handleMarkAll() {
    if (!currentUser?.uid || items.length === 0) return;
    try {
      await markAllNotificationsRead(db, currentUser.uid, items);
    } catch (e) {
      console.warn(e);
      toastError("Kunne ikke oppdatere varsler.");
    }
  }

  async function runClearAll() {
    if (!currentUser?.uid || items.length === 0) return;
    setClearing(true);
    try {
      await deleteAllNotifications(db, currentUser.uid, items);
      setClearModalOpen(false);
      success("Varslene er fjernet");
    } catch (e) {
      console.warn(e);
      toastError(
        "Kunne ikke tømme varsler. Sjekk at Firestore-reglene er publisert (sletting tillatt for din konto).",
      );
      setClearModalOpen(false);
    } finally {
      setClearing(false);
    }
  }

  if (!currentUser) return null;

  const showList = expanded ? items : items.slice(0, PREVIEW_LIMIT);
  const olderCount = Math.max(0, items.length - PREVIEW_LIMIT);

  return (
    <div className="navbar-notifications" ref={wrapRef}>
      <button
        type="button"
        className="navbar-bell"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Varsler, ${unreadCount} uleste` : "Varsler"}
      >
        <span className="navbar-bell-icon" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        {unreadCount > 0 ? (
          <span className="navbar-bell-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="navbar-notifications-dropdown" role="dialog" aria-label="Varsler">
          <div className="navbar-notifications-header">
            <span className="navbar-notifications-title">Varsler</span>
            <div className="navbar-notifications-header-actions">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="navbar-notifications-markall"
                  onClick={handleMarkAll}
                >
                  Merk alle lest
                </button>
              ) : null}
              {items.length > 0 ? (
                <button
                  type="button"
                  className="navbar-notifications-clearall"
                  onClick={() => setClearModalOpen(true)}
                >
                  Tøm liste
                </button>
              ) : null}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="navbar-notifications-empty">Ingen varsler ennå.</p>
          ) : (
            <>
              <ul
                className={`navbar-notifications-list${expanded ? " navbar-notifications-list--scrollable" : ""}`}
              >
                {showList.map((n) => {
                  const photo = avatarByActor[n.actorId];
                  const initial = (n.actorLabel || "?").charAt(0).toUpperCase();
                  return (
                    <li key={n.id}>
                      <Link
                        to={notificationHref(n)}
                        className={`navbar-notifications-item${n.read ? "" : " is-unread"}`}
                        onClick={() => handleOpenItem(n.id)}
                      >
                        <span className="navbar-notifications-avatar-wrap">
                          {photo ? (
                            <img src={photo} alt="" className="navbar-notifications-avatar" />
                          ) : (
                            <span className="navbar-notifications-avatar-fallback" aria-hidden>
                              {initial}
                            </span>
                          )}
                        </span>
                        <span className="navbar-notifications-text">{notificationText(n)}</span>
                        <span className="navbar-notifications-chevron" aria-hidden>
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {olderCount > 0 ? (
                <div className="navbar-notifications-more-wrap">
                  {!expanded ? (
                    <button
                      type="button"
                      className="navbar-notifications-more"
                      onClick={() => setExpanded(true)}
                    >
                      Se tidligere varsler ({olderCount})
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="navbar-notifications-more navbar-notifications-more--collapse"
                      onClick={() => setExpanded(false)}
                    >
                      Vis færre
                    </button>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={clearModalOpen}
        onClose={() => !clearing && setClearModalOpen(false)}
        title="Tømme varsler?"
        confirmLabel="Ja, fjern alle"
        cancelLabel="Avbryt"
        variant="danger"
        confirmBusy={clearing}
        onConfirm={runClearAll}
      >
        <p className="confirm-modal-body-tail">
          Alle varsler i listen slettes permanent. Nye varsler kan fortsatt komme
          senere.
        </p>
      </ConfirmModal>
    </div>
  );
}
