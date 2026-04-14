/** Gammel global nøkkel (før tema ble per konto). Migreres én gang i AuthContext. */
export const LEGACY_THEME_STORAGE_KEY = "jobportal-theme";

const THEME_UID_PREFIX = "jobportal-theme-uid:";

/** Lokal cache per bruker slik at mørk modus kommer tilbake umiddelbart etter ny innlogging. */
export function cacheThemeForUid(uid, mode) {
  if (!uid || (mode !== "light" && mode !== "dark")) return;
  try {
    localStorage.setItem(THEME_UID_PREFIX + uid, mode);
  } catch {
    /* ignore */
  }
}

export function readCachedThemeForUid(uid) {
  if (!uid) return null;
  try {
    const s = localStorage.getItem(THEME_UID_PREFIX + uid);
    if (s === "dark" || s === "light") return s;
  } catch {
    /* ignore */
  }
  return null;
}

/** Kjør før React (main.jsx). Faktisk tema settes når innlogget bruker lastes (Firestore). */
export function initTheme() {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", "light");
}

export function getTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** Oppdaterer kun DOM. Vedvarende valg lagres i Firestore som `users/{uid}.themePreference`. */
export function setTheme(mode) {
  if (mode !== "light" && mode !== "dark") return;
  document.documentElement.setAttribute("data-theme", mode);
}
