/** Normalisert søkestreng for Firestore-prefixsøk (små bokstaver, trim). */
export function buildUserSearchNameLower(firstName, lastName) {
  return [firstName, lastName]
    .filter((s) => s && String(s).trim())
    .join(" ")
    .trim()
    .toLowerCase();
}

export function buildCompanySearchNameLower(companyName) {
  return String(companyName || "")
    .trim()
    .toLowerCase();
}
