import { useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { scheduleAccountDeletion, DELETION_GRACE_MS } from "../services/accountDeletion";
import { BRAND_NAME } from "../config/brand";

const DAYS = Math.round(DELETION_GRACE_MS / (24 * 60 * 60 * 1000));

export default function AccountDeletionSection() {
  const { currentUser, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleRequestDeletion() {
    if (!currentUser?.uid) return;
    const msg =
      `Er du sikker på at du vil slette kontoen din hos ${BRAND_NAME}?\n\n` +
      `• Du blir logget ut nå.\n` +
      `• Hvis du logger inn igjen innen ${DAYS} dager, avbrytes slettingen og kontoen beholdes.\n` +
      `• Hvis du ikke logger inn innen ${DAYS} dager, slettes kontoen og tilknyttet data permanent fra våre systemer.\n\n` +
      `Trykk OK for å fortsette, eller Avbryt.`;

    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      await scheduleAccountDeletion(db, currentUser.uid);
      await logout();
      toast.success("Konto merket for sletting. Du er nå logget ut.");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke starte kontosletting. Prøv igjen.");
    }
    setBusy(false);
  }

  return (
    <section className="notification-settings-card account-deletion-section">
      <h2 className="notification-settings-section-title">Slett konto</h2>
      <p className="account-deletion-intro">
        Når du ber om sletting, logges du ut med en gang. Logger du inn igjen innen {DAYS} dager, avbrytes
        slettingen. Logger du ikke inn innen {DAYS} dager, slettes brukeren og tilknyttede data (så langt det
        lar seg gjøre fra appen) når du eventuelt prøver å logge inn etter fristen.
      </p>
      <button
        type="button"
        className="account-deletion-button"
        disabled={busy}
        onClick={handleRequestDeletion}
      >
        {busy ? "Behandler…" : "Slett konto"}
      </button>
    </section>
  );
}
