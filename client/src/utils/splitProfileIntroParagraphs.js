/**
 * Profil- og CV-tekst fra Firestore (textarea) → React-avsnitt.
 *
 * Bakgrunn: Brukere kan ha manuelt linjeskift etter bindestrek (orddeling). Hvis vi bare
 * erstatter \n med mellomrom, får vi «ord- resten». Derfor normaliseres «-\n» først.
 *
 * Hvor det brukes:
 * - splitProfileIntroParagraphs → «Om meg», sammendrag, korte felt (enkelt linjeskift → mellomrom;
 *   kun \n\n+ gir nytt avsnitt — unngår smale «hard-wrap»-kolonner)
 * - splitCvMultilineParagraphs → erfaring, utdanning, ferdigheter, søknadstekst (linjeskift beholdes)
 * - normalizeCvHyphens → kommaseparert liste (bedrift: ferdighet-tags) uten å endre strukturen
 *
 * Styling: `person-public-body-text--prose` + ev. `--multiline` i CompanyProfilePage.css;
 * bedrift modal: `.cv-prose` i Dashboard.css.
 */

/** Privat tegn for midlertidig avsnittsgrense (Private Use Area — skal ikke forekomme i brukertekst). */
const PARA_BREAK = "\uE000";

/**
 * Tekst limt inn fra nettsider/Word inneholder ofte &amp; osv. React viser det bokstavelig i {text}.
 * Dekoder vanlige entiteter til tegn — ikke HTML-parsing (trygt som tekstinnhold).
 */
export function decodeHtmlEntitiesForDisplay(text) {
  if (text == null || text === "") return "";
  let s = String(text);
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (let i = 0; i < 8; i += 1) {
    const next = s.replace(/&amp;/gi, "&");
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/&nbsp;/gi, "\u00A0")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Sammenhengende prose: kun «ekte» tomme linjer (\n\n+) gir nytt <p>.
 * Enkelt linjeskift (mange bruker det som hard linjebryting) fløtes ut til mellomrom
 * slik at teksten kan bruke full bredde og brytes av nettleseren.
 *
 * Rekkefølge: bindestrek+linjeskift → fjern; \n\n+ → plassholder; gjenværende \n → mellomrom.
 */
export function splitProfileIntroParagraphs(raw) {
  const t = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\uE000/g, " ")
    .trim();
  if (!t) return [];
  const hyphenFixed = t.replace(/-\s*\n\s*/g, "");
  const withParaMarkers = hyphenFixed.replace(/\n{2,}/g, PARA_BREAK);
  const flattened = withParaMarkers.replace(/\n/g, " ");
  return flattened
    .split(PARA_BREAK)
    .map((block) => decodeHtmlEntitiesForDisplay(block.replace(/\s+/g, " ").trim()))
    .filter(Boolean);
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
    .map((block) =>
      decodeHtmlEntitiesForDisplay(block.replace(/-\s*\n\s*/g, "").trim()),
    )
    .filter(Boolean);
}

/**
 * Samme bindestrek-fiks som over, men uten å dele i avsnitt – for strenger som senere splittes
 * på komma (ferdigheter i bedriftsvisning).
 */
export function normalizeCvHyphens(raw) {
  return String(raw ?? "").replace(/\r\n/g, "\n").replace(/-\s*\n\s*/g, "");
}
