import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

const MAX = 12;

function normalizeNeedle(raw) {
  return String(raw || "").trim().toLowerCase();
}

function companyMatches(data, needle) {
  if (!needle || needle.length < 2) return false;
  const name = String(data.companyName || "").toLowerCase();
  const sn = String(data.searchNameLower || name || "").toLowerCase();
  return sn.includes(needle) || name.includes(needle);
}

function jobseekerMatches(data, needle) {
  if (!needle || needle.length < 2) return false;
  const fn = String(data.firstName || "").toLowerCase();
  const ln = String(data.lastName || "").toLowerCase();
  const full = `${fn} ${ln}`.trim();
  const sn = String(data.searchNameLower || full || "").toLowerCase();
  return sn.includes(needle) || full.includes(needle);
}

function mapCompanyDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    companyName: data.companyName || "Bedrift",
    industry: data.industry || "",
  };
}

function mapJobseekerDoc(d) {
  const data = d.data();
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const displayLabel =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Bruker";
  return {
    id: d.id,
    firstName,
    lastName,
    displayLabel,
  };
}

/**
 * Indekssøk + fallback: eldre dokumenter mangler `searchNameLower`, og manglende
 * sammensatt indeks kan gjøre at spørringen feiler — da skanner vi i minnet (OK for mindre databaser).
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} rawQuery
 * @returns {Promise<Array<{ id: string, companyName: string, industry?: string }>>}
 */
export async function searchCompaniesByPrefix(db, rawQuery) {
  const needle = normalizeNeedle(rawQuery);
  if (needle.length < 2) return [];

  try {
    const ref = collection(db, "companyProfiles");
    const qy = query(
      ref,
      where("searchNameLower", ">=", needle),
      where("searchNameLower", "<=", `${needle}\uf8ff`),
      orderBy("searchNameLower"),
      limit(MAX),
    );
    const snap = await getDocs(qy);
    const rows = snap.docs.map(mapCompanyDoc);
    if (rows.length > 0) return rows;
  } catch (e) {
    console.warn("searchCompaniesByPrefix (indeks)", e);
  }

  try {
    const snap = await getDocs(collection(db, "companyProfiles"));
    const rows = [];
    for (const d of snap.docs) {
      if (companyMatches(d.data(), needle)) {
        rows.push(mapCompanyDoc(d));
        if (rows.length >= MAX) break;
      }
    }
    return rows;
  } catch (e) {
    console.warn("searchCompaniesByPrefix (fallback)", e);
    return [];
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} rawQuery
 * @returns {Promise<Array<{ id: string, firstName?: string, lastName?: string, displayLabel: string }>>}
 */
export async function searchJobseekersByPrefix(db, rawQuery) {
  const needle = normalizeNeedle(rawQuery);
  if (needle.length < 2) return [];

  try {
    const ref = collection(db, "users");
    const qy = query(
      ref,
      where("userType", "==", "jobseeker"),
      where("searchNameLower", ">=", needle),
      where("searchNameLower", "<=", `${needle}\uf8ff`),
      orderBy("searchNameLower"),
      limit(MAX),
    );
    const snap = await getDocs(qy);
    const rows = snap.docs.map(mapJobseekerDoc);
    if (rows.length > 0) return rows;
  } catch (e) {
    console.warn("searchJobseekersByPrefix (indeks)", e);
  }

  try {
    const qy = query(
      collection(db, "users"),
      where("userType", "==", "jobseeker"),
    );
    const snap = await getDocs(qy);
    const rows = [];
    for (const d of snap.docs) {
      if (jobseekerMatches(d.data(), needle)) {
        rows.push(mapJobseekerDoc(d));
        if (rows.length >= MAX) break;
      }
    }
    return rows;
  } catch (e) {
    console.warn("searchJobseekersByPrefix (fallback)", e);
    return [];
  }
}
