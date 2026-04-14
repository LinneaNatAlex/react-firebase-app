/**
 * Lesbare meldinger + hint når Firebase Google-innlogging feiler.
 * @param {import('firebase/auth').AuthError | Error} error
 * @returns {string}
 */
export function messageForGoogleAuthError(error) {
  const code = error?.code;
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Innlogging avbrutt.";
    case "auth/popup-blocked":
      return "Nettleseren blokkerte popup-vinduet. Tillat popup for denne siden og prøv igjen.";
    case "auth/unauthorized-domain":
      return "Dette domenet er ikke godkjent i Firebase. I Firebase Console: Authentication → Settings → Authorized domains – legg til localhost (eller ditt domene).";
    case "auth/operation-not-allowed":
      return "Google-innlogging er ikke skrudd på. I Firebase Console: Authentication → Sign-in method → Google → Enable.";
    case "auth/network-request-failed":
      return "Nettverksfeil. Sjekk internett og prøv igjen.";
    case "auth/account-exists-with-different-credential":
      return "Denne e-posten er allerede registrert med en annen innloggingsmetode. Bruk e-post/passord, eller kontakt support.";
    default:
      return (
        error?.message ||
        "Kunne ikke logge inn med Google. Sjekk Firebase-innstillinger (Google provider + authorized domains)."
      );
  }
}
