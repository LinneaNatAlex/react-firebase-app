import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import {
  getMergedNotificationSettings,
  saveNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../services/notifications";
import AccountDeletionSection from "./AccountDeletionSection";
import BlockedUsersPanel from "./BlockedUsersPanel";
import { setTheme, cacheThemeForUid } from "../theme";

function ToggleRow({ id, label, description, checked, disabled, onChange }) {
  return (
    <div className={`notification-settings-row${disabled ? " notification-settings-row--disabled" : ""}`}>
      <div className="notification-settings-row-text">
        <label htmlFor={id}>{label}</label>
        {description ? <p className="notification-settings-desc">{description}</p> : null}
      </div>
      <input
        id={id}
        type="checkbox"
        className="notification-settings-toggle"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

export default function NotificationSettingsPanel() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const isJobseeker = userData?.userType === "jobseeker";
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_NOTIFICATION_SETTINGS }));
  const [darkMode, setDarkMode] = useState(
    () => userData?.themePreference === "dark",
  );
  const [darkModeSaving, setDarkModeSaving] = useState(false);

  useEffect(() => {
    setDarkMode(userData?.themePreference === "dark");
  }, [userData?.themePreference]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const merged = await getMergedNotificationSettings(db, currentUser.uid);
        if (!cancelled) setSettings(merged);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Kunne ikke laste varslingsinnstillinger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  async function patch(partial) {
    if (!currentUser?.uid) return;
    const prev = { ...settings };
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaving(true);
    try {
      await saveNotificationSettings(db, currentUser.uid, partial);
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke lagre innstillinger.");
      setSettings(prev);
    }
    setSaving(false);
  }

  const masterOn = settings.notificationsEnabled;

  async function handleDarkMode(checked) {
    if (!currentUser?.uid) return;
    const mode = checked ? "dark" : "light";
    const prev = darkMode;
    setTheme(mode);
    setDarkMode(checked);
    setDarkModeSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        themePreference: mode,
      });
      cacheThemeForUid(currentUser.uid, mode);
      await refreshUserData();
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke lagre mørk modus.");
      setTheme(prev ? "dark" : "light");
      setDarkMode(prev);
    } finally {
      setDarkModeSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <p className="loading-text">Laster innstillinger…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-content notification-settings-page">
      <header className="dashboard-header">
        <div>
          <h1>Instillinger</h1>
          <p>
            {isJobseeker ? (
              <>
                Utseende og varsler for kontoen din. Søknadsstatus finner du under{' '}
                <strong>Mine søknader</strong>.
              </>
            ) : (
              <>Utseende og varsler for bedriftskontoen din.</>
            )}
          </p>
        </div>
      </header>

      <section className="notification-settings-card">
        <h2 className="notification-settings-section-title">Utseende</h2>
        <ToggleRow
          id="theme-dark"
          label="Mørk modus"
          description="Mørk bakgrunn i hele appen. Valget lagres på kontoen din."
          checked={darkMode}
          disabled={darkModeSaving}
          onChange={handleDarkMode}
        />
      </section>

      <section className="notification-settings-card">
        <h2 className="notification-settings-section-title">Varsler</h2>
        <ToggleRow
          id="notif-master"
          label="Varsler på"
          description="Skru av for å ikke motta nye varsler i det hele tatt."
          checked={masterOn}
          disabled={saving}
          onChange={(v) => patch({ notificationsEnabled: v })}
        />
      </section>

      {isJobseeker ? (
        <section className="notification-settings-card">
          <h2 className="notification-settings-section-title">Søknader</h2>
          <ToggleRow
            id="notif-app-status"
            label="Statusendringer"
            description="Når en bedrift endrer status (f.eks. gjennomgått, til intervju, akseptert eller avslått)."
            checked={settings.applicationStatusChanges}
            disabled={saving || !masterOn}
            onChange={(v) => patch({ applicationStatusChanges: v })}
          />
          <ToggleRow
            id="notif-app-msg"
            label="Meldinger fra bedrift"
            description="Når bedriften legger inn en melding til deg (f.eks. ved intervjuinvitasjon)."
            checked={settings.applicationCompanyMessages}
            disabled={saving || !masterOn}
            onChange={(v) => patch({ applicationCompanyMessages: v })}
          />
        </section>
      ) : null}

      <section className="notification-settings-card">
        <h2 className="notification-settings-section-title">Meldinger</h2>
        <ToggleRow
          id="notif-chat"
          label="Nye chat-meldinger"
          description="Når noen sender deg en direktemelding (profil / bedrift)."
          checked={settings.chatMessages}
          disabled={saving || !masterOn}
          onChange={(v) => patch({ chatMessages: v })}
        />
      </section>

      <BlockedUsersPanel />

      <section className="notification-settings-card">
        <h2 className="notification-settings-section-title">Nettverk</h2>
        <ToggleRow
          id="notif-friend-req"
          label="Venneforespørsler"
          description="Når noen sender deg en venneforespørsel."
          checked={settings.socialFriendRequests}
          disabled={saving || !masterOn}
          onChange={(v) => patch({ socialFriendRequests: v })}
        />
        <ToggleRow
          id="notif-friend-ok"
          label="Godkjente venner"
          description="Når noen godtar venneforespørselen din."
          checked={settings.socialFriendAccepted}
          disabled={saving || !masterOn}
          onChange={(v) => patch({ socialFriendAccepted: v })}
        />
        <ToggleRow
          id="notif-follows"
          label="Følgere og følging"
          description="Når noen følger bedriften din eller bedrifter du følger."
          checked={settings.socialFollows}
          disabled={saving || !masterOn}
          onChange={(v) => patch({ socialFollows: v })}
        />
      </section>

      <AccountDeletionSection />

      {saving ? <p className="notification-settings-saving">Lagrer…</p> : null}
    </div>
  );
}
