import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "react-quill/dist/quill.snow.css";
import { BRAND_NAME } from "../config/brand";
import { MAGAZINE_NAME, MAGAZINE_PATH } from "../config/magazine";
import {
  fetchArticleBySlug,
  incrementArticleViewCount,
} from "../services/magazineArticles";
import "../styles/MagazineArticlePage.css";

export default function MagazineArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      try {
        const a = await fetchArticleBySlug(slug);
        if (cancelled) return;
        if (!a) {
          setNotFound(true);
          setArticle(null);
        } else {
          setNotFound(false);
          setArticle(a);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setNotFound(true);
          setArticle(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!article?.id) return;
    const key = `utblikk_view_${article.id}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, "1");
    }
    incrementArticleViewCount(article.id).catch(() => {});
  }, [article?.id]);

  if (loading) {
    return (
      <div className="magazine-article-page">
        <p className="magazine-article-muted">Laster…</p>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="magazine-article-page">
        <h1>Fant ikke saken</h1>
        <p className="magazine-article-muted">
          Artikkelen finnes ikke eller er ikke publisert.
        </p>
        <p>
          <Link to={MAGAZINE_PATH}>← Til {MAGAZINE_NAME}</Link>
        </p>
      </div>
    );
  }

  const dateStr =
    article.publishedAt?.toDate?.()?.toLocaleDateString("no-NO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) ?? "";

  return (
    <article className="magazine-article-page">
      {article.coverImageUrl ? (
        <figure className="magazine-article-hero">
          <img
            src={article.coverImageUrl}
            alt=""
            loading="eager"
            decoding="async"
          />
        </figure>
      ) : null}

      <header className="magazine-article-header">
        <p className="magazine-article-kicker">
          {BRAND_NAME} · {MAGAZINE_NAME}
        </p>
        <h1 className="magazine-article-title">{article.title}</h1>
        <p className="magazine-article-meta">
          {article.authorName ? (
            <>
              <span>{article.authorName}</span>
              {dateStr ? <span> · {dateStr}</span> : null}
            </>
          ) : (
            dateStr || null
          )}
        </p>
      </header>

      {article.excerpt ? (
        <p className="magazine-article-lead">{article.excerpt}</p>
      ) : null}

      <div
        className="magazine-article-body ql-editor"
        dangerouslySetInnerHTML={{ __html: article.bodyHtml || "" }}
      />

      <p className="magazine-article-footer-nav">
        <Link to={MAGAZINE_PATH}>← Alle saker i {MAGAZINE_NAME}</Link>
        {" · "}
        <Link to="/">Forsiden</Link>
      </p>
    </article>
  );
}
