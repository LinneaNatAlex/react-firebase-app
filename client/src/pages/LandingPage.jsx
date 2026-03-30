import { Link } from "react-router-dom";
import { BRAND_NAME, BRAND_TAGLINE } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_PATH } from "../config/magazine";
import "../styles/LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">{BRAND_TAGLINE}</p>
          <h1>Rekruttering uten unødig styr</h1>
          <p className="hero-subtitle">
            Samle annonser, søknader og CV på ett sted. Du velger selv hvor mye
            du vil bruke verktøyene, inkludert valgfri hjelp til tekst når du
            trenger det.
          </p>
          <div className="hero-buttons">
            <Link to="/register" className="button primary large">
              Opprett konto
            </Link>
            <Link to="/jobs" className="button secondary large">
              Se stillinger
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-panel hero-panel-a" />
          <div className="hero-panel hero-panel-b" />
          <div className="hero-panel hero-panel-c" />
        </div>
      </section>

      <section className="pillars">
        <div className="pillar">
          <span className="pillar-label">For bedrifter</span>
          <p>Publiser stilling, få oversikt over søkere og status underveis.</p>
        </div>
        <div className="pillar">
          <span className="pillar-label">For privatpersoner</span>
          <p>
            CV, søknadstekst og søknader samlet. Du ser svar og meldinger her.
          </p>
        </div>
        <div className="pillar">
          <span className="pillar-label">Åpent om verktøy</span>
          <p>Valgfri hjelp til annonse og tekst. Du styrer innholdet.</p>
        </div>
      </section>

      <section className="features">
        <h2>Det du faktisk får</h2>
        <p className="features-lead">
          Ikke bare én knapp som lover alt, men konkrete deler av flyten.
        </p>
        <div className="features-grid">
          <article className="feature-card">
            <span className="feature-num">01</span>
            <h3>Stillingsannonse</h3>
            <p>
              Skriv selv, eller bruk forslag som utgangspunkt og rediger i egen
              tone.
            </p>
          </article>

          <article className="feature-card">
            <span className="feature-num">02</span>
            <h3>Søknad og CV</h3>
            <p>
              Privatpersoner bygger profil og søknadstekst her, så bedriften ser
              hele bildet når du søker.
            </p>
          </article>

          <article className="feature-card">
            <span className="feature-num">03</span>
            <h3>Oversikt for bedriften</h3>
            <p>
              Søkere per stilling, status og meldinger, for eksempel ved
              intervju.
            </p>
          </article>

          <article className="feature-card">
            <span className="feature-num">04</span>
            <h3>Valgfri rangering</h3>
            <p>
              Kan brukes som støtte ved mange søkere. Beslutningen er fortsatt
              deres.
            </p>
          </article>
        </div>
      </section>

      <section className="for-whom">
        <h2>Hvem passer det for?</h2>
        <div className="for-whom-grid">
          <div className="for-whom-card">
            <h3>Bedrifter</h3>
            <ul>
              <li>Enkel publisering av stillinger</li>
              <li>Liste over søkere og detaljer</li>
              <li>Status og melding til kandidater</li>
            </ul>
            <Link to="/register?type=company" className="button primary">
              Registrer som bedrift
            </Link>
          </div>

          <div className="for-whom-card">
            <h3>Privatpersoner</h3>
            <ul>
              <li>Profil og CV-tekst på ett sted</li>
              <li>Søk på utlyste stillinger når du vil</li>
              <li>Se status og beskjeder fra arbeidsgivere</li>
            </ul>
            <Link to="/register?type=person" className="button secondary">
              Registrer som privatperson
            </Link>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Lyst å prøve?</h2>
        <p>Opprett konto og utforsk, uten salgstale i veien.</p>
        <Link to="/register" className="button primary large">
          Kom i gang
        </Link>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>{BRAND_NAME}</h3>
            <p>Jobb og søknad på ett sted.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Produkt</h4>
              <Link to="/jobs">Ledige stillinger</Link>
              <Link to={MAGAZINE_PATH}>{MAGAZINE_NAME}</Link>
              <Link to="/priser">Priser</Link>
              <Link to="/register">Registrering</Link>
              <Link to="/login">Logg inn</Link>
            </div>
            <div className="footer-column">
              <h4>Info</h4>
              <span className="footer-placeholder">Kontakt kommer</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
          <p className="ai-credit">
            Privatpersoner: lokale maler. Bedrifter: sky-AI (Groq) mot betaling
            – ingen gratis prøveperioder.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
