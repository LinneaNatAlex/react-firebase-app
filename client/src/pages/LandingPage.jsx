import { Link } from "react-router-dom";
import { BRAND_NAME, BRAND_TAGLINE } from "../config/brand";
import { MAGAZINE_PATH } from "../config/magazine";
import { useAuth } from "../context/AuthContext";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";
import "../styles/LandingPage.css";

function LandingPage() {
  const { currentUser } = useAuth();
  const { content } = useSiteContent();
  const L = content.landing;
  const F = content.footer;
  const contactEmail = String(import.meta.env.VITE_CONTACT_EMAIL || "").trim();

  const t = (s) => renderSiteText(s ?? "");

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">{BRAND_TAGLINE}</p>
          <h1>{t(L.heroTitle)}</h1>
          <p className="hero-subtitle">{t(L.heroSubtitle)}</p>
          <div className="hero-buttons">
            <Link to="/register" className="button primary large">
              {t(L.heroBtnPrimary)}
            </Link>
            <Link to="/jobs" className="button secondary large">
              {t(L.heroBtnSecondary)}
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
          <span className="pillar-label">{t(L.pillar1Label)}</span>
          <p>{t(L.pillar1Text)}</p>
        </div>
        <div className="pillar">
          <span className="pillar-label">{t(L.pillar2Label)}</span>
          <p>{t(L.pillar2Text)}</p>
        </div>
        <div className="pillar">
          <span className="pillar-label">{t(L.pillar3Label)}</span>
          <p>{t(L.pillar3Text)}</p>
        </div>
      </section>

      <section className="features">
        <h2>{t(L.featuresTitle)}</h2>
        <p className="features-lead">{t(L.featuresLead)}</p>
        <div className="features-grid">
          <article className="feature-card">
            <span className="feature-num">01</span>
            <h3>{t(L.feature1Title)}</h3>
            <p>{t(L.feature1Text)}</p>
          </article>

          <article className="feature-card">
            <span className="feature-num">02</span>
            <h3>{t(L.feature2Title)}</h3>
            <p>{t(L.feature2Text)}</p>
          </article>

          <article className="feature-card">
            <span className="feature-num">03</span>
            <h3>{t(L.feature3Title)}</h3>
            <p>{t(L.feature3Text)}</p>
          </article>

          <article className="feature-card">
            <span className="feature-num">04</span>
            <h3>{t(L.feature4Title)}</h3>
            <p>{t(L.feature4Text)}</p>
          </article>
        </div>
      </section>

      <section className="for-whom">
        <h2>{t(L.forWhomTitle)}</h2>
        <p className="for-whom-intro">{t(L.forWhomIntro)}</p>
        <div className="for-whom-grid">
          <div className="for-whom-card">
            <h3>{t(L.companyCardTitle)}</h3>
            <ul>
              <li>{t(L.companyBullet1)}</li>
              <li>{t(L.companyBullet2)}</li>
              <li>{t(L.companyBullet3)}</li>
            </ul>
            <Link to="/register?type=company" className="button primary">
              {t(L.companyRegBtn)}
            </Link>
          </div>

          <div className="for-whom-card">
            <h3>{t(L.privateCardTitle)}</h3>
            <ul>
              <li>{t(L.privateBullet1)}</li>
              <li>{t(L.privateBullet2)}</li>
              <li>{t(L.privateBullet3)}</li>
            </ul>
            <Link to="/register?type=person" className="button secondary">
              {t(L.privateRegBtn)}
            </Link>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>{t(L.ctaTitle)}</h2>
        <p>{t(L.ctaText)}</p>
        <Link to="/register" className="button primary large">
          {t(L.ctaBtn)}
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
              <h4>{t(F.columnProdukt)}</h4>
              <Link to="/jobs">{t(F.linkJobs)}</Link>
              <Link to={MAGAZINE_PATH}>{t(F.linkMagazine)}</Link>
              {currentUser ? (
                <Link to="/priser">{t(F.linkPricing)}</Link>
              ) : null}
              <Link to="/register">{t(F.linkRegister)}</Link>
              <Link to="/login">{t(F.linkLogin)}</Link>
            </div>
            <div className="footer-column">
              <h4>{t(F.columnInfo)}</h4>
              <Link to="/om">{t(F.linkAbout)}</Link>
              <Link to="/faq">{t(F.linkFaq)}</Link>
              <Link to="/credits">{t(F.linkCredits)}</Link>
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`}>{t(F.linkContact)}</a>
              ) : (
                <Link to="/om#kontakt">{t(F.linkContact)}</Link>
              )}
            </div>
            <div className="footer-column">
              <h4>{t(F.columnLegal)}</h4>
              <Link to="/personvern">{t(F.linkPrivacy)}</Link>
              <Link to="/vilkar">{t(F.linkTerms)}</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
          {currentUser ? (
            <p className="ai-credit">{t(F.aiCredit)}</p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
