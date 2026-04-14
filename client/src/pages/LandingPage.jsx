import { Link } from "react-router-dom";
import { BRAND_NAME, BRAND_TAGLINE } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_PATH } from "../config/magazine";
import { useAuth } from "../context/AuthContext";
import "../styles/LandingPage.css";

function LandingPage() {
  const { currentUser } = useAuth();

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">{BRAND_TAGLINE}</p>
          <h1>Første jobb og tidlig karriere — uten å drukne blant de mest erfarne</h1>
          <p className="hero-subtitle">
            Sprang er bygget for studenter, nyutdannede og bedrifter som vil
            bygge med unge talenter. Samle annonser, søknader og CV på ett sted,
            med valgfri hjelp til tekst når du trenger det. Du trenger ikke
            være student for å være med — alle som søker jobb eller ansetter er
            velkomne.
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
          <p>
            Rekrutter traineer, praksis, nyutdannede og andre roller — med
            oversikt over søkere og status underveis.
          </p>
        </div>
        <div className="pillar">
          <span className="pillar-label">For studenter og tidlig karriere</span>
          <p>
            CV, søknad og søknader samlet. Et alternativ der feed og søk ikke
            bare speiler de med lengst erfaring.
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
          Konkrete deler av flyten — ikke bare «én plattform» der erfarne
          profiler ofte dominerer søket.
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
        <p className="for-whom-intro">
          Naturlig for studenter og tidlig karriere — og for bedrifter som vil
          nå dem. Andre kandidater og arbeidsgivere er like velkomne.
        </p>
        <div className="for-whom-grid">
          <div className="for-whom-card">
            <h3>Bedrifter</h3>
            <ul>
              <li>Publiser stillinger som treffer juniorer og nyutdannede</li>
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
              <li>Søk på utlyste stillinger — også uten studentbevis</li>
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
            <p>{BRAND_TAGLINE}</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Produkt</h4>
              <Link to="/jobs">Ledige stillinger</Link>
              <Link to={MAGAZINE_PATH}>{MAGAZINE_NAME}</Link>
              {currentUser ? <Link to="/priser">Priser</Link> : null}
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
          {currentUser ? (
            <p className="ai-credit">
              Privatpersoner: lokale maler. Bedrifter: sky-AI mot betaling
              – ingen gratis prøveperioder.
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
