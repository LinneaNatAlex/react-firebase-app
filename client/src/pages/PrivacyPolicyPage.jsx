import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "../config/brand";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";
import "../styles/SiteInfoPages.css";

export default function PrivacyPolicyPage() {
  const { content } = useSiteContent();
  const L = content.legal;
  const F = content.footer;
  const t = (s) => renderSiteText(s ?? "");

  useEffect(() => {
    const title = `${t(L.privacyTitle)} | ${BRAND_NAME}`;
    document.title = title;
    return () => {
      document.title = BRAND_NAME;
    };
  }, [L.privacyTitle]);

  return (
    <div className="site-info-page">
      <div className="site-info-inner legal-prose-wrap">
        <h1>{t(L.privacyTitle)}</h1>
        <div
          className="legal-prose"
          dangerouslySetInnerHTML={{ __html: t(L.privacyBodyHtml) }}
        />
        <p className="legal-back">
          <Link to="/">Til forsiden</Link>
          {" · "}
          <Link to="/vilkar">{t(F.linkTerms)}</Link>
        </p>
      </div>
    </div>
  );
}
