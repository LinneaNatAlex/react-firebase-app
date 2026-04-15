import { BRAND_NAME } from "../config/brand";
import { MAGAZINE_NAME } from "../config/magazine";

/** Bytt ut plassholdere i CMS-tekst ({{brand}}, {{magazine}}). */
export function renderSiteText(str, overrides = {}) {
  if (str == null || typeof str !== "string") return "";
  const brand = overrides.brand ?? BRAND_NAME;
  const magazine = overrides.magazine ?? MAGAZINE_NAME;
  return str
    .replace(/\{\{brand\}\}/g, brand)
    .replace(/\{\{magazine\}\}/g, magazine);
}
