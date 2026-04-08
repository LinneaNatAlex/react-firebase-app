import { useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import ConfirmModal from "./ConfirmModal";
import { scheduleAccountDeletion, DELETION_GRACE_MS } from "../services/accountDeletion";
import { BRAND_NAME } from "../config/brand";
import "../styles/ConfirmModal.css";

const DAYS = Math.round(DELETION_GRACE_MS / (24 * 60 * 60 * 1000));

export default function AccountDeletionSection() {
  const { currentUser, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  async function confirmDeletion() {
    if (!currentUser?.uid) return;
    setBusy(true);
    try {
      await scheduleAccountDeletion(db, currentUser.uid);
      await logout();
      toast.success("Konto merket for sletting. Du er nå logget ut.");
      setDeleteModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke starte kontosletting. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
          onClick={() => setDeleteModalOpen(true)}
        >
          Slett konto
        </button>
      </section>

      <ConfirmModal
        open={deleteModalOpen}
        title="Slette kontoen?"
        confirmLabel="Ja, start sletting"
        cancelLabel="Avbryt"
        variant="danger"
        confirmBusy={busy}
        onClose={() => {
          if (!busy) setDeleteModalOpen(false);
        }}
        onConfirm={confirmDeletion}
      >
        <p className="account-deletion-modal-lead">
          Er du sikker på at du vil slette kontoen din hos {BRAND_NAME}?
        </p>
        <ul className="account-deletion-modal-list">
          <li>Du blir logget ut nå.</li>
          <li>
            Hvis du logger inn igjen innen {DAYS} dager, avbrytes slettingen og kontoen beholdes.
          </li>
          <li>
            Hvis du ikke logger inn innen {DAYS} dager, slettes kontoen og tilknyttet data permanent fra våre
            systemer.
          </li>
        </ul>
      </ConfirmModal>
    </>
  );
}
