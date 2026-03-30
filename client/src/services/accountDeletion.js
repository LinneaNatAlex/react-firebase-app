/**
 * Kontosletting: 30 dagers frist etter forespørsel.
 * Full sletting av data skjer ved innlogging etter fristen (klient).
 * Kontoer som aldri logger inn igjen krever egen server-jobb eller TTL for full purge.
 */

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { deleteUser, signOut } from "firebase/auth";
import { auth } from "../firebase";

const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

async function deleteQueryDocs(db, q) {
  const snap = await getDocs(q);
  let total = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + 400);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += chunk.length;
  }
  return total;
}

async function deleteSubcollectionDocs(db, ...pathSegments) {
  const colRef = collection(db, ...pathSegments);
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + 400);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Marker konto for sletting om 30 dager (Firestore users/{uid}).
 */
export async function scheduleAccountDeletion(db, uid) {
  if (!uid) return;
  const deadline = Timestamp.fromMillis(Date.now() + DELETION_GRACE_MS);
  await setDoc(
    doc(db, "users", uid),
    {
      accountDeletionRequestedAt: serverTimestamp(),
      accountDeletionDeadline: deadline,
    },
    { merge: true },
  );
}

/**
 * Sletter brukerdata i Firestore (ikke Auth — kaller må kjøre deleteUser etterpå).
 * @param {"jobseeker"|"company"|string} userType
 */
export async function purgeUserAccountData(db, uid, userType) {
  if (!uid) return;

  try {
    await deleteSubcollectionDocs(db, "users", uid, "notifications");
  } catch (e) {
    console.warn("purge notifications", e);
  }

  try {
    const friendsSnap = await getDocs(collection(db, "users", uid, "friends"));
    for (const f of friendsSnap.docs) {
      const fid = f.id;
      try {
        await deleteDoc(doc(db, "users", fid, "friends", uid));
      } catch {
        /* */
      }
      try {
        await deleteDoc(doc(db, "users", uid, "friends", fid));
      } catch {
        /* */
      }
    }
  } catch (e) {
    console.warn("purge friends", e);
  }

  try {
    const followedSnap = await getDocs(collection(db, "users", uid, "followedCompanies"));
    for (const d of followedSnap.docs) {
      const cid = d.id;
      try {
        await deleteDoc(doc(db, "companyFollowers", cid, "users", uid));
      } catch {
        /* */
      }
      try {
        await deleteDoc(doc(db, "users", uid, "followedCompanies", cid));
      } catch {
        /* */
      }
    }
  } catch (e) {
    console.warn("purge followedCompanies", e);
  }

  try {
    const fr1 = query(collection(db, "friendRequests"), where("fromUid", "==", uid));
    await deleteQueryDocs(db, fr1);
    const fr2 = query(collection(db, "friendRequests"), where("toUid", "==", uid));
    await deleteQueryDocs(db, fr2);
  } catch (e) {
    console.warn("purge friendRequests", e);
  }

  try {
    const appsUser = query(collection(db, "applications"), where("userId", "==", uid));
    await deleteQueryDocs(db, appsUser);
  } catch (e) {
    console.warn("purge applications by userId", e);
  }

  try {
    await deleteDoc(doc(db, "profiles", uid));
  } catch {
    /* */
  }

  if (userType === "company") {
    try {
      const appsCo = query(collection(db, "applications"), where("companyId", "==", uid));
      await deleteQueryDocs(db, appsCo);
    } catch (e) {
      console.warn("purge applications by companyId", e);
    }

    try {
      const jobsQ = query(collection(db, "jobs"), where("companyId", "==", uid));
      await deleteQueryDocs(db, jobsQ);
    } catch (e) {
      console.warn("purge jobs", e);
    }

    try {
      await deleteSubcollectionDocs(db, "companyFollowers", uid, "users");
      await deleteDoc(doc(db, "companyFollowers", uid));
    } catch (e) {
      console.warn("purge companyFollowers users", e);
    }

    try {
      await deleteSubcollectionDocs(db, "companyToCompanyFollows", uid, "following");
      await deleteDoc(doc(db, "companyToCompanyFollows", uid));
    } catch (e) {
      console.warn("purge companyToCompanyFollows", e);
    }

    try {
      await deleteDoc(doc(db, "companyProfiles", uid));
    } catch {
      /* */
    }
  }

  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (e) {
    console.warn("purge users doc", e);
  }
}

/**
 * Et innlogget forsøk: frist utløpt → slett data + Auth-bruker.
 * Innen frist → fjern slettemerke (brukeren er tilbake).
 * @returns {"purged"|"cancelled"|null}
 */
export async function resolveAccountDeletionOnLogin(db, authUser, mergedUserData) {
  if (!authUser?.uid || !mergedUserData) return null;
  const deadline = mergedUserData.accountDeletionDeadline;
  if (!deadline?.toMillis) return null;

  const now = Date.now();
  if (now > deadline.toMillis()) {
    try {
      await purgeUserAccountData(db, authUser.uid, mergedUserData.userType);
      await deleteUser(authUser);
    } catch (e) {
      console.error("Account purge/delete failed", e);
      try {
        await signOut(auth);
      } catch {
        /* */
      }
    }
    return "purged";
  }

  await updateDoc(doc(db, "users", authUser.uid), {
    accountDeletionRequestedAt: deleteField(),
    accountDeletionDeadline: deleteField(),
  });
  return "cancelled";
}

export { DELETION_GRACE_MS };
