// Offentlig bedriftsprofil: companyProfiles/{companyId} (uten e-post m.m.)
// Synkes fra redigeringssiden sammen med users/{uid} for mal/AI.
//
// Firestore-regler (legg inn i ditt prosjekt):
//   match /companyProfiles/{companyId} {
//     allow read: if true;
//     allow create, update, delete: if request.auth != null && request.auth.uid == companyId;
//   }

import { doc, setDoc, deleteField } from "firebase/firestore";

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} companyId
 * @param {object} data
 * @param {string} [data.companyImage] – data-URL; tom streng fjerner feltet. Utelat for å ikke endre logo.
 */
export async function syncPublicCompanyProfile(db, companyId, data) {
  const companyName = String(data.companyName || "").trim();
  const companyAbout = String(data.companyAbout || "").trim();
  const website = String(data.website || "").trim();
  const industry = String(data.industry || "").trim();
  const hqLocation = String(data.hqLocation || "").trim();

  const patch = {
    companyId,
    companyName,
    companyAbout,
    website,
    industry,
    hqLocation,
    searchNameLower: companyName ? companyName.toLowerCase() : "",
    updatedAt: new Date(),
  };

  if (Object.prototype.hasOwnProperty.call(data, "companyImage")) {
    const img = data.companyImage;
    patch.companyImage =
      img && String(img).trim() ? String(img).trim() : deleteField();
  }

  await setDoc(doc(db, "companyProfiles", companyId), patch, { merge: true });
}
