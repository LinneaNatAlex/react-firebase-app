// Direktemeldinger – jobbsøker ↔ venn / bedrift (se services/chat.js og firestore.rules)

import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useChatSession } from "../hooks/useChatSession";
import { useToast } from "../components/Toast";
import { otherParticipant } from "../services/chat";
import { db } from "../firebase";
import { fetchParticipantAvatarUrl } from "../services/social";
import { formatChatMessageTime, chatMessageDateTimeIso } from "../utils/chatMessageTime";
import "../styles/ChatPage.css";

function ChatPage() {
  const { conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const withUid = searchParams.get("with");

  const {
    userData,
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
  } = useChatSession({
    mode: "page",
    enabled: true,
    routeConversationId: conversationId,
    withUidParam: withUid,
    navigate,
    setSearchParams,
    toast,
  });

  const [convAvatarByUid, setConvAvatarByUid] = useState({});
  const [convSearch, setConvSearch] = useState("");

  const filteredConvList = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return convList;
    return convList.filter((c) => {
      const other = otherParticipant(c.participants, myUid);
      const label = (other && labels[other]) || "";
      return label.toLowerCase().includes(q);
    });
  }, [convList, convSearch, labels, myUid]);

  useEffect(() => {
    if (!myUid) {
      setConvAvatarByUid({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const uids = new Set();
      for (const c of convList) {
        const o = otherParticipant(c.participants, myUid);
        if (o) uids.add(o);
      }
      if (activeOther) uids.add(activeOther);
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
  }, [myUid, convList, activeOther]);

  if (!userData) {
    return (
      <div className="chat-page chat-page--loading">
        <p>Laster…</p>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-page-topbar">
        <div className="chat-page-topbar-inner">
          <Link to="/" className="chat-page-back">
            ← Til forsiden
          </Link>
          {userData.userType === "company" ? (
            <Link to="/dashboard/company" className="chat-page-back">
              Dashboard
            </Link>
          ) : (
            <Link to="/dashboard/user" className="chat-page-back">
              Min side
            </Link>
          )}
        </div>
        <h1 className="chat-page-title">Meldinger</h1>
        <p className="chat-page-sub">
          Chat med venner (jobbsøker) eller med bedrifter / jobbsøkere. Du kan blokkere i en samtale.
        </p>
      </header>

      {(resolving || blocking) && <p className="chat-page-hint">…</p>}

      <div className="chat-layout">
        <aside className="chat-sidebar" aria-label="Samtaler">
          {convListError ? (
            <div
              className="chat-page-firestore-error chat-page-firestore-error--compact"
              role="alert"
            >
              <p>{convListError}</p>
            </div>
          ) : null}
          {convList.length === 0 ? (
            convListError ? null : (
            <p className="chat-empty">Ingen samtaler ennå. Åpne en profil og velg «Send melding».</p>
            )
          ) : (
            <>
              <input
                type="search"
                className="chat-sidebar-search"
                placeholder="Søk etter navn…"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                autoComplete="off"
                aria-label="Søk etter navn i samtaler"
              />
              {filteredConvList.length === 0 ? (
                <p className="chat-empty chat-empty--search">Ingen treff.</p>
              ) : (
            <ul className="chat-conv-list">
              {filteredConvList.map((c) => {
                const other = otherParticipant(c.participants, myUid);
                const label = other ? labels[other] || "…" : "Samtale";
                const selected = c.id === activeId;
                const photo = other ? convAvatarByUid[other] : "";
                const initial = (label || "?").charAt(0).toUpperCase();
                return (
                  <li key={c.id}>
                    <Link
                      className={`chat-conv-item${selected ? " is-active" : ""}`}
                      to={`/meldinger/${c.id}`}
                    >
                      <span className="chat-conv-avatar-wrap" aria-hidden>
                        {photo ? (
                          <img src={photo} alt="" className="chat-conv-avatar" />
                        ) : (
                          <span className="chat-conv-avatar-fallback">{initial}</span>
                        )}
                      </span>
                      <span className="chat-conv-text">
                        <span className="chat-conv-name">{label}</span>
                        {c.lastPreview ? (
                          <span className="chat-conv-preview">{c.lastPreview}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
              )}
            </>
          )}
        </aside>

        <section className="chat-main" aria-label="Aktiv samtale">
          {!activeId ? (
            <div className="chat-placeholder">
              <p>Velg en samtale til venstre, eller start fra en profil.</p>
            </div>
          ) : (
            <>
              <div className="chat-thread-header">
                <div className="chat-thread-title-row">
                  {activeOther ? (
                    <span className="chat-thread-avatar-wrap" aria-hidden>
                      {convAvatarByUid[activeOther] ? (
                        <img
                          src={convAvatarByUid[activeOther]}
                          alt=""
                          className="chat-thread-avatar"
                        />
                      ) : (
                        <span className="chat-thread-avatar-fallback">
                          {(activeTitleLabel || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                  ) : null}
                  <h2 className="chat-thread-title">{activeTitleLabel}</h2>
                </div>
                {activeOther ? (
                  <div className="chat-thread-actions">
                    {otherUserType === "jobseeker" ? (
                      <Link to={`/profil/${activeOther}`} className="button ghost small">
                        Profil
                      </Link>
                    ) : null}
                    {otherUserType === "company" ? (
                      <Link to={`/bedrift/${activeOther}`} className="button ghost small">
                        Bedriftsside
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="button ghost small chat-block-btn"
                      onClick={handleBlock}
                      disabled={blocking}
                    >
                      Blokkér
                    </button>
                  </div>
                ) : null}
              </div>

              {messagesError ? (
                <div
                  className="chat-page-firestore-error chat-page-firestore-error--compact"
                  role="alert"
                >
                  <p>{messagesError}</p>
                </div>
              ) : null}

              <div className="chat-messages">
                {messages.map((m) => {
                  const mine = m.senderId === myUid;
                  const timeLabel = formatChatMessageTime(m.createdAt);
                  const timeIso = chatMessageDateTimeIso(m.createdAt);
                  return (
                    <div
                      key={m.id}
                      className={`chat-bubble${mine ? " chat-bubble--mine" : ""}`}
                    >
                      <p className="chat-bubble-text">{m.text}</p>
                      {timeLabel ? (
                        <time
                          className="chat-bubble-meta"
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

              <form className="chat-compose" onSubmit={handleSend}>
                <textarea
                  className="chat-input"
                  rows={2}
                  placeholder="Skriv en melding…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                />
                <button type="submit" className="button primary" disabled={sending || !draft.trim()}>
                  {sending ? "Sender…" : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default ChatPage;
