/**
 * Direktemeldinger mellom brukere (jobbsøker ↔ jobbsøker som venner, jobbsøker ↔ bedrift).
 * Firestore: conversations/{pairKey}, messages under samme id.
 * Regler: firestore.rules (canChatParticipants, notBlockedPair).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { pairKey, areFriends } from "./social";
import { notifyChatMessage } from "./notifications";

/** @param {import('firebase/firestore').Firestore} db */
export async function fetchParticipantLabel(db, uid) {
  const u = await getDoc(doc(db, "users", uid));
  if (!u.exists()) return "Bruker";
  const d = u.data();
  if (d.userType === "company") {
    const cp = await getDoc(doc(db, "companyProfiles", uid));
    return cp.exists() ? cp.data().companyName?.trim() || "Bedrift" : "Bedrift";
  }
  const name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
  return name || "Bruker";
}

/**
 * Om den innloggede brukeren kan starte samtale med otherUid (speiler server-regler).
 */
export async function canInitiateChat(db, myUid, otherUid) {
  if (!myUid || !otherUid || myUid === otherUid) return false;
  const [meSnap, oSnap] = await Promise.all([
    getDoc(doc(db, "users", myUid)),
    getDoc(doc(db, "users", otherUid)),
  ]);
  if (!meSnap.exists() || !oSnap.exists()) return false;
  const mt = meSnap.data().userType;
  const ot = oSnap.data().userType;
  if (mt === "company" && ot === "jobseeker") return true;
  if (mt === "jobseeker" && ot === "company") return true;
  if (mt === "jobseeker" && ot === "jobseeker") return areFriends(db, myUid, otherUid);
  return false;
}

export async function isEitherBlocked(db, uidA, uidB) {
  const [b1, b2] = await Promise.all([
    getDoc(doc(db, "users", uidA, "blockedUsers", uidB)),
    getDoc(doc(db, "users", uidB, "blockedUsers", uidA)),
  ]);
  return b1.exists() || b2.exists();
}

/**
 * Oppretter conversations/{pairKey} om den ikke finnes (merge).
 * @returns {Promise<string>} conversation id (= pairKey)
 */
export async function ensureConversation(db, myUid, otherUid) {
  const ok = await canInitiateChat(db, myUid, otherUid);
  if (!ok) {
    throw new Error(
      "Du kan bare chatte med venner (jobbsøker) eller med bedrifter / jobbsøkere avhengig av konto.",
    );
  }
  if (await isEitherBlocked(db, myUid, otherUid)) {
    throw new Error("Samtalen er blokkert.");
  }
  const id = pairKey(myUid, otherUid);
  const [a, b] = [myUid, otherUid].sort();
  const convRef = doc(db, "conversations", id);
  const batch = writeBatch(db);
  batch.set(
    convRef,
    {
      participants: [a, b],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  const refBase = {
    participants: [a, b],
    updatedAt: serverTimestamp(),
    lastPreview: "",
    lastSenderId: "",
  };
  batch.set(doc(db, "users", a, "conversationRefs", id), { ...refBase, otherUid: b }, { merge: true });
  batch.set(doc(db, "users", b, "conversationRefs", id), { ...refBase, otherUid: a }, { merge: true });
  await batch.commit();
  return id;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} convId
 * @param {string} senderUid
 * @param {string} text
 */
export async function sendChatMessage(db, convId, senderUid, text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 4000) {
    throw new Error("Meldingen må være 1–4000 tegn.");
  }
  const convRef = doc(db, "conversations", convId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) throw new Error("Fant ikke samtalen.");
  const p = convSnap.data().participants;
  if (!Array.isArray(p) || !p.includes(senderUid)) {
    throw new Error("Ingen tilgang til samtalen.");
  }
  if (await isEitherBlocked(db, p[0], p[1])) {
    throw new Error("Samtalen er blokkert.");
  }
  const other = p[0] === senderUid ? p[1] : p[0];

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, "conversations", convId, "messages"));
  // Klient-tidsstempel på meldingen: orderBy('createdAt') viser ikke ventende
  // serverTimestamp()-felt riktig, så meldingen kan «forsvinne» fra spørringen til server svarer.
  batch.set(msgRef, {
    senderId: senderUid,
    text: trimmed,
    createdAt: Timestamp.now(),
  });
  batch.set(
    convRef,
    {
      lastMessageAt: serverTimestamp(),
      lastPreview: trimmed.slice(0, 120),
      lastSenderId: senderUid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  const refUpdate = {
    participants: p,
    updatedAt: serverTimestamp(),
    lastPreview: trimmed.slice(0, 120),
    lastSenderId: senderUid,
  };
  batch.set(doc(db, "users", p[0], "conversationRefs", convId), { ...refUpdate, otherUid: p[1] }, { merge: true });
  batch.set(doc(db, "users", p[1], "conversationRefs", convId), { ...refUpdate, otherUid: p[0] }, { merge: true });
  await batch.commit();

  try {
    await notifyChatMessage(db, other, senderUid, convId);
  } catch (e) {
    console.warn("notifyChatMessage", e);
  }
  return msgRef.id;
}

/**
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
/** Sorter samtaler: sist oppdatert / siste melding øverst (sikrer rekkefølge selv om felt mangler). */
export function sortConversationsByRecency(rows) {
  function recencyMs(c) {
    const u = c.updatedAt;
    const l = c.lastMessageAt;
    if (u?.toMillis) return u.toMillis();
    if (u?.seconds != null) return u.seconds * 1000;
    if (l?.toMillis) return l.toMillis();
    if (l?.seconds != null) return l.seconds * 1000;
    return 0;
  }
  return [...rows].sort((a, b) => recencyMs(b) - recencyMs(a));
}

/**
 * Gammel data uten inbox-rad: lag users/{uid}/conversationRefs ved åpnet tråd.
 */
export async function syncConversationRefsFromConversation(db, convId) {
  const convRef = doc(db, "conversations", convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;
  const d = snap.data();
  const p = d.participants;
  if (!Array.isArray(p) || p.length !== 2) return;
  const batch = writeBatch(db);
  const upd = {
    participants: p,
    updatedAt: d.updatedAt ?? d.lastMessageAt ?? serverTimestamp(),
    lastPreview: d.lastPreview ?? "",
    lastSenderId: d.lastSenderId ?? "",
  };
  batch.set(doc(db, "users", p[0], "conversationRefs", convId), { ...upd, otherUid: p[1] }, { merge: true });
  batch.set(doc(db, "users", p[1], "conversationRefs", convId), { ...upd, otherUid: p[0] }, { merge: true });
  try {
    await batch.commit();
  } catch (e) {
    console.warn("syncConversationRefsFromConversation", e);
  }
}

/** Eldre samtaler uten inbox-rad: direkte på conversations (kan feile i regler hos noen). */
async function fetchLegacyConversationsFallback(db, uid) {
  const legacyQ = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    limit(100),
  );
  const leg = await getDocs(legacyQ);
  return sortConversationsByRecency(
    leg.docs.map((d) => ({ id: d.id, ...d.data() })),
  );
}

/** Engangshenting (seed ved ny mount / etter navigasjon) før onSnapshot rekker. */
export async function fetchConversationsOnce(db, uid) {
  const q = query(
    collection(db, "users", uid, "conversationRefs"),
    orderBy("updatedAt", "desc"),
    limit(100),
  );
  const snap = await getDocs(q);
  let rows = sortConversationsByRecency(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  );
  if (rows.length === 0) {
    try {
      rows = await fetchLegacyConversationsFallback(db, uid);
      for (const r of rows) {
        syncConversationRefsFromConversation(db, r.id).catch(() => {});
      }
    } catch (e) {
      console.warn("fetchConversationsOnce legacy fallback", e);
    }
  }
  return rows;
}

export function subscribeToConversations(db, uid, callback, onError) {
  const q = query(
    collection(db, "users", uid, "conversationRefs"),
    orderBy("updatedAt", "desc"),
    limit(100),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = sortConversationsByRecency(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
      if (rows.length > 0) {
        callback(rows);
        return;
      }
      fetchLegacyConversationsFallback(db, uid)
        .then((legacy) => {
          for (const r of legacy) {
            syncConversationRefsFromConversation(db, r.id).catch(() => {});
          }
          callback(legacy);
        })
        .catch(() => {
          callback(rows);
        });
    },
    (err) => {
      console.warn("subscribeToConversations", err);
      if (typeof onError === "function") onError(err);
    },
  );
}

/**
 * @returns {() => void}
 */
/**
 * @param {(err: Error) => void} [onError]
 */
function sortMessageRows(rows) {
  return [...rows].sort((a, b) => {
    const ta =
      a.createdAt?.toMillis?.() ??
      (a.createdAt?.seconds != null ? a.createdAt.seconds * 1000 : 0);
    const tb =
      b.createdAt?.toMillis?.() ??
      (b.createdAt?.seconds != null ? b.createdAt.seconds * 1000 : 0);
    return ta - tb;
  });
}

/** Engangshenting av meldinger (seed) – samme sortering som abonnementet. */
export async function fetchMessagesOnce(db, convId) {
  await syncConversationRefsFromConversation(db, convId);
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortMessageRows(rows);
}

export function subscribeToMessages(db, convId, callback, onError) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(sortMessageRows(rows));
    },
    (err) => {
      console.error("subscribeToMessages", err);
      if (typeof onError === "function") onError(err);
    },
  );
}

export async function blockUser(db, myUid, blockedUid) {
  if (!myUid || !blockedUid || myUid === blockedUid) return;
  await setDoc(doc(db, "users", myUid, "blockedUsers", blockedUid), {
    blockedAt: serverTimestamp(),
  });
}

export async function unblockUser(db, myUid, blockedUid) {
  if (!myUid || !blockedUid) return;
  await deleteDoc(doc(db, "users", myUid, "blockedUsers", blockedUid));
}

/** @returns {Promise<Array<{ id: string, blockedAt: unknown }>>} */
export async function listBlockedUsers(db, myUid) {
  if (!myUid) return [];
  const snap = await getDocs(collection(db, "users", myUid, "blockedUsers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function otherParticipant(participants, myUid) {
  if (!Array.isArray(participants) || participants.length !== 2) return null;
  return participants[0] === myUid ? participants[1] : participants[0];
}
