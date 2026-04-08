/**
 * Artikler for Utblikk — Firestore-samlingen magazineArticles
 *
 * Spørringer bruker kun ett where-felt (unngår krav om sammensatt indeks som ofte
 * gir tom liste i produksjon før indekser er opprettet i Firebase Console).
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export const MAGAZINE_ARTICLES = "magazineArticles";

/** Millisekunder fra Firestore Timestamp eller 0 */
function tsMs(data, ...fields) {
  for (const f of fields) {
    const v = data[f];
    if (v?.toMillis) return v.toMillis();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
  }
  return 0;
}

/** Tekst uten HTML — til ingress og lister */
export function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Første bilde-URL fra Quill/HTML-brødtekst (hvis ikke eget forsidebilde) */
export function firstImageSrcFromHtml(html) {
  if (!html) return "";
  const s = String(html);
  const m = s.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1].trim();
  const m2 = s.match(/<img[^>]+src=([^\s>]+)/i);
  if (m2) return m2[1].replace(/^["']|["']$/g, "").trim();
  return "";
}

/** Forsidebilde har førsterett; ellers første bilde i artikkelen */
export function resolveTeaserImageUrl(coverImageUrl, bodyHtml) {
  const c = String(coverImageUrl || "").trim();
  if (c) return c;
  return firstImageSrcFromHtml(bodyHtml);
}

/**
 * Utkast til listen: maks `maxSentences` setninger fra brødteksten (topp av artikkelen).
 */
export function buildListTeaserSentences(excerpt, bodyHtml, maxSentences = 5) {
  const fromBody = stripHtml(bodyHtml || "").trim();
  const fromExcerpt = stripHtml(excerpt || "").trim();
  const text = fromBody || fromExcerpt;
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();

  let chunks;
  try {
    chunks = normalized
      .split(/(?<=[.!?])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
  } catch {
    chunks = [normalized];
  }

  if (chunks.length === 0) return normalized.slice(0, 500);
  return chunks.slice(0, maxSentences).join(" ");
}

export function slugify(text) {
  const s = text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "artikkel";
}

async function ensureUniqueSlug(base, excludeId) {
  let slug = base;
  let n = 0;
  for (;;) {
    const q = query(
      collection(db, MAGAZINE_ARTICLES),
      where("slug", "==", slug),
      limit(20),
    );
    const snap = await getDocs(q);
    const conflict = snap.docs.find((d) => d.id !== excludeId);
    if (!conflict) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export async function fetchPublishedArticles(max = 50) {
  const q = query(
    collection(db, MAGAZINE_ARTICLES),
    where("status", "==", "published"),
    limit(500),
  );
  const snap = await getDocs(q);
  const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  arr.sort(
    (a, b) =>
      tsMs(b, "publishedAt", "updatedAt") -
      tsMs(a, "publishedAt", "updatedAt"),
  );
  return arr.slice(0, max);
}

/** Sortert etter flest visninger (viewCount), deretter nyeste publisert */
export async function fetchMostReadArticles(max = 5) {
  const q = query(
    collection(db, MAGAZINE_ARTICLES),
    where("status", "==", "published"),
    limit(500),
  );
  const snap = await getDocs(q);
  const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  arr.sort(sortPublishedByMostRead);
  return arr.slice(0, max);
}

/** Klient-sortering: flest visninger først, deretter nyeste publisert */
export function sortPublishedByMostRead(a, b) {
  const va = Number(a.viewCount || 0);
  const vb = Number(b.viewCount || 0);
  if (vb !== va) return vb - va;
  return tsMs(b, "publishedAt") - tsMs(a, "publishedAt");
}

/** Kall én gang per sidevisning (f.eks. fra artikkelside). Krever Firestore-regel for +1 på viewCount. */
export async function incrementArticleViewCount(articleId) {
  await updateDoc(doc(db, MAGAZINE_ARTICLES, articleId), {
    viewCount: increment(1),
  });
}

export async function fetchArticleBySlug(slug) {
  if (!slug || !String(slug).trim()) return null;
  const q = query(
    collection(db, MAGAZINE_ARTICLES),
    where("slug", "==", String(slug).trim()),
    limit(25),
  );
  const snap = await getDocs(q);
  const pub = snap.docs.find((d) => d.data().status === "published");
  if (!pub) return null;
  return { id: pub.id, ...pub.data() };
}

export async function fetchArticleById(id) {
  const ref = doc(db, MAGAZINE_ARTICLES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fetchDraftsForAuthor(authorId) {
  const q = query(
    collection(db, MAGAZINE_ARTICLES),
    where("authorId", "==", authorId),
    limit(500),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.status === "draft")
    .sort(
      (a, b) =>
        tsMs(b, "updatedAt", "createdAt") -
        tsMs(a, "updatedAt", "createdAt"),
    );
}

export async function fetchAllDrafts() {
  const q = query(
    collection(db, MAGAZINE_ARTICLES),
    where("status", "==", "draft"),
    limit(500),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        tsMs(b, "updatedAt", "createdAt") -
        tsMs(a, "updatedAt", "createdAt"),
    );
}

export async function createDraftArticle({
  authorId,
  authorName,
  title = "Uten tittel",
  bodyHtml = "",
}) {
  const ref = await addDoc(collection(db, MAGAZINE_ARTICLES), {
    title,
    bodyHtml,
    excerpt: "",
    coverImageUrl: "",
    authorId,
    authorName,
    status: "draft",
    slug: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  });
  return ref.id;
}

export async function saveArticleDraft(articleId, { title, bodyHtml, excerpt, coverImageUrl }) {
  const payload = {
    title,
    bodyHtml,
    excerpt: excerpt ?? "",
    updatedAt: serverTimestamp(),
  };
  if (coverImageUrl !== undefined) {
    payload.coverImageUrl = String(coverImageUrl || "").trim();
  }
  await updateDoc(doc(db, MAGAZINE_ARTICLES, articleId), payload);
}

export async function publishArticle(articleId, title) {
  const base = slugify(title);
  const slug = await ensureUniqueSlug(base, articleId);
  await updateDoc(doc(db, MAGAZINE_ARTICLES, articleId), {
    title,
    slug,
    status: "published",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    viewCount: 0,
  });
  return slug;
}

export async function unpublishArticle(articleId) {
  await updateDoc(doc(db, MAGAZINE_ARTICLES, articleId), {
    status: "draft",
    slug: "",
    publishedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteArticle(articleId) {
  await deleteDoc(doc(db, MAGAZINE_ARTICLES, articleId));
}
