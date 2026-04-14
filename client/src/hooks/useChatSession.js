/**
 * Delt tilstand for meldinger (full side / flytende dock).
 * @param {boolean} [opts.enabled=true] – når false, ingen Firestore-lyttere (unngå dobbelt med full side).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  ensureConversation,
  fetchConversationsOnce,
  fetchMessagesOnce,
  subscribeToConversations,
  subscribeToMessages,
  sendChatMessage,
  fetchParticipantLabel,
  otherParticipant,
  blockUser,
} from "../services/chat";

function isFirestorePermissionDenied(e) {
  const c = e?.code;
  if (c === "permission-denied") return true;
  return typeof c === "string" && c.includes("permission-denied");
}

/**
 * Collection-liste kan få permission-denied selv når lesing av én samtale og
 * meldinger fungerer. Ikke vis «deploy firestore:rules» da det ofte er misvisende.
 */
function applyConvListFetchFailure(e, setConvList, setConvListError) {
  if (e?.code === "failed-precondition") {
    setConvListError(
      "Firestore-indeks mangler eller bygger fortsatt: kjør firebase deploy --only firestore:indexes og vent noen minutter.",
    );
    return;
  }
  if (isFirestorePermissionDenied(e)) {
    setConvList([]);
    setConvListError(null);
    console.warn(
      "[chat] Samtaleliste-spørring avvist (permission). Meldinger og åpne samtaler kan fortsatt fungere.",
      e?.code,
    );
    return;
  }
  setConvListError(
    e?.message || "Kunne ikke laste samtaler (sjekk nettverk og tilgang).",
  );
}

/**
 * @param {object} opts
 * @param {'page'|'dock'} opts.mode
 * @param {boolean} [opts.enabled]
 * @param {string|null|undefined} opts.routeConversationId
 * @param {string|null} opts.withUidParam
 * @param {function} opts.navigate
 * @param {function} opts.setSearchParams
 * @param {{ error: function, success: function }} opts.toast
 */
export function useChatSession({
  mode,
  enabled = true,
  routeConversationId,
  withUidParam,
  navigate,
  setSearchParams,
  toast,
}) {
  const { currentUser, userData, loading: authLoading } = useAuth();
  const myUid = currentUser?.uid;
  const [convList, setConvList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [labels, setLabels] = useState({});
  const [otherUserType, setOtherUserType] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [localActiveId, setLocalActiveId] = useState(null);
  const [convListError, setConvListError] = useState(null);
  const [messagesError, setMessagesError] = useState(null);
  /** Når aktiv samtale ikke finnes i listen ennå (f.eks. race), hentes participants fra Firestore. */
  const [participantsFallback, setParticipantsFallback] = useState(null);
  const bottomRef = useRef(null);

  const activeId =
    mode === "page" ? routeConversationId || null : localActiveId;

  const activeParticipants =
    convList.find((c) => c.id === activeId)?.participants ||
    participantsFallback;

  const activeOther =
    activeId && activeParticipants
      ? otherParticipant(activeParticipants, myUid)
      : null;

  const activeTitleLabel =
    activeOther && labels[activeOther] ? labels[activeOther] : "Samtale";

  useEffect(() => {
    if (!enabled || !activeId || !myUid) {
      setParticipantsFallback(null);
      return undefined;
    }
    const row = convList.find((c) => c.id === activeId);
    if (row?.participants?.length === 2) {
      setParticipantsFallback(null);
      return undefined;
    }
    setParticipantsFallback(null);
    let cancelled = false;
    getDoc(doc(db, "conversations", activeId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const p = snap.data().participants;
      if (Array.isArray(p) && p.length === 2) {
        setParticipantsFallback(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, activeId, myUid, convList]);

  const selectConversation = useCallback(
    (id) => {
      if (mode === "page") {
        navigate(`/meldinger/${id}`);
      } else {
        setLocalActiveId(id);
      }
    },
    [mode, navigate],
  );

  useEffect(() => {
    if (mode !== "page" || !withUidParam || !myUid || !enabled) return undefined;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const id = await ensureConversation(db, myUid, withUidParam);
        if (cancelled) return;
        setSearchParams({}, { replace: true });
        navigate(`/meldinger/${id}`, { replace: true });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error(e?.message || "Kunne ikke åpne samtale.");
          setSearchParams({}, { replace: true });
          navigate("/meldinger", { replace: true });
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, withUidParam, myUid, navigate, setSearchParams, toast, enabled]);

  useEffect(() => {
    if (!enabled || !myUid) {
      setConvListError(null);
      return undefined;
    }
    if (authLoading) {
      setConvListError(null);
      return undefined;
    }
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      try {
        await auth.authStateReady();
      } catch {
        /* */
      }
      if (cancelled) return;
      try {
        if (auth.currentUser) await auth.currentUser.getIdToken(true);
      } catch {
        /* */
      }
      if (cancelled) return;
      let fetchOk = false;
      try {
        const rows = await fetchConversationsOnce(db, myUid);
        if (!cancelled) {
          setConvList(rows);
          setConvListError(null);
          fetchOk = true;
        }
      } catch (e) {
        if (!cancelled && isFirestorePermissionDenied(e) && auth.currentUser) {
          try {
            await auth.currentUser.getIdToken(true);
            const rows = await fetchConversationsOnce(db, myUid);
            if (!cancelled) {
              setConvList(rows);
              setConvListError(null);
              fetchOk = true;
            }
          } catch (e2) {
            console.warn("fetchConversationsOnce (retry)", e2);
            if (!cancelled) {
              applyConvListFetchFailure(e2, setConvList, setConvListError);
            }
          }
        } else if (!cancelled) {
          console.warn("fetchConversationsOnce", e?.code, e?.message, e);
          applyConvListFetchFailure(e, setConvList, setConvListError);
        }
      }
      if (cancelled || !fetchOk) return;
      unsub = subscribeToConversations(
        db,
        myUid,
        (rows) => {
          setConvList(rows);
          setConvListError(null);
        },
        (err) => {
          // Ikke sett convListError her: engangshenting over lyktes allerede (fetchOk).
          // onSnapshot kan feile (f.eks. midlertidig regel/token) uten at listevisning er ugyldig.
          // Sanntidsoppdatering er «best effort»; brukeren ser fortsatt data fra getDocs.
          console.warn(
            "subscribeToConversations (sanntid feilet, listen er fra siste vellykkede henting)",
            err?.code,
            err?.message,
          );
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [myUid, enabled, authLoading]);

  useEffect(() => {
    if (!enabled || !activeId) {
      setMessages([]);
      setMessagesError(null);
      return undefined;
    }
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      try {
        if (auth.currentUser) await auth.currentUser.getIdToken();
      } catch {
        /* */
      }
      if (cancelled) return;
      let messagesFetchOk = false;
      try {
        const rows = await fetchMessagesOnce(db, activeId);
        if (!cancelled) {
          setMessages(rows);
          setMessagesError(null);
          messagesFetchOk = true;
        }
      } catch (e) {
        console.warn("fetchMessagesOnce", e);
        if (!cancelled) {
          setMessagesError(e?.message || "Kunne ikke laste meldinger.");
        }
      }
      if (cancelled || !messagesFetchOk) return;
      unsub = subscribeToMessages(
        db,
        activeId,
        (m) => {
          setMessages(m);
          setMessagesError(null);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
        },
        (err) => {
          // Ikke sett messagesError: getDocs lyktes allerede; sanntid er best effort.
          console.warn(
            "subscribeToMessages (sanntid feilet, tråden er fra siste vellykkede henting)",
            err?.code,
            err?.message,
          );
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeId, enabled]);

  useEffect(() => {
    if (!enabled || !myUid) return undefined;
    let cancelled = false;
    (async () => {
      const ids = new Set(
        convList
          .map((c) => otherParticipant(c.participants, myUid))
          .filter(Boolean),
      );
      if (activeOther) ids.add(activeOther);
      for (const oid of ids) {
        if (cancelled) return;
        let name = "Bruker";
        try {
          name = await fetchParticipantLabel(db, oid);
        } catch {
          /* */
        }
        if (cancelled) return;
        setLabels((prev) => (prev[oid] ? prev : { ...prev, [oid]: name }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUid, convList, enabled, activeOther]);

  useEffect(() => {
    if (!enabled || !activeOther) {
      setOtherUserType(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "users", activeOther)).then((snap) => {
      if (!cancelled && snap.exists()) setOtherUserType(snap.data().userType || null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeOther, enabled]);

  async function handleSend(e) {
    e.preventDefault();
    if (!activeId || !myUid || !draft.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(db, activeId, myUid, draft);
      setDraft("");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Kunne ikke sende melding.");
    } finally {
      setSending(false);
    }
  }

  async function handleBlock() {
    if (!activeId || !myUid || !activeOther) return;
    const other = activeOther;
    if (
      !window.confirm(
        "Blokkere denne brukeren? Dere kan ikke sende nye meldinger.",
      )
    ) {
      return;
    }
    setBlocking(true);
    try {
      await blockUser(db, myUid, other);
      toast.success("Bruker er blokkert.");
      if (mode === "page") {
        navigate("/meldinger", { replace: true });
      } else {
        setLocalActiveId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke blokkere.");
    } finally {
      setBlocking(false);
    }
  }

  return {
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
  };
}
