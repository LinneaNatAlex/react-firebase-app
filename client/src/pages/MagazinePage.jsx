import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../config/brand';
import { MAGAZINE_NAME, MAGAZINE_TAGLINE } from '../config/magazine';
import '../styles/MagazinePage.css';

/**
 * Forside for Utblikk — offentlig redaksjonell side.
 * Artikkel-lister og enkeltartikler kobles på i neste steg (Firestore).
 */
export default function MagazinePage() {
  return (
    <div className="magazine-page">
      <header className="magazine-masthead">
        <p className="magazine-kicker">{BRAND_NAME}</p>
        <h1 className="magazine-title">{MAGAZINE_NAME}</h1>
        <p className="magazine-tagline">{MAGAZINE_TAGLINE}</p>
      </header>

      <div className="magazine-layout">
        <main className="magazine-main">
          <article className="magazine-placeholder-card" aria-live="polite">
            <h2 className="magazine-placeholder-title">Velkommen til {MAGAZINE_NAME}</h2>
            <p>
              Her kan alt fra plattformnyheter og bedriftsstemmer til bredere temaer og debatt ligge — ikke bare
              stillinger og rekruttering. Når innhold er publisert, vises det i en liste her, nyeste først.
            </p>
            <p className="magazine-placeholder-muted">
              Teknisk oppsett (database og redigeringsverktøy) kommer i neste steg.
            </p>
          </article>
        </main>

        <aside className="magazine-rail" aria-label="Ekstra">
          <div className="magazine-rail-box">
            <h3>Mest lest</h3>
            <p className="magazine-rail-muted">
              Når lesing logges, kan du vise de mest leste sakene her.
            </p>
          </div>
        </aside>
      </div>

      <p className="magazine-footer-nav">
        <Link to="/">← Til forsiden</Link>
        {' · '}
        <Link to="/jobs">Ledige stillinger</Link>
      </p>
    </div>
  );
}
