/** Brukervennlig tekst for vanlige Firebase Google-feil */

export function messageForGoogleAuthError(error, { cancelMessage } = {}) {
  const code = error?.code;
  if (code === "auth/popup-closed-by-user") {
    return cancelMessage ?? "Avbrutt";
  }
  if (code === "auth/unauthorized-domain") {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "";
    return (
      `Google tillates ikke fra dette domenet ennå (${host || "ukjent"}). ` +
      "I Firebase Console: Authentication → Settings → Authorized domains → Add domain. " +
      `Legg til nøyaktig: ${host || "f.eks. sprang.netlify.app"} (uten https). ` +
      "Lagre og vent et minutt, deretter prøv igjen."
    );
  }
  return null;
}
