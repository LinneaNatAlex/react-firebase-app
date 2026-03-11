import { Link } from 'react-router-dom';
import '../styles/LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Finn de beste kandidatene med AI</h1>
          <p className="hero-subtitle">
            JobbPortal bruker kunstig intelligens til å matche bedrifter 
            med de perfekte kandidatene. Spar tid og finn riktig person raskere.
          </p>
          <div className="hero-buttons">
            <Link to="/register" className="button primary large">
              Kom i gang gratis
            </Link>
            <Link to="/jobs" className="button secondary large">
              Se ledige stillinger
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-illustration">
            <span>🎯</span>
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="stat-item">
          <span className="stat-number">500+</span>
          <span className="stat-label">Bedrifter</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">10 000+</span>
          <span className="stat-label">Jobbsøkere</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">95%</span>
          <span className="stat-label">Fornøyde kunder</span>
        </div>
      </section>

      <section className="features">
        <h2>Hvorfor velge JobbPortal?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI-drevet matching</h3>
            <p>
              Vår AI analyserer CV-er og stillingsannonser for å finne 
              de beste kandidatene automatisk.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Spar tid</h3>
            <p>
              Automatisk screening reduserer tiden brukt på å gå 
              gjennom søknader med opptil 80%.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Smart stillingsannonser</h3>
            <p>
              AI hjelper deg å skrive engasjerende stillingsannonser 
              som tiltrekker de rette kandidatene.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Innsikt og analyse</h3>
            <p>
              Få detaljert statistikk over søkere, visninger og 
              konverteringsrater.
            </p>
          </div>
        </div>
      </section>

      <section className="for-whom">
        <h2>Hvem er JobbPortal for?</h2>
        <div className="for-whom-grid">
          <div className="for-whom-card">
            <h3>🏢 For bedrifter</h3>
            <ul>
              <li>Publiser stillingsannonser enkelt</li>
              <li>Få AI-rangerte kandidater</li>
              <li>Administrer hele rekrutteringsprosessen</li>
              <li>Spar tid og ressurser</li>
            </ul>
            <Link to="/register?type=company" className="button primary">
              Registrer bedrift
            </Link>
          </div>

          <div className="for-whom-card">
            <h3>👤 For jobbsøkere</h3>
            <ul>
              <li>Opprett profil og last opp CV</li>
              <li>Søk på relevante stillinger</li>
              <li>Få matchet med riktige jobber</li>
              <li>Følg søknadene dine</li>
            </ul>
            <Link to="/register?type=jobseeker" className="button secondary">
              Opprett profil
            </Link>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Klar til å revolusjonere rekrutteringen?</h2>
        <p>Start gratis i dag og se forskjellen AI kan gjøre.</p>
        <Link to="/register" className="button primary large">
          Kom i gang nå
        </Link>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>JobbPortal</h3>
            <p>AI-drevet rekruttering for fremtiden</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Produkt</h4>
              <a href="#">Funksjoner</a>
              <a href="#">Priser</a>
              <a href="#">FAQ</a>
            </div>
            <div className="footer-column">
              <h4>Selskap</h4>
              <a href="#">Om oss</a>
              <a href="#">Kontakt</a>
              <a href="#">Blogg</a>
            </div>
            <div className="footer-column">
              <h4>Juridisk</h4>
              <a href="#">Personvern</a>
              <a href="#">Vilkår</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 JobbPortal. Alle rettigheter reservert.</p>
          <p className="ai-credit">AI-funksjoner drevet av <a href="https://groq.com" target="_blank" rel="noopener noreferrer">Groq</a> med Llama 3.3</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
