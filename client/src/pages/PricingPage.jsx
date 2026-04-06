// Priser: betaling gjelder kun bedrifter (AI). Privatpersoner bruker gratis lokale maler.

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BRAND_NAME } from "../config/brand";
import "../styles/PricingPage.css";

const GROQ_DOCS = "https://console.groq.com/docs/models";

/** Groq Llama 3.1 8B Instant – typiske listepriser (USD per 1M tokens) */
const GROQ_8B_INPUT_PER_M = 0.05;
const GROQ_8B_OUTPUT_PER_M = 0.08;
const USD_TO_NOK = 11;

/** Anbefalt månedspris for ubegrenset bedrifts-AI (juster etter marked) */
const RECOMMENDED_MONTHLY_NOK = 599;
const PRICE_RANGE_LOW = 399;
const PRICE_RANGE_HIGH = 899;

function usdToNok(usd) {
  return usd * USD_TO_NOK;
}

function estimateCallCostUsd(inputTokens, outputTokens) {
  return (
    (inputTokens / 1_000_000) * GROQ_8B_INPUT_PER_M +
    (outputTokens / 1_000_000) * GROQ_8B_OUTPUT_PER_M
  );
}

export default function PricingPage() {
  const { currentUser, userData } = useAuth();
  const stripeOrPayUrl = String(
    import.meta.env.VITE_AI_UPGRADE_URL || "",
  ).trim();
  const contactEmail = String(import.meta.env.VITE_CONTACT_EMAIL || "").trim();

  const isCompany = userData?.userType === "company";

  const examples = [
    {
      label: "Stillingsannonse (typisk)",
      inT: 600,
      outT: 1600,
    },
    {
      label: "AI-vurdering av søkere (større prompt)",
      inT: 12000,
      outT: 1800,
    },
  ];

  return (
    <div className="pricing-page">
      <div className="pricing-hero">
        <h1>Priser og AI for bedrifter</h1>
        <p className="lead">
          <strong>Betaling gjelder kun bedrifter.</strong> Privatpersoner bruker
          lokale maler i nettleseren – ingen sky-AI. For bedrifter finnes det{" "}
          <strong>ingen gratis prøveperiode på AI</strong>: tilgang aktiveres
          etter kjøp eller av administrator (<code>aiPass</code>).
        </p>
      </div>

      <div className="pricing-container">
        <h2 className="pricing-section-title">Privatpersoner – lokale maler</h2>
        <div className="pricing-callout" style={{ marginTop: "0.5rem" }}>
          <strong>Søknad og CV-hjelp skjer lokalt</strong> – uten sky-modell og
          uten betaling. Sky-AI er ikke en del av privatkontoen her.
        </div>

        <h2 className="pricing-section-title">RAG for bedrifter (valgfritt)</h2>
        <p className="template-hint" style={{ lineHeight: 1.65 }}>
          Når du setter <code>OPENAI_API_KEY</code> på serveren til embeddings,
          kan AI-stillingsutkast få med utdrag fra
          <strong> bedriftens egne tidligere annonser</strong> som
          stil-referanse (ikke ordrett kopiering). Dette er kun relevant for
          bedrifter som har kjøpt AI-tilgang.
        </p>

        <p className="template-hint" style={{ lineHeight: 1.65 }}>
          <strong>Språkmodell for bedrift:</strong> Velges på serveren (OpenAI-kompatibel API). Eksempler: Groq, Google Gemini, OpenRouter, Together, eller lokal{" "}
          <code>Ollama</code> (gratis etter oppsett på egen maskin/VPS).
        </p>

        <h2 className="pricing-section-title">
          Bedrifter – AI som tilleggstjeneste
        </h2>
        <div className="pricing-cards">
          <div className="pricing-card">
            <h3>Uten AI-tilgang</h3>
            <div className="price">0 kr</div>
            <p className="price-note">Standard for nye bedrifter</p>
            <ul>
              <li>Lokale maler for stillingstekst</li>
              <li>Lokal treff-score på søkere (uten språkmodell)</li>
              <li>Ingen sky-AI før dere kjøper tilgang</li>
            </ul>
            {currentUser && isCompany ? (
              <Link to="/dashboard/company" className="button secondary">
                Til bedriftsdashboard
              </Link>
            ) : currentUser && !isCompany ? (
              <p className="price-note" style={{ marginBottom: 0 }}>
                Du er logget inn som privatperson – prissettingen over gjelder
                bedrifter.
              </p>
            ) : (
              <Link to="/register" className="button secondary">
                Registrer bedrift
              </Link>
            )}
          </div>

          <div className="pricing-card featured">
            <h3>Ubegrenset AI (bedrift)</h3>
            <div className="price">{RECOMMENDED_MONTHLY_NOK} kr/mnd</div>
            <p className="price-note">
              Anbefalt utgangspunkt. Juster gjerne mellom ca. {PRICE_RANGE_LOW}–
              {PRICE_RANGE_HIGH} kr ut fra marked, antall annonser og hva
              konkurrentene tar.
            </p>
            <ul>
              <li>Ubegrenset AI-stillingsutkast og AI-vurdering av søkere</li>
              <li>Én pris per bedriftskonto (enkel forutsigbarhet)</li>
              <li>
                Rå API-kost med liten modell er vanligvis lav – prisen dekker
                drift, support og margin
              </li>
            </ul>
            {isCompany && stripeOrPayUrl ? (
              <a
                className="button primary"
                href={stripeOrPayUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Kjøp tilgang
              </a>
            ) : isCompany && contactEmail ? (
              <a
                className="button primary"
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Ubegrenset AI ${BRAND_NAME} (bedrift)`)}`}
              >
                Kontakt oss for tilgang
              </a>
            ) : !isCompany && currentUser ? (
              <Link to="/jobs" className="button secondary">
                Finn jobber
              </Link>
            ) : stripeOrPayUrl ? (
              <a
                className="button primary"
                href={stripeOrPayUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Kjøp tilgang (bedrift)
              </a>
            ) : contactEmail ? (
              <a
                className="button primary"
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Ubegrenset AI ${BRAND_NAME} (bedrift)`)}`}
              >
                Kontakt oss (bedrift)
              </a>
            ) : (
              <button
                type="button"
                className="button primary"
                disabled
                style={{ opacity: 0.8, cursor: "not-allowed" }}
              >
                Stripe kobles på her senere
              </button>
            )}
          </div>
        </div>

        <h2 className="pricing-section-title">
          Hvorfor ca. {RECOMMENDED_MONTHLY_NOK} kr/mnd?
        </h2>
        <p className="template-hint" style={{ lineHeight: 1.65 }}>
          Groq med en <strong>8B-modell</strong> gir ofte veldig lave kostnader
          per kall (se tabellen under). Likevel tar de fleste plattformer
          betaling som også dekker utvikling, support, risiko og avanse.{" "}
          <strong>
            {PRICE_RANGE_LOW}–{PRICE_RANGE_HIGH} kr/mnd
          </strong>{" "}
          per bedrift er et realistisk spenn for en norsk nisjeportal: du kan
          starte i nedre ende for å få volum, eller ligge høyere hvis du selger
          inn mot større arbeidsgivere.{" "}
          <strong>{RECOMMENDED_MONTHLY_NOK} kr</strong> er et greit midtpunkt å
          teste markedet med.
        </p>

        <h2 className="pricing-section-title">
          Hva koster det i Groq-gebyrer? (ca.)
        </h2>
        <p className="template-hint" style={{ marginBottom: "0.75rem" }}>
          Typisk modell: Llama 3.1 8B Instant. Sjekk alltid{" "}
          <a
            href="https://groq.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            groq.com/pricing
          </a>
          .
        </p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Eksempel (ca. tokens)</th>
              <th>Kostnad Groq 8B (ca.)</th>
            </tr>
          </thead>
          <tbody>
            {examples.map((ex) => {
              const usd = estimateCallCostUsd(ex.inT, ex.outT);
              const nok = usdToNok(usd);
              return (
                <tr key={ex.label}>
                  <td>
                    {ex.label}
                    <br />
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-muted)",
                      }}
                    >
                      ~{ex.inT.toLocaleString("nb-NO")} inn + ~
                      {ex.outT.toLocaleString("nb-NO")} ut
                    </span>
                  </td>
                  <td>
                    ~{usd < 0.0001 ? "< 0,0001" : usd.toFixed(4)} USD (~
                    {nok < 0.01 ? "< 0,01" : nok.toFixed(2)} kr)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pricing-callout">
          <strong>Kort sagt:</strong> med 8B er rå API ofte «billig per klikk».
          Månedsprisen til bedriften er i praksis et{" "}
          <strong>produkt-/tjenestegebyr</strong>, ikke en 1:1-refusjon av
          tokens.
        </div>

        <h2 className="pricing-section-title">
          Billigere alternativer (teknisk)
        </h2>
        <ul
          className="template-hint"
          style={{ lineHeight: 1.65, marginTop: "0.5rem" }}
        >
          <li>
            <strong>Annen leverandør:</strong> OpenRouter, Together, Fireworks –
            ofte lignende pris for små modeller.
          </li>
          <li>
            <strong>Egen maskin:</strong> Ollama + liten modell på VPS = fast
            månedssum, mer vedlikehold.
          </li>
        </ul>

        <h2 className="pricing-section-title">Ofte stilt</h2>
        <div className="pricing-faq">
          <details>
            <summary>Må privatpersoner betale for AI?</summary>
            <p>
              Nei. De bruker lokale maler. Sky-AI er bare for bedrifter
              som har kjøpt tilgang.
            </p>
          </details>
          <details>
            <summary>Finnes det gratis AI-prøver for bedrifter?</summary>
            <p>
              Nei. Bedriften må ha <code>aiPass</code> (betaling eller manuelt
              fra admin) før AI-knappene fungerer.
            </p>
          </details>
          <details>
            <summary>Er sky-AI dyrt?</summary>
            <p>
              For små modeller er det vanligvis ikke det som driver kostnaden –
              volum og valg av stor modell er det som merkes på regningen.
            </p>
          </details>
        </div>

        <p className="pricing-footnote">
          Anslag bruker {GROQ_8B_INPUT_PER_M} USD/M inn og{" "}
          {GROQ_8B_OUTPUT_PER_M} USD/M ut og ~{USD_TO_NOK} kr/USD – kun
          planlegging. Se også{" "}
          <a href={GROQ_DOCS} target="_blank" rel="noopener noreferrer">
            modell-dokumentasjon
          </a>
          .
        </p>

        <p style={{ marginTop: "1rem" }}>
          <Link to="/">← Til forsiden</Link>
          {" · "}
          <Link to="/jobs">Ledige stillinger</Link>
        </p>
      </div>
    </div>
  );
}
