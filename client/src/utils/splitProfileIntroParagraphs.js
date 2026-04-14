/**
 * Profil- og CV-tekst fra Firestore (textarea) → React-avsnitt.
 *
 * Bakgrunn: Brukere kan ha manuelt linjeskift etter bindestrek (orddeling). Hvis vi bare
 * erstatter \n med mellomrom, får vi «ord- resten». Derfor normaliseres «-\n» først.
 *
 * Hvor det brukes:
 * - splitProfileIntroParagraphs → «Om meg», sammendrag, korte felt (enkelt linjeskift → mellomrom)
 * - splitCvMultilineParagraphs → erfaring, utdanning, ferdigheter, søknadstekst (linjeskift beholdes)
 * - normalizeCvHyphens → kommaseparert liste (bedrift: ferdighet-tags) uten å endre strukturen
 *
 * Styling: `person-public-body-text--prose` + ev. `--multiline` i CompanyProfilePage.css;
 * bedrift modal: `.cv-prose` i Dashboard.css.
 */

/**
 * Ett tekstblokk (mellom tomme linjer): fjern orddeling med bindestrek, deretter fløt ut
 * enkelt linjeskift til mellomrom slik at avsnittet kan brytes naturlig i nettleseren.
 */
function normalizeIntroBlock(block) {
  return block
    .replace(/-\s*\n\s*/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sammenhengende prose: tom linje = nytt <p>. Passer sammendrag, «Om meg», ønsket stilling. */
export function splitProfileIntroParagraphs(raw) {
  const t = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  return t.split(/\n{2,}/).map(normalizeIntroBlock).filter(Boolean);
}

/**
 * Liste-/blokktekst: tom linje = nytt <p>, men enkelt linjeskift inne i blokken beholdes (pre-line i CSS).
 * Bruk til erfaring, utdanning, ferdigheter (flere linjer), søknadstekst.
 */
export function splitCvMultilineParagraphs(raw) {
  const t = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  return t
    .split(/\n{2,}/)
    .map((block) => block.replace(/-\s*\n\s*/g, "").trim())
    .filter(Boolean);
}

/**
 * Samme bindestrek-fiks som over, men uten å dele i avsnitt – for strenger som senere splittes
 * på komma (ferdigheter i bedriftsvisning).
 */
export function normalizeCvHyphens(raw) {
  return String(raw ?? "").replace(/\r\n/g, "\n").replace(/-\s*\n\s*/g, "");
}
