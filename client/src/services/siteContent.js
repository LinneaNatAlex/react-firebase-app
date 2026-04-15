import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_DOC_ID,
} from "../config/siteContentDefaults";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Slår sammen Firestore-data med standardtekster. */
export function mergeSiteContent(remote) {
  const out = clone(SITE_CONTENT_DEFAULTS);
  if (!remote || typeof remote !== "object") return out;

  for (const section of [
    "landing",
    "about",
    "footer",
    "credits",
    "faqPage",
    "legal",
  ]) {
    const r = remote[section];
    const d = out[section];
    if (!r || typeof r !== "object") continue;
    for (const key of Object.keys(d)) {
      if (!Object.prototype.hasOwnProperty.call(r, key)) continue;
      const v = r[key];
      if (typeof v === "string") out[section][key] = v;
    }
  }

  if (Array.isArray(remote.faq)) {
    out.faq = remote.faq.map((item) => ({
      q: String(item?.q ?? ""),
      a: String(item?.a ?? ""),
    }));
    if (out.faq.length === 0) out.faq = clone(SITE_CONTENT_DEFAULTS.faq);
  }

  return out;
}

export async function fetchSiteContent() {
  const ref = doc(db, "siteContent", SITE_CONTENT_DOC_ID);
  const snap = await getDoc(ref);
  return mergeSiteContent(snap.exists() ? snap.data() : {});
}

/**
 * Lagrer hele innholdsobjektet (etter redigering i admin).
 * @param {object} content — resultat av mergeSiteContent + ev. endringer
 * @param {string} uid — innlogget admin-brukers uid
 */
export async function saveSiteContent(content, uid) {
  const ref = doc(db, "siteContent", SITE_CONTENT_DOC_ID);
  await setDoc(
    ref,
    {
      landing: content.landing,
      about: content.about,
      faq: content.faq,
      faqPage: content.faqPage,
      footer: content.footer,
      credits: content.credits,
      legal: content.legal,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );
}
