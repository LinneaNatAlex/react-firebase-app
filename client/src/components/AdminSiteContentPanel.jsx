import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import { useSiteContent } from "../context/SiteContentContext";
import {
  SITE_CONTENT_DEFAULTS,
} from "../config/siteContentDefaults";
import {
  mergeSiteContent,
  fetchSiteContent,
  saveSiteContent,
} from "../services/siteContent";

const LANDING_LABELS = {
  heroTitle: "Hovedtittel (hero)",
  heroSubtitle: "Ingress under hovedtittel",
  pillar1Label: "Søyle 1 — overskrift",
  pillar1Text: "Søyle 1 — tekst",
  pillar2Label: "Søyle 2 — overskrift",
  pillar2Text: "Søyle 2 — tekst",
  pillar3Label: "Søyle 3 — overskrift",
  pillar3Text: "Søyle 3 — tekst",
  featuresTitle: "Funksjoner — hovedoverskrift",
  featuresLead: "Funksjoner — ingress",
  feature1Title: "Kort 01 — tittel",
  feature1Text: "Kort 01 — tekst",
  feature2Title: "Kort 02 — tittel",
  feature2Text: "Kort 02 — tekst",
  feature3Title: "Kort 03 — tittel",
  feature3Text: "Kort 03 — tekst",
  feature4Title: "Kort 04 — tittel",
  feature4Text: "Kort 04 — tekst",
  forWhomTitle: "«Hvem passer det for?» — overskrift",
  forWhomIntro: "«Hvem passer det for?» — ingress",
  companyCardTitle: "Bedrift-kort — overskrift",
  privateCardTitle: "Privat-kort — overskrift",
  companyBullet1: "Bedrift-kort — punkt 1",
  companyBullet2: "Bedrift-kort — punkt 2",
  companyBullet3: "Bedrift-kort — punkt 3",
  privateBullet1: "Privat-kort — punkt 1",
  privateBullet2: "Privat-kort — punkt 2",
  privateBullet3: "Privat-kort — punkt 3",
  ctaTitle: "Nederste CTA — overskrift",
  ctaText: "Nederste CTA — tekst",
  heroBtnPrimary: "Knapp: Opprett konto (øverst)",
  heroBtnSecondary: "Knapp: Se stillinger",
  companyRegBtn: "Knapp: Registrer som bedrift",
  privateRegBtn: "Knapp: Registrer som privatperson",
  ctaBtn: "Knapp: Kom i gang (nederst)",
};

const ABOUT_LABELS = {
  pageTitle: "Sidetittel (H1)",
  headingValues: "Overskrift: Våre verdier",
  headingEmphasis: "Overskrift: Hva vi legger vekt på",
  headingBak: "Overskrift: Bak plattformen",
  headingKontakt: "Overskrift: Kontakt",
  contactPlaceholderHtml: "Tekst når kontakt-e-post ikke er satt (HTML tillatt)",
  intro1: "Ingress avsnitt 1",
  intro2: "Ingress avsnitt 2",
  values1: "Verdier — avsnitt 1",
  values2: "Verdier — avsnitt 2",
  values3: "Verdier — avsnitt 3",
  emphasis1: "Punktliste — punkt 1",
  emphasis2: "Punktliste — punkt 2",
  emphasis3: "Punktliste — punkt 3",
  priserLineNoEmail:
    "Linje om priser (uten kontakt-e-post på server). HTML: lenke til /priser",
  priserLineWithEmail:
    "Linje om priser (med kontakt-e-post). HTML: lenke til /priser",
  bak1: "Bak plattformen — avsnitt 1",
  bak2: "Bak plattformen — avsnitt 2",
};

const FOOTER_LABELS = {
  columnProdukt: "Kolonne — overskrift «Produkt»",
  columnInfo: "Kolonne — overskrift «Info»",
  linkJobs: "Lenke: Ledige stillinger",
  linkMagazine: "Lenke: Magasin (bruk {{magazine}})",
  linkPricing: "Lenke: Priser",
  linkRegister: "Lenke: Registrering",
  linkLogin: "Lenke: Logg inn",
  linkAbout: "Lenke: Om oss",
  linkFaq: "Lenke: FAQ",
  linkCredits: "Lenke: Åpne komponenter",
  linkContact: "Lenke: Kontakt",
  columnLegal: "Footer — kolonne «Juridisk» (overskrift)",
  linkPrivacy: "Footer — lenketekst til /personvern",
  linkTerms: "Footer — lenketekst til /vilkar",
  aiCredit: "Tekstlinje under copyright (kun innlogget)",
};

const CREDITS_LABELS = {
  title: "Sidetittel",
  lead: "Ingress",
  disclaimer: "Disclaimer under tekstboks",
};

const FAQ_PAGE_LABELS = {
  title: "Sidetittel",
  lead: "Ingress",
};

const LEGAL_LABELS = {
  privacyTitle: "Personvern — sidetittel (H1)",
  privacyBodyHtml: "Personvern — full tekst (HTML tillatt: h2, p, ul, lenker)",
  termsTitle: "Vilkår — sidetittel (H1)",
  termsBodyHtml: "Vilkår — full tekst (HTML tillatt)",
};

function Field({ label, value, onChange, rows = 3 }) {
  return (
    <label className="admin-site-field">
      <span className="admin-site-field-label">{label}</span>
      <textarea
        className="admin-site-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function AdminSiteContentPanel() {
  const { refresh: refreshPublicSite } = useSiteContent();
  const [draft, setDraft] = useState(() => mergeSiteContent({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchSiteContent();
      setDraft(next);
    } catch (e) {
      console.error(e);
      setError(e.message || "Kunne ikke laste innhold.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setLanding(key, v) {
    setDraft((d) => ({ ...d, landing: { ...d.landing, [key]: v } }));
  }
  function setAbout(key, v) {
    setDraft((d) => ({ ...d, about: { ...d.about, [key]: v } }));
  }
  function setFooter(key, v) {
    setDraft((d) => ({ ...d, footer: { ...d.footer, [key]: v } }));
  }
  function setCredits(key, v) {
    setDraft((d) => ({ ...d, credits: { ...d.credits, [key]: v } }));
  }
  function setFaqPage(key, v) {
    setDraft((d) => ({ ...d, faqPage: { ...d.faqPage, [key]: v } }));
  }

  function setLegal(key, v) {
    setDraft((d) => ({ ...d, legal: { ...d.legal, [key]: v } }));
  }

  function setFaqItem(i, field, v) {
    setDraft((d) => {
      const faq = [...d.faq];
      faq[i] = { ...faq[i], [field]: v };
      return { ...d, faq };
    });
  }

  function addFaq() {
    setDraft((d) => ({
      ...d,
      faq: [...d.faq, { q: "", a: "" }],
    }));
  }

  function removeFaq(i) {
    setDraft((d) => ({
      ...d,
      faq: d.faq.filter((_, j) => j !== i),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const user = auth.currentUser;
      if (!user || !user.uid) {
        setError("Ikke innlogget.");
        return;
      }
      await saveSiteContent(draft, user.uid);
      await refreshPublicSite();
      setMessage("Lagret. Nettsiden henter oppdatert tekst.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Lagring feilet. Sjekk Firestore-regler.");
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    if (
      !window.confirm(
        "Tilbakestill skjemaet til standardtekster (ikke lagret før du trykker Lagre)?",
      )
    )
      return;
    setDraft(mergeSiteContent({}));
    setMessage("Standardtekster lastet inn i skjema. Trykk Lagre for å publisere.");
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <p>Laster nettsideinnhold…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-content admin-site-content">
      <h1>Nettsideinnhold</h1>
      <p className="admin-site-intro">
        Rediger tekster på forsiden, Om oss, FAQ, footer, personvern/vilkår og
        Credits. Bruk <code>{"{{brand}}"}</code> og{" "}
        <code>{"{{magazine}}"}</code> der merkenavn skal inn. I FAQ og juridiske
        tekster kan du bruke HTML (overskrifter, lister, lenker). Juridiske
        maler må tilpasses virksomheten. Deploy{" "}
        <code>firestore.rules</code> etter første gangs lagring.
      </p>

      {error ? (
        <div className="auth-error" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <p className="admin-site-msg" role="status">
          {message}
        </p>
      ) : null}

      <div className="admin-site-actions">
        <button
          type="button"
          className="button primary"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Lagrer…" : "Lagre alt"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={saving}
          onClick={handleResetDefaults}
        >
          Last inn standardtekster
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={saving}
          onClick={load}
        >
          Avbryt endringer (hent på nytt)
        </button>
      </div>

      <section className="admin-site-section">
        <h2>Forside</h2>
        {Object.keys(SITE_CONTENT_DEFAULTS.landing).map((key) => (
          <Field
            key={key}
            label={LANDING_LABELS[key] || key}
            value={draft.landing[key] ?? ""}
            onChange={(v) => setLanding(key, v)}
            rows={
              ["heroSubtitle", "heroTitle"].includes(key)
                ? 4
                : key.startsWith("pillar") || key.startsWith("feature")
                  ? 3
                  : 2
            }
          />
        ))}
      </section>

      <section className="admin-site-section">
        <h2>Om oss</h2>
        {Object.keys(SITE_CONTENT_DEFAULTS.about).map((key) => (
          <Field
            key={key}
            label={ABOUT_LABELS[key] || key}
            value={draft.about[key] ?? ""}
            onChange={(v) => setAbout(key, v)}
            rows={
              key.includes("priserLine") || key === "contactPlaceholderHtml"
                ? 3
                : key.startsWith("bak") || key.startsWith("values")
                  ? 5
                  : 3
            }
          />
        ))}
      </section>

      <section className="admin-site-section">
        <h2>FAQ (side)</h2>
        {Object.keys(SITE_CONTENT_DEFAULTS.faqPage).map((key) => (
          <Field
            key={key}
            label={FAQ_PAGE_LABELS[key] || key}
            value={draft.faqPage[key] ?? ""}
            onChange={(v) => setFaqPage(key, v)}
            rows={key === "lead" ? 3 : 2}
          />
        ))}
      </section>

      <section className="admin-site-section">
        <h2>FAQ — spørsmål og svar</h2>
        {draft.faq.map((item, i) => (
          <div key={i} className="admin-site-faq-block">
            <div className="admin-site-faq-head">
              <span>Spørsmål {i + 1}</span>
              <button
                type="button"
                className="button secondary small"
                onClick={() => removeFaq(i)}
              >
                Fjern
              </button>
            </div>
            <Field
              label="Spørsmål"
              value={item.q}
              onChange={(v) => setFaqItem(i, "q", v)}
              rows={2}
            />
            <Field
              label="Svar (HTML tillatt for lenker)"
              value={item.a}
              onChange={(v) => setFaqItem(i, "a", v)}
              rows={5}
            />
          </div>
        ))}
        <button type="button" className="button secondary" onClick={addFaq}>
          Legg til spørsmål
        </button>
      </section>

      <section className="admin-site-section">
        <h2>Footer (forsiden)</h2>
        {Object.keys(SITE_CONTENT_DEFAULTS.footer).map((key) => (
          <Field
            key={key}
            label={FOOTER_LABELS[key] || key}
            value={draft.footer[key] ?? ""}
            onChange={(v) => setFooter(key, v)}
            rows={key === "aiCredit" ? 2 : 2}
          />
        ))}
      </section>

      <section className="admin-site-section">
        <h2>Personvern og vilkår</h2>
        <p className="admin-site-note">
          Sidene ligger på <code>/personvern</code> og <code>/vilkar</code>.
          Standardtekst er en mal — ikke juridisk rådgivning.
        </p>
        {Object.keys(SITE_CONTENT_DEFAULTS.legal).map((key) => (
          <Field
            key={key}
            label={LEGAL_LABELS[key] || key}
            value={draft.legal[key] ?? ""}
            onChange={(v) => setLegal(key, v)}
            rows={key.includes("Body") ? 22 : 2}
          />
        ))}
      </section>

      <section className="admin-site-section">
        <h2>Credits (åpne komponenter)</h2>
        <p className="admin-site-note">
          Teknisk boks med lenker til Hugging Face m.m. er fortsatt fast i koden;
          du kan redigere tittel og brødtekst her.
        </p>
        {Object.keys(SITE_CONTENT_DEFAULTS.credits).map((key) => (
          <Field
            key={key}
            label={CREDITS_LABELS[key] || key}
            value={draft.credits[key] ?? ""}
            onChange={(v) => setCredits(key, v)}
            rows={key === "lead" ? 4 : 3}
          />
        ))}
      </section>

      <div className="admin-site-actions" style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          className="button primary"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Lagrer…" : "Lagre alt"}
        </button>
      </div>
    </div>
  );
}
