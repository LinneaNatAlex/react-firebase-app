import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_TAGLINE } from "../config/magazine";
import {
  buildListTeaserSentences,
  fetchMostReadArticles,
  fetchPublishedArticles,
  resolveTeaserImageUrl,
} from "../services/magazineArticles";
import "../styles/MagazinePage.css";

/**
 * Utblikk-forside: nyeste sak stor (hovedsak), eldre saker i rutenett (maks 3 per rad).
 */
export default function MagazinePage() {
  const [articles, setArticles] = useState([]);
  const [mostRead, setMostRead] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [list, popular] = await Promise.all([
          fetchPublishedArticles(40),
          fetchMostReadArticles(6),
        ]);
        if (!cancelled) {
          setArticles(list);
          setMostRead(popular);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setArticles([]);
          setMostRead([]);
          setLoadError(
            e?.message ||
              e?.code ||
              "Kunne ikke hente artikler. Sjekk Firestore-regler og nettverk.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function renderTeaser(a, variant) {
    const href = a.slug ? `/utblikk/sak/${encodeURIComponent(a.slug)}` : null;
    const maxSentences = variant === "featured" ? 5 : 3;
    const teaser = buildListTeaserSentences(a.excerpt, a.bodyHtml, maxSentences);
    const teaserImg = resolveTeaserImageUrl(a.coverImageUrl, a.bodyHtml);
    const cardClass =
      variant === "featured"
        ? "magazine-teaser-card magazine-teaser-card--featured"
        : "magazine-teaser-card magazine-teaser-card--grid";

    const inner = (
      <>
        {teaserImg ? (
          <div className="magazine-teaser-cover">
            <img
              src={teaserImg}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}
        <h2 className="magazine-teaser-title">{a.title}</h2>
        {teaser ? (
          <p className="magazine-teaser-excerpt">{teaser}</p>
        ) : null}
        <p className="magazine-teaser-meta">
          {a.authorName ? <span>{a.authorName}</span> : null}
          {a.publishedAt?.toDate?.() ? (
            <time dateTime={a.publishedAt.toDate().toISOString()}>
              {a.authorName ? " · " : null}
              {a.publishedAt.toDate().toLocaleDateString("no-NO")}
            </time>
          ) : null}
        </p>
      </>
    );

    if (!href) {
      return (
        <article className={`${cardClass} magazine-teaser-card--broken`}>
          {inner}
        </article>
      );
    }

    return (
      <Link to={href} className="magazine-teaser-card-link">
        <article className={cardClass}>{inner}</article>
      </Link>
    );
  }

  const featured = articles[0];
  const rest = articles.slice(1);

  const sidebarMostRead = useMemo(() => {
    if (mostRead.length > 0) return mostRead;
    if (articles.length === 0) return [];
    return [...articles].sort(sortPublishedByMostRead).slice(0, 6);
  }, [articles, mostRead]);

  return (
    <div className="magazine-page">
      <header className="magazine-masthead">
        <p className="magazine-kicker">{BRAND_NAME}</p>
        <h1 className="magazine-title">{MAGAZINE_NAME}</h1>
        <p className="magazine-tagline">{MAGAZINE_TAGLINE}</p>
      </header>

      <div className="magazine-layout">
        <main className="magazine-main">
          {loading ? (
            <p className="magazine-list-loading" aria-live="polite">
              Laster saker…
            </p>
          ) : loadError ? (
            <article className="magazine-placeholder-card" role="alert">
              <h2 className="magazine-placeholder-title">Kunne ikke laste Utblikk</h2>
              <p>{loadError}</p>
            </article>
          ) : articles.length === 0 ? (
            <article className="magazine-placeholder-card" aria-live="polite">
              <h2 className="magazine-placeholder-title">Velkommen til {MAGAZINE_NAME}</h2>
              <p>
                Her vises publiserte saker — nyheter, meninger og innsikt. Når redaksjonen publiserer
                artikler, dukker de opp her, nyeste først.
              </p>
            </article>
          ) : (
            <div className="magazine-front">
              {featured ? (
                <section
                  className="magazine-feature-block"
                  aria-labelledby="magazine-feature-heading"
                >
                  <p id="magazine-feature-heading" className="magazine-feature-eyebrow">
                    Hovedsak
                  </p>
                  {renderTeaser(featured, "featured")}
                </section>
              ) : null}

              {rest.length > 0 ? (
                <section
                  className="magazine-more-block"
                  aria-labelledby="magazine-more-heading"
                >
                  <h2 id="magazine-more-heading" className="magazine-more-saker-heading">
                    Flere saker
                  </h2>
                  <ul className="magazine-article-grid">
                    {rest.map((a) => (
                      <li key={a.id}>{renderTeaser(a, "grid")}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </main>

        <aside className="magazine-rail" aria-label="Mest lest">
          <div className="magazine-rail-box magazine-rail-box--mostread">
            <h3>Mest lest</h3>
            {loading ? (
              <p className="magazine-rail-muted">Laster…</p>
            ) : sidebarMostRead.length === 0 ? (
              <p className="magazine-rail-muted">
                Ingen saker å vise ennå. Listen fylles når lesere åpner artikler (visninger telles).
              </p>
            ) : (
              <ol className="magazine-mostread-list">
                {sidebarMostRead.map((item, index) => {
                  const href = item.slug
                    ? `/utblikk/sak/${encodeURIComponent(item.slug)}`
                    : null;
                  const views = Number(item.viewCount || 0);
                  return (
                    <li key={item.id}>
                      {href ? (
                        <Link to={href} className="magazine-mostread-link">
                          <span className="magazine-mostread-rank" aria-hidden>
                            {index + 1}
                          </span>
                          <span className="magazine-mostread-body">
                            <span className="magazine-mostread-title">{item.title}</span>
                            <span className="magazine-mostread-meta">
                              {views > 0 ? `${views.toLocaleString("no-NO")} visninger` : "Ny"}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <span className="magazine-mostread-fallback">{item.title}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <p className="magazine-footer-nav">
        <Link to="/">← Til forsiden</Link>
        {" · "}
        <Link to="/jobs">Ledige stillinger</Link>
      </p>
    </div>
  );
}
