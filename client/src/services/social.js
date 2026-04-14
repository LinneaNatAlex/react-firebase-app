/**
 * Sosialt: følg bedrift, bedrift følger bedrift, venner mellom jobbsøkere.
 *
 * Firestore-struktur:
 * - companyFollowers/{companyId}/users/{followerUid}
 * - users/{uid}/followedCompanies/{companyId}
 * - companyToCompanyFollows/{companyId}/following/{otherCompanyId}
 * - users/{uid}/friends/{friendUid}
 * - friendRequests/{pairKey} der pairKey = sort([uidA,uidB]).join("_")
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import {
  notifyCompanyNewFollower,
  notifyCompanyFollowedByCompany,
  notifyFriendRequest,
  notifyFriendAccepted,
} from "./notifications";

export async function syncPublicProfileImageFromCv(_uid) {
  // Profilbilde ligger i profiles/{uid}; ingen ekstra lagring nødvendig.
}

export function pairKey(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

/** @param {import('firebase/firestore').Firestore} db */
export async function getCompanyFollowerCount(db, companyId) {
  try {
    const snap = await getCountFromServer(
      collection(db, "companyFollowers", companyId, "users"),
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}

/** Antall bedrifter denne bedriften følger. */
export async function getCompanyFollowingCompanyCount(db, companyId) {
  try {
    const snap = await getCountFromServer(
      collection(db, "companyToCompanyFollows", companyId, "following"),
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function isUserFollowingCompany(db, userId, companyId) {
  const ref = doc(db, "companyFollowers", companyId, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists();
}

/** @returns {Promise<{ followerCount: number, followingCompanyCount: number }>} */
export async function getCompanySocialStats(db, companyId) {
  const [followerCount, followingCompanyCount] = await Promise.all([
    getCompanyFollowerCount(db, companyId),
    getCompanyFollowingCompanyCount(db, companyId),
  ]);
  return { followerCount, followingCompanyCount };
}

/** Første N brukere som følger bedriften (for liste på profil). */
export async function listCompanyFollowerPreview(db, companyId, max = 8) {
  try {
    const snap = await getDocs(
      query(collection(db, "companyFollowers", companyId, "users"), limit(max)),
    );
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

/** Bedrifter denne bedriften følger (preview). */
export async function listCompanyFollowingCompaniesPreview(db, companyId, max = 12) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "companyToCompanyFollows", companyId, "following"),
        limit(max),
      ),
    );
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

/** Jobbsøker følger bedrift. */
export async function followCompanyAsUser(db, userId, companyId) {
  if (!userId || !companyId || userId === companyId) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "companyFollowers", companyId, "users", userId), {
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", userId, "followedCompanies", companyId), {
    companyId,
    followedAt: serverTimestamp(),
  });
  await batch.commit();
  try {
    await notifyCompanyNewFollower(db, companyId, userId);
  } catch (e) {
    console.warn("notifyCompanyNewFollower", e);
  }
}

export async function unfollowCompanyAsUser(db, userId, companyId) {
  if (!userId || !companyId) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "companyFollowers", companyId, "users", userId));
  batch.delete(doc(db, "users", userId, "followedCompanies", companyId));
  await batch.commit();
}

/** Bedrift følger annen bedrift. */
export async function followCompanyAsCompany(db, followerCompanyId, targetCompanyId) {
  if (!followerCompanyId || !targetCompanyId || followerCompanyId === targetCompanyId) {
    return;
  }
  await setDoc(
    doc(
      db,
      "companyToCompanyFollows",
      followerCompanyId,
      "following",
      targetCompanyId,
    ),
    { createdAt: serverTimestamp() },
  );
  try {
    await notifyCompanyFollowedByCompany(db, targetCompanyId, followerCompanyId);
  } catch (e) {
    console.warn("notifyCompanyFollowedByCompany", e);
  }
}

export async function unfollowCompanyAsCompany(db, followerCompanyId, targetCompanyId) {
  if (!followerCompanyId || !targetCompanyId) return;
  await deleteDoc(
    doc(
      db,
      "companyToCompanyFollows",
      followerCompanyId,
      "following",
      targetCompanyId,
    ),
  );
}

export async function isCompanyFollowingCompany(db, followerCompanyId, targetCompanyId) {
  const ref = doc(
    db,
    "companyToCompanyFollows",
    followerCompanyId,
    "following",
    targetCompanyId,
  );
  const snap = await getDoc(ref);
  return snap.exists();
}

/**
 * Brukere som har bedt om kontosletting (før fristen) skal ikke vises i andres vennelister.
 * Ved innlogging innen fristen fjernes feltene — da vises de igjen.
 */
export async function isUserPendingAccountDeletion(db, uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const d = snap.data();
    return Boolean(d.accountDeletionDeadline);
  } catch {
    return false;
  }
}

/** Filtrer bort uid-er der konto er under sletting (grace period). */
export async function filterFriendUidsVisible(db, uids) {
  if (!uids?.length) return [];
  const unique = [...new Set(uids)];
  const checks = await Promise.all(
    unique.map(async (uid) => {
      const pending = await isUserPendingAccountDeletion(db, uid);
      return pending ? null : uid;
    }),
  );
  return checks.filter(Boolean);
}

export async function getFriendCount(db, userId) {
  try {
    const snap = await getDocs(collection(db, "users", userId, "friends"));
    const raw = snap.docs.map((d) => d.id);
    const visible = await filterFriendUidsVisible(db, raw);
    return visible.length;
  } catch {
    return 0;
  }
}

export async function areFriends(db, uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const snap = await getDoc(doc(db, "users", uidA, "friends", uidB));
  return snap.exists();
}

/** @returns {Promise<'none'|'pending_out'|'pending_in'|'friends'>} */
export async function getFriendshipState(db, viewerUid, profileUid) {
  if (!viewerUid || !profileUid || viewerUid === profileUid) return "none";
  if (await isUserPendingAccountDeletion(db, profileUid)) return "none";
  if (await areFriends(db, viewerUid, profileUid)) return "friends";
  const pk = pairKey(viewerUid, profileUid);
  const reqSnap = await getDoc(doc(db, "friendRequests", pk));
  if (!reqSnap.exists()) return "none";
  const d = reqSnap.data();
  if (d.status !== "pending") return "none";
  if (d.fromUid === viewerUid) return "pending_out";
  if (d.toUid === viewerUid) return "pending_in";
  return "none";
}

export async function sendFriendRequest(db, fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) return;
  if (await areFriends(db, fromUid, toUid)) return;
  const pk = pairKey(fromUid, toUid);
  const ref = doc(db, "friendRequests", pk);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const d = existing.data();
    if (d.status === "pending") {
      if (d.fromUid === fromUid) return;
      if (d.toUid === fromUid) return;
    }
    // Regler tillater ikke update på friendRequests; gjenbruk av doc-id krever sletting først.
    await deleteDoc(ref);
  }
  await setDoc(ref, {
    fromUid,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  try {
    await notifyFriendRequest(db, toUid, fromUid);
  } catch (e) {
    console.warn("notifyFriendRequest", e);
  }
}

export async function acceptFriendRequest(db, currentUid, otherUid) {
  if (!currentUid || !otherUid) return;
  const pk = pairKey(currentUid, otherUid);
  const ref = doc(db, "friendRequests", pk);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  if (d.status !== "pending" || d.toUid !== currentUid) return;
  const batch = writeBatch(db);
  batch.delete(ref);
  batch.set(doc(db, "users", d.fromUid, "friends", d.toUid), {
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", d.toUid, "friends", d.fromUid), {
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  try {
    await notifyFriendAccepted(db, d.fromUid, d.toUid);
  } catch (e) {
    console.warn("notifyFriendAccepted", e);
  }
}

export async function declineFriendRequest(db, currentUid, otherUid) {
  const pk = pairKey(currentUid, otherUid);
  const ref = doc(db, "friendRequests", pk);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  if (d.status !== "pending" || d.toUid !== currentUid) return;
  await deleteDoc(ref);
}

export async function cancelFriendRequest(db, currentUid, otherUid) {
  const pk = pairKey(currentUid, otherUid);
  const ref = doc(db, "friendRequests", pk);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  if (d.status !== "pending" || d.fromUid !== currentUid) return;
  await deleteDoc(ref);
}

/** Fjern vennskap (sletter begge kanter). Kun når dere allerede er venner. */
export async function removeFriend(db, currentUid, otherUid) {
  if (!currentUid || !otherUid || currentUid === otherUid) return;
  if (!(await areFriends(db, currentUid, otherUid))) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", currentUid, "friends", otherUid));
  batch.delete(doc(db, "users", otherUid, "friends", currentUid));
  await batch.commit();
}

/** @returns {Promise<Array<{ companyId: string, companyName: string }>>} */
export async function getFollowedCompanyCount(db, userId) {
  try {
    const snap = await getCountFromServer(
      collection(db, "users", userId, "followedCompanies"),
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function listFollowedCompaniesForUser(db, userId, max = 20) {
  try {
    const snap = await getDocs(
      query(collection(db, "users", userId, "followedCompanies"), limit(max)),
    );
    const ids = snap.docs.map((d) => d.id);
    const out = [];
    for (const cid of ids) {
      const prof = await getDoc(doc(db, "companyProfiles", cid));
      const name = prof.exists() ? prof.data().companyName || "Bedrift" : "Bedrift";
      out.push({ companyId: cid, companyName: name });
    }
    return out;
  } catch {
    return [];
  }
}

/** Venner (preview) – uid-liste (uten brukere under kontosletting) */
export async function listFriendUidsPreview(db, userId, max = 12) {
  try {
    const snap = await getDocs(
      query(collection(db, "users", userId, "friends"), limit(max)),
    );
    const raw = snap.docs.map((d) => d.id);
    return filterFriendUidsVisible(db, raw);
  } catch {
    return [];
  }
}

/** Alle synlige venner (uid-liste), til administrasjon på Min side. */
export async function listAllFriendUids(db, userId) {
  try {
    const snap = await getDocs(collection(db, "users", userId, "friends"));
    const raw = snap.docs.map((d) => d.id);
    return filterFriendUidsVisible(db, raw);
  } catch {
    return [];
  }
}

/** @returns {Promise<Array<{ uid: string, label: string }>>} */
export async function fetchUserLabelsForIds(db, uids) {
  const out = [];
  for (const uid of uids) {
    const s = await getDoc(doc(db, "users", uid));
    if (s.exists()) {
      const d = s.data();
      const label =
        [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || "Bruker";
      out.push({ uid, label });
    } else {
      out.push({ uid, label: "Bruker" });
    }
  }
  return out;
}

/** Venner på offentlig profil: navn + profilbilde (data-URL) fra profiles. Forventer uid-er som allerede er filtrert (bruk listFriendUidsPreview / listAllFriendUids). */
export async function fetchFriendAvatarsForUids(db, uids) {
  const labels = await fetchUserLabelsForIds(db, uids);
  const out = [];
  for (const { uid, label } of labels) {
    const prof = await getDoc(doc(db, "profiles", uid));
    let photoUrl = null;
    if (prof.exists()) {
      const img = prof.data().profileImage;
      if (img && String(img).trim()) photoUrl = String(img).trim();
    }
    out.push({ uid, label, photoUrl });
  }
  return out;
}

/** Alle som følger bedriften (for modal). */
export async function listAllCompanyFollowers(db, companyId) {
  try {
    const snap = await getDocs(
      collection(db, "companyFollowers", companyId, "users"),
    );
    const uids = snap.docs.map((d) => d.id);
    return fetchUserLabelsForIds(db, uids);
  } catch {
    return [];
  }
}

/** Alle bedrifter denne bedriften følger (for modal). */
export async function listAllCompanyFollowingCompanies(db, companyId) {
  try {
    const snap = await getDocs(
      collection(db, "companyToCompanyFollows", companyId, "following"),
    );
    const ids = snap.docs.map((d) => d.id);
    return fetchCompanyNamesForIds(db, ids);
  } catch {
    return [];
  }
}

/** Profilbilde (data-URL) for bruker, til varsler. */
export async function fetchProfilePhotoUrl(db, uid) {
  if (!uid) return null;
  try {
    const prof = await getDoc(doc(db, "profiles", uid));
    if (!prof.exists()) return null;
    const img = prof.data().profileImage;
    return img && String(img).trim() ? String(img).trim() : null;
  } catch {
    return null;
  }
}

/** Bedriftslogo (data-URL) for varsler. */
export async function fetchCompanyLogoUrl(db, companyId) {
  if (!companyId) return null;
  try {
    const s = await getDoc(doc(db, "companyProfiles", companyId));
    if (!s.exists()) return null;
    const img = s.data().companyImage;
    return img && String(img).trim() ? String(img).trim() : null;
  } catch {
    return null;
  }
}

/** Profilbilde eller bedriftslogo for chat (etter userType). */
export async function fetchParticipantAvatarUrl(db, uid) {
  if (!uid) return null;
  try {
    const u = await getDoc(doc(db, "users", uid));
    const ut = u.exists() ? u.data()?.userType : "";
    if (ut === "company") return fetchCompanyLogoUrl(db, uid);
    return fetchProfilePhotoUrl(db, uid);
  } catch {
    return null;
  }
}

/** @returns {Promise<Array<{ id: string, companyName: string }>>} */
export async function fetchCompanyNamesForIds(db, ids) {
  const out = [];
  for (const id of ids) {
    const s = await getDoc(doc(db, "companyProfiles", id));
    const companyName = s.exists() ? s.data().companyName || "Bedrift" : "Bedrift";
    out.push({ id, companyName });
  }
  return out;
}

/**
 * Innkommende venneforespørsler (toUid === deg). Kun status pending.
 * @param {(rows: Array<{ id: string, fromUid: string, toUid: string, status: string }>) => void} callback
 */
export function subscribeIncomingFriendRequests(db, recipientUid, callback) {
  if (!recipientUid) {
    callback([]);
    return () => {};
  }
  const qy = query(
    collection(db, "friendRequests"),
    where("toUid", "==", recipientUid),
    limit(40),
  );
  return onSnapshot(
    qy,
    async (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => x.status === "pending");
      const fromUids = rows.map((r) => r.fromUid).filter(Boolean);
      const visibleSet = new Set(await filterFriendUidsVisible(db, fromUids));
      const filtered = rows.filter((r) => visibleSet.has(r.fromUid));
      callback(filtered);
    },
    (err) => {
      console.warn("subscribeIncomingFriendRequests", err);
      callback([]);
    },
  );
}
