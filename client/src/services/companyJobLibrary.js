/**
 * Bedriftens stillingsbibliotek – egne tekster lagret i Firestore (ikke generert av AI).
 * Brukes til gjenbruk i skjema og kan indekseres til RAG på server når AI-utkast er aktivert.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export const COMPANY_JOB_LIBRARY = "companyJobLibrary";

function tsMs(t) {
  if (t?.toMillis) return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return 0;
}

export async function fetchCompanyJobLibrary(companyId) {
  if (!companyId) return [];
  const q = query(
    collection(db, COMPANY_JOB_LIBRARY),
    where("companyId", "==", companyId),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        Math.max(tsMs(b.updatedAt), tsMs(b.createdAt), tsMs(b.lastUsedAt)) -
        Math.max(tsMs(a.updatedAt), tsMs(a.createdAt), tsMs(a.lastUsedAt)),
    );
}

export async function addCompanyJobLibraryItem(companyId, { title, description }) {
  await addDoc(collection(db, COMPANY_JOB_LIBRARY), {
    companyId,
    title: String(title || "").trim() || "Uten tittel",
    description: String(description || "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCompanyJobLibraryItem(id, { title, description }) {
  await updateDoc(doc(db, COMPANY_JOB_LIBRARY, id), {
    title: String(title || "").trim(),
    description: String(description || "").trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCompanyJobLibraryItem(id) {
  await deleteDoc(doc(db, COMPANY_JOB_LIBRARY, id));
}

/** Oppdaterer når bruker limer inn tekst fra biblioteket (nyttig for sortering). */
export async function touchCompanyJobLibraryLastUsed(id) {
  await updateDoc(doc(db, COMPANY_JOB_LIBRARY, id), {
    lastUsedAt: serverTimestamp(),
  });
}
