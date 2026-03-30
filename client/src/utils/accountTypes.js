/**
 * Privatkonto lagres som userType "jobseeker" i Firestore (bakoverkompatibilitet).
 * Bruk denne hjelperen for registrerings-URL og visningsnavn.
 */
export function normalizeRegisterTypeParam(value) {
  if (value == null || value === '') return null;
  const v = String(value).toLowerCase().trim();
  if (v === 'person' || v === 'privatperson' || v === 'private' || v === 'jobseeker') {
    return 'jobseeker';
  }
  if (v === 'company' || v === 'bedrift') {
    return 'company';
  }
  return null;
}
