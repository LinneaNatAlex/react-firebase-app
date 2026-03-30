/**
 * Varsler: users/{uid}/notifications/{id}
 * Typer: company_follow | company_follow_company | friend_request | friend_accepted | application_update
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  query,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";

function sortByCreatedDesc(items) {
  return [...items].sort((a, b) => {
    const ta =
      a.createdAt?.toMillis?.() ??
      (a.createdAt?.seconds != null ? a.createdAt.seconds * 1000 : 0);
    const tb =
      b.createdAt?.toMillis?.() ??
      (b.createdAt?.seconds != null ? b.createdAt.seconds * 1000 : 0);
    return tb - ta;
  });
}

async function actorLabelForUser(db, uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "Bruker";
  const d = snap.data();
  const name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
  return name || "Bruker";
}

async function actorLabelForCompany(db, companyId) {
  const snap = await getDoc(doc(db, "companyProfiles", companyId));
  if (!snap.exists()) return "Bedrift";
  return snap.data().companyName || "Bedrift";
}

/** Standard innstillinger (slått på) – lagres under users/{uid}.notificationSettings */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  notificationsEnabled: true,
  socialFriendRequests: true,
  socialFriendAccepted: true,
  socialFollows: true,
  applicationStatusChanges: true,
  applicationCompanyMessages: true,
};

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 * @returns {Promise<typeof DEFAULT_NOTIFICATION_SETTINGS>}
 */
export async function getMergedNotificationSettings(db, uid) {
  if (!uid) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const raw = snap.exists() ? snap.data().notificationSettings : {};
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 * @param {Partial<typeof DEFAULT_NOTIFICATION_SETTINGS>} partial
 */
export async function saveNotificationSettings(db, uid, partial) {
  if (!uid) return;
  const current = await getMergedNotificationSettings(db, uid);
  await setDoc(
    doc(db, "users", uid),
    { notificationSettings: { ...current, ...partial } },
    { merge: true },
  );
}

const STATUS_LABEL_NB = {
  pending: "Under vurdering",
  reviewed: "Gjennomgått",
  interview: "Til intervju",
  accepted: "Akseptert",
  rejected: "Avslått",
  withdrawn: "Trukket",
};

/**
 * Varsle jobbsøker når bedrift oppdaterer søknad (status og/eller melding).
 * Opprettes av innlogget bedrift; actorId = companyId (Firestore-regel).
 */
export async function notifyJobseekerApplicationUpdate(
  db,
  {
    applicantUid,
    companyId,
    companyName,
    jobTitle,
    applicationId,
    previousStatus,
    newStatus,
    hasCompanyMessage,
  },
) {
  if (!applicantUid || !companyId) return;
  const s = await getMergedNotificationSettings(db, applicantUid);
  if (!s.notificationsEnabled) return;

  const prev = previousStatus || "pending";
  const next = newStatus || "pending";
  const statusChanged = prev !== next;
  const messageRelevant = Boolean(hasCompanyMessage);

  const wantsStatus = s.applicationStatusChanges && statusChanged;
  const wantsMessage = s.applicationCompanyMessages && messageRelevant;

  if (!wantsStatus && !wantsMessage) return;

  const parts = [];
  if (wantsStatus && statusChanged) {
    parts.push(`Status: ${STATUS_LABEL_NB[next] || next}`);
  }
  if (wantsMessage && messageRelevant) {
    parts.push("Melding fra bedriften");
  }
  const previewText =
    parts.length > 0 ? parts.join(" · ") : "Søknaden er oppdatert";

  await addDoc(collection(db, "users", applicantUid, "notifications"), {
    type: "application_update",
    read: false,
    createdAt: serverTimestamp(),
    actorId: companyId,
    actorLabel: companyName || "Bedrift",
    applicationId: applicationId || "",
    jobTitle: jobTitle || "",
    newStatus: next,
    previewText,
  });
}

/** Etter at jobbsøker følger bedrift (companyId = bedriftens bruker-id). */
export async function notifyCompanyNewFollower(db, companyId, followerUid) {
  if (!companyId || !followerUid || companyId === followerUid) return;
  const s = await getMergedNotificationSettings(db, companyId);
  if (!s.notificationsEnabled || !s.socialFollows) return;
  const actorLabel = await actorLabelForUser(db, followerUid);
  await addDoc(collection(db, "users", companyId, "notifications"), {
    type: "company_follow",
    read: false,
    createdAt: serverTimestamp(),
    actorId: followerUid,
    actorLabel,
  });
}

/** Etter at bedrift A følger bedrift B – varsler B. */
export async function notifyCompanyFollowedByCompany(db, targetCompanyId, followerCompanyId) {
  if (!targetCompanyId || !followerCompanyId) return;
  const s = await getMergedNotificationSettings(db, targetCompanyId);
  if (!s.notificationsEnabled || !s.socialFollows) return;
  const actorLabel = await actorLabelForCompany(db, followerCompanyId);
  await addDoc(collection(db, "users", targetCompanyId, "notifications"), {
    type: "company_follow_company",
    read: false,
    createdAt: serverTimestamp(),
    actorId: followerCompanyId,
    actorLabel,
  });
}

/** Venneforespørsel sendt – varsler mottaker. */
export async function notifyFriendRequest(db, toUid, fromUid) {
  if (!toUid || !fromUid) return;
  const s = await getMergedNotificationSettings(db, toUid);
  if (!s.notificationsEnabled || !s.socialFriendRequests) return;
  const actorLabel = await actorLabelForUser(db, fromUid);
  await addDoc(collection(db, "users", toUid, "notifications"), {
    type: "friend_request",
    read: false,
    createdAt: serverTimestamp(),
    actorId: fromUid,
    actorLabel,
  });
}

/** Forespørsel godtatt – varsler den som sendte. */
export async function notifyFriendAccepted(db, requesterUid, accepterUid) {
  if (!requesterUid || !accepterUid) return;
  const s = await getMergedNotificationSettings(db, requesterUid);
  if (!s.notificationsEnabled || !s.socialFriendAccepted) return;
  const actorLabel = await actorLabelForUser(db, accepterUid);
  await addDoc(collection(db, "users", requesterUid, "notifications"), {
    type: "friend_accepted",
    read: false,
    createdAt: serverTimestamp(),
    actorId: accepterUid,
    actorLabel,
  });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 * @param {(items: Array<{ id: string } & object, unreadCount: number) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeToNotifications(db, uid, callback) {
  const colRef = collection(db, "users", uid, "notifications");
  const qy = query(colRef, limit(100));
  return onSnapshot(
    qy,
    (snap) => {
      const items = sortByCreatedDesc(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      ).slice(0, 60);
      const unreadCount = items.filter((x) => !x.read).length;
      callback(items, unreadCount);
    },
    (err) => {
      console.warn("subscribeToNotifications", err);
      callback([], 0);
    },
  );
}

export async function markNotificationRead(db, uid, notificationId) {
  await updateDoc(doc(db, "users", uid, "notifications", notificationId), {
    read: true,
  });
}

export async function markAllNotificationsRead(db, uid, items) {
  const unread = items.filter((x) => !x.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, "users", uid, "notifications", n.id), { read: true });
  }
  await batch.commit();
}
