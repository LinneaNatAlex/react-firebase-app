/**
 * Skriftlige referanser på CV: kun venner. Lagres under users/{subjectUid}/writtenReferences/{authorUid}
 * subject = den som vises på CV, author = venn som skriver.
 */

import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  where,
} from "firebase/firestore";
import { areFriends } from "./social";
import { notifyReferenceRequest } from "./notifications";

const MIN_BODY = 20;
const MAX_BODY = 4000;

export { MIN_BODY, MAX_BODY };

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} subjectUid
 * @param {(items: Array<{ id: string, authorUid: string } & object>) => void} callback
 */
export function subscribePublishedReferences(db, subjectUid, callback) {
  if (!subjectUid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, "users", subjectUid, "writtenReferences"),
    where("status", "==", "published"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        authorUid: d.id,
        ...d.data(),
      }));
      callback(items);
    },
    (err) => {
      console.warn("subscribePublishedReferences", err);
      callback([]);
    },
  );
}

/** Utestående forespørsler du har sendt (subject = deg). */
export function subscribeOutgoingReferenceRequests(db, subjectUid, callback) {
  if (!subjectUid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, "users", subjectUid, "writtenReferences"),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          authorUid: d.id,
          ...d.data(),
        })),
      );
    },
    (err) => {
      console.warn("subscribeOutgoingReferenceRequests", err);
      callback([]);
    },
  );
}

/**
 * Innkommende: du skal skrive om noen (author = deg).
 * Dokument: users/{subjectUid}/writtenReferences/{authorUid}
 *
 * Vi lytter på hver venns referanse-dokument for deg (én doc per venn), ikke collectionGroup.
 * Da unngår vi manglende sammensatt indeks og strengere regel-evaluering for group-queries.
 */
export function subscribeIncomingReferenceRequests(db, authorUid, callback) {
  if (!authorUid) {
    callback([]);
    return () => {};
  }

  /** @type {Map<string, import('firebase/firestore').DocumentData>} */
  const latestBySubject = new Map();
  /** @type {Map<string, () => void>} */
  const docUnsubs = new Map();

  function emit() {
    const items = [];
    for (const [subjectUid, data] of latestBySubject) {
      if (data?.status === "pending") {
        items.push({
          id: `${subjectUid}_${authorUid}`,
          authorUid,
          subjectUid,
          ...data,
        });
      }
    }
    callback(items);
  }

  function attachDocListener(subjectUid) {
    if (docUnsubs.has(subjectUid)) return;
    const ref = doc(db, "users", subjectUid, "writtenReferences", authorUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          latestBySubject.delete(subjectUid);
        } else {
          latestBySubject.set(subjectUid, snap.data());
        }
        emit();
      },
      (err) => {
        console.warn("subscribeIncomingReferenceRequests doc", subjectUid, err);
        latestBySubject.delete(subjectUid);
        emit();
      },
    );
    docUnsubs.set(subjectUid, unsub);
  }

  function detachDocListener(subjectUid) {
    const u = docUnsubs.get(subjectUid);
    if (u) u();
    docUnsubs.delete(subjectUid);
    latestBySubject.delete(subjectUid);
  }

  const friendsCol = collection(db, "users", authorUid, "friends");
  const friendsUnsub = onSnapshot(
    friendsCol,
    (friendsSnap) => {
      const currentFriends = new Set(friendsSnap.docs.map((d) => d.id));
      for (const sid of docUnsubs.keys()) {
        if (!currentFriends.has(sid)) detachDocListener(sid);
      }
      for (const sid of currentFriends) {
        attachDocListener(sid);
      }
    },
    (err) => {
      console.warn("subscribeIncomingReferenceRequests friends", err);
      for (const u of docUnsubs.values()) u();
      docUnsubs.clear();
      latestBySubject.clear();
      callback([]);
    },
  );

  return () => {
    friendsUnsub();
    for (const u of docUnsubs.values()) u();
    docUnsubs.clear();
    latestBySubject.clear();
  };
}

export async function sendReferenceRequest(db, subjectUid, authorUid) {
  if (!subjectUid || !authorUid || subjectUid === authorUid) {
    throw new Error("Ugyldig forespørsel");
  }
  if (!(await areFriends(db, subjectUid, authorUid))) {
    throw new Error("Dere må være venner for å be om referanse");
  }
  const ref = doc(db, "users", subjectUid, "writtenReferences", authorUid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const st = existing.data()?.status;
    if (st === "pending") throw new Error("Du har allerede bedt denne personen");
    if (st === "published") throw new Error("Denne personen har allerede skrevet en referanse");
  }
  await setDoc(ref, {
    subjectUid,
    authorUid,
    status: "pending",
    body: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await notifyReferenceRequest(db, authorUid, subjectUid);
  } catch (e) {
    console.warn("notifyReferenceRequest", e);
  }
}

export async function publishWrittenReference(db, subjectUid, authorUid, body) {
  const trimmed = String(body || "").trim();
  if (trimmed.length < MIN_BODY) {
    throw new Error(`Teksten må være minst ${MIN_BODY} tegn`);
  }
  if (trimmed.length > MAX_BODY) {
    throw new Error(`Teksten kan maks være ${MAX_BODY} tegn`);
  }
  await updateDoc(doc(db, "users", subjectUid, "writtenReferences", authorUid), {
    status: "published",
    body: trimmed,
    updatedAt: serverTimestamp(),
    publishedAt: serverTimestamp(),
  });
}

/** Avslå = slett forespørselen (kan be på nytt senere). */
export async function declineReferenceRequest(db, subjectUid, authorUid) {
  await deleteDoc(doc(db, "users", subjectUid, "writtenReferences", authorUid));
}

/** Trekk tilbake egen forespørsel (subject). */
export async function cancelReferenceRequest(db, subjectUid, authorUid) {
  await deleteDoc(doc(db, "users", subjectUid, "writtenReferences", authorUid));
}

/** Fjern publisert referanse fra CV (subject eller author). */
export async function removePublishedReference(db, subjectUid, authorUid) {
  await deleteDoc(doc(db, "users", subjectUid, "writtenReferences", authorUid));
}

/** Hent status for én venn (til «be om referanse»-liste). */
export async function getReferenceDoc(db, subjectUid, authorUid) {
  const snap = await getDoc(
    doc(db, "users", subjectUid, "writtenReferences", authorUid),
  );
  if (!snap.exists()) return null;
  return { id: snap.id, authorUid: snap.id, ...snap.data() };
}
