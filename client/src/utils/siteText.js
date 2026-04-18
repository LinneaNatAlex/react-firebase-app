import { BRAND_NAME } from "../config/brand";
import { MAGAZINE_NAME } from "../config/magazine";

/** Offentlig kontakt-e-post fra miljø (samme som brukes på Om oss / priser). */
export function getPublicContactEmail() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONTACT_EMAIL) {
    return String(import.meta.env.VITE_CONTACT_EMAIL).trim();
  }
  return "";
}

function contactEmailBlockHtml() {
  const email = getPublicContactEmail();
  if (email) {
    return `Kontakt for personvern og spørsmål om vilkår: <a href="mailto:${email}">${email}</a>.`;
  }
  return `Kontakt for personvern og spørsmål om vilkår: se <a href="/om#kontakt">Om oss</a> eller <a href="/faq">ofte stilte spørsmål</a>.`;
}

/**
 * Bytt ut plassholdere i CMS-tekst:
 * {{brand}}, {{magazine}}, {{contactEmailBlock}} (setning med lenker — brukes i personvern/vilkår).
 */
export function renderSiteText(str, overrides = {}) {
  if (str == null || typeof str !== "string") return "";
  const brand = overrides.brand ?? BRAND_NAME;
  const magazine = overrides.magazine ?? MAGAZINE_NAME;
  const contactBlock =
    overrides.contactEmailBlock ?? contactEmailBlockHtml();
  return str
    .replace(/\{\{brand\}\}/g, brand)
    .replace(/\{\{magazine\}\}/g, magazine)
    .replace(/\{\{contactEmailBlock\}\}/g, contactBlock);
}
