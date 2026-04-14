// Flytende snakkeboble + kompakt chat (full side: /meldinger)

import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { useChatSession } from "../hooks/useChatSession";
import { ensureConversation, otherParticipant } from "../services/chat";
import { formatChatMessageTime, chatMessageDateTimeIso } from "../utils/chatMessageTime";
import { db } from "../firebase";
import {
  listFriendUidsPreview,
  fetchUserLabelsForIds,
  fetchParticipantAvatarUrl,
} from "../services/social";
import "../styles/ChatDock.css";

function ChatDock() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser, userData, loading } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [widePanel, setWidePanel] = useState(false);
  const [friendHints, setFriendHints] = useState([]);
  const [friendHintsLoading, setFriendHintsLoading] = useState(false);
  const [friendOpeningUid, setFriendOpeningUid] = useState(null);
  const [convAvatarByUid, setConvAvatarByUid] = useState({});
  const [convSearch, setConvSearch] = useState("");

  const session = useChatSession({
    mode: "dock",
    enabled: true,
    routeConversationId: null,
    withUidParam: null,
    navigate,
    setSearchParams: () => {},
    toast,
  });

  const {
    userData: sessionUserData,
    myUid,
    convListError,
    messagesError,
    convList,
    messages,
    labels,
    otherUserType,
    draft,
    setDraft,
    sending,
    resolving,
    blocking,
    bottomRef,
    activeId,
    activeOther,
    activeTitleLabel,
    selectConversation,
    handleSend,
    handleBlock,
  } = session;

  const filteredConvList = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return convList;
    return convList.filter((c) => {
      const other = otherParticipant(c.participants, myUid);
      const label = (other && labels[other]) || "";
      return label.toLowerCase().includes(q);
    });
  }, [convList, convSearch, labels, myUid]);

  const filteredFriendHints = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return friendHints;
    return friendHints.filter(({ label }) => (label || "").toLowerCase().includes(q));
  }, [friendHints, convSearch]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) setConvSearch("");
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen || !myUid || convList.length > 0) {
      setFriendHints([]);
      setFriendHintsLoading(false);
      return undefined;
    }
    if (userData?.userType !== "jobseeker") return undefined;
    let cancelled = false;
    setFriendHintsLoading(true);
    (async () => {
      try {
        const uids = await listFriendUidsPreview(db, myUid, 8);
        if (cancelled || !uids.length) {
          if (!cancelled) setFriendHints([]);
          return;
        }
        const rows = await fetchUserLabelsForIds(db, uids);
        if (!cancelled) setFriendHints(rows);
      } catch {
        if (!cancelled) setFriendHints([]);
      } finally {
        if (!cancelled) setFriendHintsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, myUid, convList.length, userData?.userType]);

  useEffect(() => {
    if (!myUid) {
      setConvAvatarByUid({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const uids = new Set();
      for (const c of convList) {
        const other = otherParticipant(c.participants, myUid);
        if (other) uids.add(other);
      }
      if (activeOther) uids.add(activeOther);
      for (const { uid } of friendHints) {
        if (uid) uids.add(uid);
      }
      const next = {};
      for (const uid of uids) {
        if (cancelled) return;
        try {
          next[uid] = (await fetchParticipantAvatarUrl(db, uid)) || "";
        } catch {
          next[uid] = "";
        }
      }
      if (!cancelled) setConvAvatarByUid((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [myUid, convList, activeOther, friendHints]);

  async function openFriendChatInDock(friendUid) {
    if (!myUid || !friendUid) return;
    setFriendOpeningUid(friendUid);
    try {
      const id = await ensureConversation(db, myUid, friendUid);
      selectConversation(id);
    } catch (e) {
      toast.error(e?.message || "Kunne ikke åpne samtale.");
    } finally {
      setFriendOpeningUid(null);
    }
  }

  if (loading || !currentUser || !userData || !sessionUserData) {
    return null;
  }

  const fullChatHref = activeId ? `/meldinger/${activeId}` : "/meldinger";

  return (
    <div className="chat-dock-root">
      {panelOpen ? (
        <div
          className={`chat-dock-panel${widePanel ? " chat-dock-panel--wide" : ""}`}
          id="chat-dock-panel"
          role="dialog"
          aria-label="Meldinger"
        >
          <div className="chat-dock-panel-header">
            <h2 className="chat-dock-panel-title">Meldinger</h2>
            <div className="chat-dock-panel-tools">
              <button
                type="button"
                className={`chat-dock-tool${widePanel ? " is-on" : ""}`}
                onClick={() => setWidePanel((w) => !w)}
                title={widePanel ? "Mindre vindu" : "Større vindu"}
                aria-pressed={widePanel}
              >
                {widePanel ? "Mindre" : "Større"}
              </button>
              <Link
                to={fullChatHref}
                className="chat-dock-tool chat-dock-tool--link"
                onClick={() => setPanelOpen(false)}
              >
                Full skjerm
              </Link>
              <button
                type="button"
                className="chat-dock-close"
                onClick={() => setPanelOpen(false)}
                aria-label="Lukk"
              >
                ×
              </button>
            </div>
          </div>

          {resolving ? <p className="chat-dock-hint">…</p> : null}

          <div className="chat-dock-body">
            <aside className="chat-dock-sidebar" aria-label="Samtaler">
              {convListError ? (
                <div
                  className="chat-dock-firestore-error chat-dock-firestore-error--compact"
                  role="alert"
                >
                  <p>{convListError}</p>
                </div>
              ) : null}
              {convList.length > 0 || friendHints.length > 0 ? (
                <input
                  type="search"
                  className="chat-dock-search"
                  placeholder="Søk…"
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  autoComplete="off"
                  aria-label="Søk etter navn"
                />
              ) : null}
              {convList.length === 0 ? (
                <div className="chat-dock-empty-wrap">
                  {!convListError ? (
                    <p className="chat-dock-empty">Ingen samtaler ennå.</p>
                  ) : null}
                  {userData.userType === "jobseeker" && friendHintsLoading ? (
                    <p className="chat-dock-empty-sub">Laster forslag…</p>
                  ) : null}
                  {userData.userType === "jobseeker" && !friendHintsLoading && friendHints.length > 0 ? (
                    <>
                      <p className="chat-dock-empty-sub">Start med en venn:</p>
                      <ul className="chat-dock-friend-hints">
                        {filteredFriendHints.length === 0 ? (
                          <li className="chat-dock-friend-hint-empty">Ingen treff.</li>
                        ) : null}
                        {filteredFriendHints.map(({ uid, label }) => {
                          const photo = convAvatarByUid[uid];
                          const initial = (label || "?").charAt(0).toUpperCase();
                          return (
                            <li key={uid}>
                              <button
                                type="button"
                                className="chat-dock-friend-hint-btn"
                                disabled={friendOpeningUid === uid}
                                onClick={() => openFriendChatInDock(uid)}
                              >
                                <span className="chat-dock-friend-hint-avatar-wrap" aria-hidden>
                                  {photo ? (
                                    <img src={photo} alt="" className="chat-dock-friend-hint-avatar" />
                                  ) : (
                                    <span className="chat-dock-friend-hint-avatar-fallback">
                                      {initial}
                                    </span>
                                  )}
                                </span>
                                <span className="chat-dock-friend-hint-label">
                                  {friendOpeningUid === uid ? "…" : label}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}
                  {userData.userType === "jobseeker" &&
                  !friendHintsLoading &&
                  friendHints.length === 0 ? (
                    <p className="chat-dock-empty-sub">
                      Åpne en profil og velg «Send melding», eller legg til venner.
                    </p>
                  ) : null}
                  {userData.userType === "company" ? (
                    <p className="chat-dock-empty-sub">
                      Åpne en profil eller søknad og velg «Send melding».
                    </p>
                  ) : null}
                </div>
              ) : filteredConvList.length === 0 ? (
                <p className="chat-dock-empty chat-dock-empty--search">Ingen treff.</p>
              ) : (
                <ul className="chat-dock-conv-list">
                  {filteredConvList.map((c) => {
                    const other = otherParticipant(c.participants, myUid);
                    const label = other ? labels[other] || "…" : "Samtale";
                    const selected = c.id === activeId;
                    const photo = other ? convAvatarByUid[other] : "";
                    const initial = (label || "?").charAt(0).toUpperCase();
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`chat-dock-conv-item${selected ? " is-active" : ""}`}
                          onClick={() => selectConversation(c.id)}
                        >
                          <span className="chat-dock-conv-avatar-wrap" aria-hidden>
                            {photo ? (
                              <img src={photo} alt="" className="chat-dock-conv-avatar" />
                            ) : (
                              <span className="chat-dock-conv-avatar-fallback">{initial}</span>
                            )}
                          </span>
                          <span className="chat-dock-conv-text">
                            <span className="chat-dock-conv-name">{label}</span>
                            {c.lastPreview ? (
                              <span className="chat-dock-conv-preview">{c.lastPreview}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="chat-dock-thread" aria-label="Samtale">
              {!activeId ? (
                <div className="chat-dock-placeholder">
                  <p>Velg en samtale.</p>
                </div>
              ) : (
                <>
                  <div className="chat-dock-thread-head">
                    <div className="chat-dock-thread-title-block">
                      {activeOther ? (
                        <span className="chat-dock-thread-avatar-wrap" aria-hidden>
                          {convAvatarByUid[activeOther] ? (
                            <img
                              src={convAvatarByUid[activeOther]}
                              alt=""
                              className="chat-dock-thread-avatar"
                            />
                          ) : (
                            <span className="chat-dock-thread-avatar-fallback">
                              {(activeTitleLabel || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                      ) : null}
                      <span className="chat-dock-thread-title">{activeTitleLabel}</span>
                    </div>
                    <div className="chat-dock-thread-actions">
                      {otherUserType === "jobseeker" ? (
                        <Link to={`/profil/${activeOther}`} className="chat-dock-mini-link">
                          Profil
                        </Link>
                      ) : null}
                      {otherUserType === "company" ? (
                        <Link to={`/bedrift/${activeOther}`} className="chat-dock-mini-link">
                          Bedrift
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="chat-dock-mini-link chat-dock-mini-link--danger"
                        onClick={handleBlock}
                        disabled={blocking}
                      >
                        Blokkér
                      </button>
                    </div>
                  </div>
                  {messagesError ? (
                    <div
                      className="chat-dock-firestore-error chat-dock-firestore-error--compact"
                      role="alert"
                    >
                      <p>{messagesError}</p>
                    </div>
                  ) : null}
                  <div className="chat-dock-messages">
                    {messages.map((m) => {
                      const mine = m.senderId === myUid;
                      const timeLabel = formatChatMessageTime(m.createdAt);
                      const timeIso = chatMessageDateTimeIso(m.createdAt);
                      return (
                        <div
                          key={m.id}
                          className={`chat-dock-msg-bubble${mine ? " chat-dock-msg-bubble--mine" : ""}`}
                        >
                          <p>{m.text}</p>
                          {timeLabel ? (
                            <time
                              className="chat-dock-msg-meta"
                              dateTime={timeIso || undefined}
                            >
                              {timeLabel}
                            </time>
                          ) : null}
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <form className="chat-dock-compose" onSubmit={handleSend}>
                    <textarea
                      className="chat-dock-input"
                      rows={2}
                      placeholder="Skriv…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={4000}
                    />
                    <button
                      type="submit"
                      className="button primary chat-dock-send"
                      disabled={sending || !draft.trim()}
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="chat-dock-bubble"
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? "chat-dock-panel" : undefined}
        title={panelOpen ? "Lukk meldinger" : "Åpne meldinger"}
      >
        <span className="chat-dock-bubble-icon" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="chat-dock-bubble-label">Chat</span>
      </button>
    </div>
  );
}

/** Rendres kun utenfor /meldinger slik at vi ikke dobler Firestore-abonnementer. */
export default function ChatDockGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/meldinger")) return null;
  return <ChatDock />;
}
