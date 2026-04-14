// Priser: betaling gjelder kun bedrifter (AI). Privatpersoner bruker gratis lokale maler.

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BRAND_NAME } from "../config/brand";
import "../styles/PricingPage.css";

/** Anbefalt månedspris for ubegrenset bedrifts-AI (juster etter marked) */
const RECOMMENDED_MONTHLY_NOK = 449;
const STARTER_MONTHLY_NOK = 249;
const STARTER_CALLS_PER_MONTH = 10;

export default function PricingPage() {
  const { currentUser, userData } = useAuth();
  const stripeOrPayUrl = String(
    import.meta.env.VITE_AI_UPGRADE_URL || "",
  ).trim();
  const contactEmail = String(import.meta.env.VITE_CONTACT_EMAIL || "").trim();

  const isCompany = userData?.userType === "company";
  const isJobseeker = userData?.userType === "jobseeker";
  /** Jobbsøkere: kun privatdel. Bedrifter: kun bedriftsdel. Utlogget/annet: full oversikt */
  const hideCompanyPricing = isJobseeker;
  const hidePrivatePricing = isCompany;
  const showFullPricing = !hideCompanyPricing && !hidePrivatePricing;

  return (
    <div className="pricing-page">
      <div className="pricing-hero">
        <h1>Priser</h1>
        <p className="lead">
          {hideCompanyPricing ? (
            <>
              Her ser du hva som gjelder for deg som privatperson: gratis
              grunnfunksjoner og valgfritt bibliotek-abonnement når det lanseres.
              Grunnleggende bruk som jobbsøker koster ikke noe.
            </>
          ) : hidePrivatePricing ? (
            <>
              Her ser du priser og tillegg for bedrifter: standard konto, valgfri
              AI-startpakke og ubegrenset AI. Maler og bibliotek er inkludert uten
              ekstra kostnad; AI er et separat tillegg uten gratis prøveperiode.
            </>
          ) : (
            <>
              Her ser du både privat- og bedriftspriser. Du kan lese alt uansett
              konto — men du må være riktig kontotype for å kjøpe. For små team
              som ansetter juniorer og nyutdannede gir malene og valgfri AI støtte
              uten at dere trenger et stort HR-apparat.
            </>
          )}
        </p>
      </div>

      <div className="pricing-container">
        {showFullPricing ? (
          <div className="pricing-callout" style={{ marginTop: "0.5rem" }}>
            <strong>Viktig å skille:</strong> Abonnementene under handler om to
            ulike ting: 1) privatpersoners lagring/gjenbruk av egne søknader, og
            2) bedrifters AI som tillegg.
          </div>
        ) : null}

        {!hidePrivatePricing ? (
          <>
            <h2 className="pricing-section-title">Privatpersoner</h2>
            <div className="pricing-cards" style={{ marginTop: "0.75rem" }}>
              <div className="pricing-card">
                <h3>Gratis</h3>
                <div className="price">0 kr</div>
                <p className="price-note">For de fleste</p>
                <ul>
                  <li>Send søknader og følg status</li>
                  <li>Lag utkast basert på egen CV</li>
                  <li>Søknadsbibliotek: se og gjenbruk de siste 10</li>
                  <li>Søk i tidligere tekster (bedrift/stilling/tekst)</li>
                  <li>Kopier/rediger for rask gjenbruk</li>
                </ul>
                {!currentUser ? (
                  <Link to="/register" className="button secondary">
                    Opprett privatkonto
                  </Link>
                ) : isCompany ? (
                  <p className="price-note" style={{ marginBottom: 0 }}>
                    Du er logget inn som bedrift — bytt til privatkonto for å bruke
                    denne delen.
                  </p>
                ) : (
                  <Link to="/dashboard/user" className="button secondary">
                    Til Min side
                  </Link>
                )}
              </div>
              <div className="pricing-card featured">
                <h3>Søknadsbibliotek+</h3>
                <div className="price">99 kr/mnd</div>
                <p className="price-note">For aktive jobbsøkere</p>
                <ul>
                  <li>Flere enn 10 lagrede søknader</li>
                  <li>Bedre historikk når du søker mye</li>
                  <li>Raskere gjenbruk på tvers av bransje/roller</li>
                  <li>Mer kontroll: rediger og rydd opp i biblioteket</li>
                  <li>Godt for “standard”-avsnitt du bruker ofte</li>
                </ul>
                <button
                  type="button"
                  className="button primary"
                  disabled
                  style={{ opacity: 0.8, cursor: "not-allowed" }}
                  title="Kobles til betaling senere"
                >
                  Abonnement kommer
                </button>
                {currentUser && !isJobseeker ? (
                  <p className="price-note" style={{ marginBottom: 0 }}>
                    Krever privatkonto for å abonnere.
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {hideCompanyPricing ? (
          <p className="pricing-account-type-hint">
            Representerer du en bedrift?{" "}
            <Link to="/login">Logg inn som bedrift</Link>
            {" · "}
            <Link to="/register?type=company">Registrer bedrift</Link>
            {" "}
            for å se priser og verktøy for arbeidsgivere.
          </p>
        ) : null}

        {!hideCompanyPricing ? (
          <>
            <h2 className="pricing-section-title">Bedrifter</h2>
            <div className="pricing-cards">
              <div className="pricing-card">
                <h3>Standard (uten AI)</h3>
                <div className="price">0 kr</div>
                <p className="price-note">Alltid tilgjengelig</p>
                <ul>
                  <li>Lokale maler for stillingstekst</li>
                  <li>Lokal treff-score på søkere (uten språkmodell)</li>
                  <li>Stillingsbibliotek for gjenbruk av egne tekster</li>
                  <li>Reduser tid på nye annonser med “kopier fra tidligere”</li>
                </ul>
                {currentUser && isCompany ? (
                  <Link to="/dashboard/company" className="button secondary">
                    Til bedriftsdashboard
                  </Link>
                ) : currentUser && !isCompany ? (
                  <p className="price-note" style={{ marginBottom: 0 }}>
                    Du er logget inn som privatperson — bedrifter registreres
                    separat.
                  </p>
                ) : (
                  <Link to="/register" className="button secondary">
                    Registrer bedrift
                  </Link>
                )}
              </div>

              <div className="pricing-card">
                <h3>AI Startpakke (bedrift)</h3>
                <div className="price">
                  {STARTER_MONTHLY_NOK} kr/mnd
                </div>
                <p className="price-note">
                  Begrenset antall AI-kall per måned
                </p>
                <ul>
                  <li>{STARTER_CALLS_PER_MONTH} AI-kall / måned</li>
                  <li>Passer små bedrifter som vil teste</li>
                  <li>RAG kan brukes til stil-referanser når AI skriver</li>
                  <li>Smart gjenbruk av egne tekster via bibliotek</li>
                </ul>
                {isCompany ? (
                  <button
                    type="button"
                    className="button secondary"
                    disabled
                    style={{ opacity: 0.85, cursor: "not-allowed" }}
                    title="Kobles til betaling senere"
                  >
                    Startpakke kommer
                  </button>
                ) : currentUser ? (
                  <button
                    type="button"
                    className="button secondary"
                    disabled
                    style={{ opacity: 0.85, cursor: "not-allowed" }}
                    title="Du må være logget inn som bedrift for å kjøpe"
                  >
                    Krever bedriftskonto
                  </button>
                ) : (
                  <Link to="/register" className="button secondary">
                    Registrer bedrift
                  </Link>
                )}
              </div>

              <div className="pricing-card featured">
                <h3>Ubegrenset AI (bedrift)</h3>
                <div className="price">{RECOMMENDED_MONTHLY_NOK} kr/mnd</div>
                <p className="price-note">AI som tillegg (ingen gratis prøveperiode)</p>
                <ul>
                  <li>Ubegrenset AI-stillingsutkast og AI-vurdering av søkere</li>
                  <li>Én pris per bedriftskonto (enkel forutsigbarhet)</li>
                  <li>Valgfri stil-referanse fra egne tidligere annonser (RAG)</li>
                  <li>Spare tid i rekruttering (førsteutkast + struktur)</li>
                  <li>Mer konsistent tone på tvers av annonser</li>
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
                ) : currentUser && !isCompany ? (
                  <button
                    type="button"
                    className="button secondary"
                    disabled
                    style={{ opacity: 0.85, cursor: "not-allowed" }}
                    title="Du må være logget inn som bedrift for å kjøpe"
                  >
                    Krever bedriftskonto
                  </button>
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

            {hidePrivatePricing ? (
              <p className="pricing-account-type-hint">
                Søker du jobb som privatperson?{" "}
                <Link to="/login">Logg inn</Link>
                {" · "}
                <Link to="/register?type=person">Registrer som privatperson</Link>
                {" "}
                for å se priser som gjelder kandidater.
              </p>
            ) : null}

            <h2 className="pricing-section-title">Detaljer (valgfritt)</h2>
            <div className="pricing-faq">
              <details>
                <summary>Hva betyr RAG?</summary>
                <p>
                  RAG er kort sagt en måte å <strong>finne frem</strong> relevante utdrag fra tekster
                  dere allerede har (f.eks. gamle stillingsannonser eller bibliotektekster).
                  <br />
                  <br />
                  RAG kan brukes på to måter:
                  <br />
                  <strong>1) Som støtte til AI:</strong> Når AI skal skrive et utkast, får den med
                  relevante utdrag som kontekst — det gir ofte mer riktig tone og mindre “generisk” tekst.
                  <br />
                  <strong>2) Som smart gjenbruk:</strong> Du kan bruke samme “finn frem”-logikk til å hente
                  tidligere tekster og gjenbruke dem direkte, uten at AI skriver noe nytt.
                </p>
              </details>
              <details>
                <summary>Hvorfor koster AI {RECOMMENDED_MONTHLY_NOK} kr/mnd?</summary>
                <p>
                  Bedrifts-AI prises som et tillegg fordi det koster å drifte (server, sikkerhet og
                  vedlikehold), og fordi det gir en forutsigbar månedsmodell for bedriften.
                  <br />
                  <br />
                  Merk: AI-verktøyene er under etablering og vil forbedres over tid.
                </p>
              </details>
              <details>
                <summary>Hvordan velge mellom Startpakke og Ubegrenset?</summary>
                <p>
                  <strong>Startpakke</strong> passer hvis dere bare trenger AI av og til — f.eks. 1–2 stillingsutkast
                  og noen få AI-vurderinger i måneden.
                  <br />
                  <br />
                  <strong>Ubegrenset</strong> passer hvis dere vil bruke AI jevnlig uten å tenke på kvoter.
                  <br />
                  <br />
                  Tips: Bruk bibliotek/RAG til å gjenbruke egne tekster når dere kan, og bruk AI når dere vil spare mest tid.
                </p>
              </details>
              <details>
                <summary>Må jeg bruke AI for å få nytte av RAG?</summary>
                <p>
                  Nei. RAG kan også brukes som et <strong>smart søk</strong> i egne tekster.
                  <br />
                  <br />
                  Praktisk eksempel: Du har AI-abonnement, men ønsker å begrense AI-kall. Da kan du
                  bruke biblioteket/RAG til å finne en tidligere annonse eller et “standard-avsnitt”
                  du har skrevet før, og gjenbruke det direkte.
                  <br />
                  <br />
                  Hvorfor dette er lettvint: du slipper å lete manuelt i gamle dokumenter, og du
                  slipper å be AI om å skrive alt fra bunnen hver gang.
                </p>
              </details>
              <details>
                <summary>Kan jeg se begge typer priser?</summary>
                <p>
                  Uten innlogging (eller i et privat vindu) ser du både privat- og
                  bedriftspriser her.
                  <br />
                  <br />
                  Er du innlogget som jobbsøker, viser vi bare kandidatdelen. Logg inn som
                  bedrift eller registrer bedrift for å se arbeidsgiverpriser i appen.
                  <br />
                  <br />
                  Er du innlogget som bedrift, viser vi bare arbeidsgiverdelen. Logg inn som
                  privatperson eller registrer deg som jobbsøker for å se priser som gjelder
                  kandidater.
                  <br />
                  <br />
                  Kjøp og aktivering av bedrifts-AI skjer når du er innlogget som bedrift og
                  det er satt opp.
                </p>
              </details>
            </div>
          </>
        ) : null}

        <p style={{ marginTop: "1rem" }}>
          <Link to="/">← Til forsiden</Link>
          {" · "}
          <Link to="/jobs">Ledige stillinger</Link>
        </p>
      </div>
    </div>
  );
}
