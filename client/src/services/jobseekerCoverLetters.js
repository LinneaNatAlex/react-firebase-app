/**
 * Privatpersoners søknadsbibliotek (ikke AI).
 * Lagrer tidligere søknadstekster slik at brukeren kan gjenbruke dem senere.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export const JOBSEEKER_COVER_LETTERS = "jobseekerCoverLetters";

function tsMs(t) {
  if (t?.toMillis) return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return 0;
}

export async function fetchJobseekerCoverLetters(userId, max = 40) {
  if (!userId) return [];
  const q = query(
    collection(db, JOBSEEKER_COVER_LETTERS),
    where("userId", "==", userId),
    limit(200),
  );
  const snap = await getDocs(q);
  const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  arr.sort(
    (a, b) =>
      tsMs(b.createdAt) -
      tsMs(a.createdAt) ||
      String(b.companyName || "").localeCompare(String(a.companyName || "")),
  );
  return arr.slice(0, max);
}

/**
 * Hent tidligere sendte søknader direkte fra `applications` (kilde som alltid finnes fra før).
 * Dette gjør at «biblioteket» fungerer med en gang uten migrering.
 */
export async function fetchCoverLettersFromApplications(userId, max = 80) {
  if (!userId) return [];
  const q = query(collection(db, "applications"), where("userId", "==", userId), limit(300));
  const snap = await getDocs(q);
  const arr = snap.docs
    .map((d) => ({ id: `app:${d.id}`, _source: "applications", ...d.data() }))
    .filter((x) => String(x.coverLetter || "").trim().length >= 10);

  function aTs(x) {
    return tsMs(x.appliedAt) || tsMs(x.createdAt) || 0;
  }

  arr.sort((a, b) => aTs(b) - aTs(a));
  return arr.slice(0, max).map((x) => ({
    id: x.id,
    _source: "applications",
    companyName: x.companyName || "",
    jobTitle: x.jobTitle || "",
    location: x.location || "",
    coverLetter: x.coverLetter || "",
    createdAt: x.appliedAt || x.createdAt || null,
  }));
}

export async function saveJobseekerCoverLetter({
  userId,
  jobId,
  jobTitle,
  companyId,
  companyName,
  location,
  coverLetter,
}) {
  if (!userId) return;
  const text = String(coverLetter || "").trim();
  if (text.length < 10) return;
  await addDoc(collection(db, JOBSEEKER_COVER_LETTERS), {
    userId,
    jobId: jobId || "",
    jobTitle: String(jobTitle || "").trim(),
    companyId: companyId || "",
    companyName: String(companyName || "").trim(),
    location: String(location || "").trim(),
    coverLetter: text,
    createdAt: serverTimestamp(),
  });
}

export async function updateJobseekerCoverLetter(id, { coverLetter }) {
  const text = String(coverLetter || "").trim();
  if (!id) return;
  if (text.length < 10) return;
  await updateDoc(doc(db, JOBSEEKER_COVER_LETTERS, id), {
    coverLetter: text,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteJobseekerCoverLetter(id) {
  if (!id) return;
  await deleteDoc(doc(db, JOBSEEKER_COVER_LETTERS, id));
}

