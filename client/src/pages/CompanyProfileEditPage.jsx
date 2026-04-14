// Rediger offentlig bedriftsprofil (synlig for besøkende på /bedrift/:id)

import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { doc, updateDoc, getDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { syncPublicCompanyProfile } from "../services/companyProfile";
import NotificationSettingsPanel from "../components/NotificationSettingsPanel";
import "../styles/CompanyProfilePage.css";
import "../styles/Dashboard.css";

const LOGO_MAX_BYTES = 750 * 1024;

function CompanyProfileEditPage() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const logoInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyLogo, setCompanyLogo] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    companyAbout: "",
    website: "",
    industry: "",
    hqLocation: "",
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("company-profile-hide-scrollbar");
    return () => root.classList.remove("company-profile-hide-scrollbar");
  }, []);

  useEffect(() => {
    if (!userData) return;
    setForm({
      companyName: userData.companyName || "",
      companyAbout:
        userData.companyAbout != null ? String(userData.companyAbout) : "",
      website:
        userData.companyWebsite != null ? String(userData.companyWebsite) : "",
      industry:
        userData.companyIndustry != null
          ? String(userData.companyIndustry)
          : "",
      hqLocation:
        userData.companyHqLocation != null
          ? String(userData.companyHqLocation)
          : "",
    });
    setCompanyLogo(
      userData.companyImage != null ? String(userData.companyImage) : "",
    );
  }, [
    userData?.companyName,
    userData?.companyAbout,
    userData?.companyWebsite,
    userData?.companyIndustry,
    userData?.companyHqLocation,
    userData?.companyImage,
  ]);

  // Ett gangs synk til offentlig profil hvis bedriften har data i users men ikke i companyProfiles ennå
  useEffect(() => {
    let cancelled = false;
    async function seedPublicProfile() {
      if (!currentUser || !userData) return;
      try {
        const pub = await getDoc(doc(db, "companyProfiles", currentUser.uid));
        if (cancelled || pub.exists()) return;
        const name = (userData.companyName || "").trim();
        const about =
          userData.companyAbout != null && String(userData.companyAbout).trim()
            ? String(userData.companyAbout).trim()
            : "";
        if (!name && !about) return;
        const seedPayload = {
          companyName: name || "Bedrift",
          companyAbout: about,
          website: userData.companyWebsite || "",
          industry: userData.companyIndustry || "",
          hqLocation: userData.companyHqLocation || "",
        };
        if (userData.companyImage) {
          seedPayload.companyImage = String(userData.companyImage);
        }
        await syncPublicCompanyProfile(db, currentUser.uid, seedPayload);
      } catch (e) {
        console.warn("Kunne ikke opprette offentlig profil automatisk:", e);
      }
    }
    seedPublicProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser, userData]);

  async function persistProfileToFirestore() {
    if (!currentUser) return;
    const name = form.companyName.trim();
    const logo = companyLogo;

    const userPatch = {
      companyName: name,
      companyAbout: form.companyAbout.trim(),
      companyWebsite: form.website.trim(),
      companyIndustry: form.industry.trim(),
      companyHqLocation: form.hqLocation.trim(),
    };
    if (logo && String(logo).trim()) {
      userPatch.companyImage = String(logo).trim();
    } else {
      userPatch.companyImage = deleteField();
    }

    await updateDoc(doc(db, "users", currentUser.uid), userPatch);
    await syncPublicCompanyProfile(db, currentUser.uid, {
      companyName: name,
      companyAbout: form.companyAbout,
      website: form.website,
      industry: form.industry,
      hqLocation: form.hqLocation,
      companyImage: logo && String(logo).trim() ? String(logo).trim() : "",
    });
    await refreshUserData();
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentUser) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Velg en bildefil (PNG eller JPG).");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(
        `Bildet er for stort. Maks ${Math.round(LOGO_MAX_BYTES / 1024)} KB.`,
      );
      return;
    }
    setUploadingLogo(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setCompanyLogo(base64);
      const name =
        form.companyName.trim() || userData?.companyName || "Bedrift";
      const userPatch = {
        companyName: name,
        companyAbout: form.companyAbout.trim(),
        companyWebsite: form.website.trim(),
        companyIndustry: form.industry.trim(),
        companyHqLocation: form.hqLocation.trim(),
        companyImage: base64,
      };
      await updateDoc(doc(db, "users", currentUser.uid), userPatch);
      await syncPublicCompanyProfile(db, currentUser.uid, {
        companyName: name,
        companyAbout: form.companyAbout,
        website: form.website,
        industry: form.industry,
        hqLocation: form.hqLocation,
        companyImage: base64,
      });
      await refreshUserData();
      toast.success("Logoen er lagret");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke laste opp logo.");
    }
    setUploadingLogo(false);
  }

  async function handleRemoveLogo() {
    if (!currentUser) return;
    setUploadingLogo(true);
    try {
      setCompanyLogo("");
      await updateDoc(doc(db, "users", currentUser.uid), {
        companyImage: deleteField(),
      });
      await syncPublicCompanyProfile(db, currentUser.uid, {
        companyName:
          form.companyName.trim() || userData?.companyName || "Bedrift",
        companyAbout: form.companyAbout,
        website: form.website,
        industry: form.industry,
        hqLocation: form.hqLocation,
        companyImage: "",
      });
      await refreshUserData();
      toast.success("Logo fjernet");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke fjerne logo.");
    }
    setUploadingLogo(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    const name = form.companyName.trim();
    if (!name) {
      toast.warning("Bedriftsnavn kan ikke være tomt");
      return;
    }
    setSaving(true);
    try {
      await persistProfileToFirestore();
      toast.success("Bedriftsprofil lagret");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre. Sjekk tilkobling og Firestore-regler.");
    }
    setSaving(false);
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/bedrift/${currentUser?.uid || ""}`
      : "";

  const settingsTab = searchParams.get("tab") === "settings";

  return (
    <div className="company-profile-edit-page">
      <div className="company-profile-edit-inner">
        <header className="company-profile-edit-header">
          <Link to="/dashboard/company" className="company-profile-back">
            ← Tilbake til dashboard
          </Link>
          <h1>Bedriftsprofil</h1>
          <p className="company-profile-lead">
            Dette vises for besøkende (f.eks. privatpersoner) på en egen side.
            Samme «Om bedriften»-tekst brukes i gratis-mal og AI-utkast for nye
            stillinger (etter at du har lagret her).
          </p>
          {currentUser?.uid ? (
            <p className="company-profile-public-link">
              Offentlig lenke:{" "}
              <Link
                to={`/bedrift/${currentUser.uid}`}
                target="_blank"
                rel="noreferrer"
              >
                {publicUrl}
              </Link>
            </p>
          ) : null}
        </header>

        <nav className="company-profile-tabs" aria-label="Profil eller innstillinger">
          <button
            type="button"
            className={`company-profile-tab${!settingsTab ? " company-profile-tab--active" : ""}`}
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Profil
          </button>
          <button
            type="button"
            className={`company-profile-tab${settingsTab ? " company-profile-tab--active" : ""}`}
            onClick={() => setSearchParams({ tab: "settings" }, { replace: true })}
          >
            Instillinger
          </button>
        </nav>

        {settingsTab ? (
          <NotificationSettingsPanel />
        ) : null}

        {!settingsTab ? (
        <form className="company-profile-form" onSubmit={handleSubmit}>
          <div className="company-profile-logo-block">
            <label className="company-profile-logo-label">Bedriftslogo</label>
            <div className="company-profile-logo-row">
              <div className="company-profile-logo-preview">
                {companyLogo ? (
                  <img src={companyLogo} alt="" />
                ) : (
                  <span
                    className="company-profile-logo-placeholder"
                    aria-hidden
                  >
                    {(form.companyName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="company-profile-logo-actions">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="visually-hidden"
                  onChange={handleLogoFile}
                />
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo
                    ? "Vent…"
                    : companyLogo
                      ? "Bytt logo"
                      : "Last opp logo"}
                </button>
                {companyLogo ? (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                  >
                    Fjern
                  </button>
                ) : null}
                <p className="company-profile-hint">
                  PNG eller JPG, maks {Math.round(LOGO_MAX_BYTES / 1024)} KB.
                  Vises på den offentlige profilen.
                </p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cp-name">Bedriftsnavn *</label>
            <input
              id="cp-name"
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
              required
              placeholder="F.eks. Nordlys AS"
            />
          </div>

          <div className="form-row company-profile-form-row">
            <div className="form-group">
              <label htmlFor="cp-industry">Bransje (valgfritt)</label>
              <input
                id="cp-industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="F.eks. Teknologi, helse, handel"
              />
            </div>
            <div className="form-group">
              <label htmlFor="cp-hq">Hovedkontor / sted (valgfritt)</label>
              <input
                id="cp-hq"
                value={form.hqLocation}
                onChange={(e) =>
                  setForm({ ...form, hqLocation: e.target.value })
                }
                placeholder="F.eks. Trondheim"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cp-web">Nettside (valgfritt)</label>
            <input
              id="cp-web"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cp-about">Om bedriften</label>
            <textarea
              id="cp-about"
              rows={8}
              value={form.companyAbout}
              onChange={(e) =>
                setForm({ ...form, companyAbout: e.target.value })
              }
              placeholder="Hva dere gjør, størrelse, kultur, verdier – det besøkende bør vite før de søker eller tar kontakt."
            />
            <p className="company-profile-hint">
              AI-tilgang krever fortsatt kjøpt <code>aiPass</code>. Etter
              lagring brukes denne teksten automatisk i mal og AI for nye
              annonser.
            </p>
          </div>

          <div className="company-profile-form-actions">
            <Link to="/dashboard/company" className="button secondary">
              Avbryt
            </Link>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? "Lagrer…" : "Lagre profil"}
            </button>
          </div>
        </form>
        ) : null}
      </div>
    </div>
  );
}

export default CompanyProfileEditPage;
