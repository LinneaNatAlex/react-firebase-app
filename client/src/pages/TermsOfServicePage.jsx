import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "../config/brand";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";
import "../styles/SiteInfoPages.css";

export default function TermsOfServicePage() {
  const { content } = useSiteContent();
  const L = content.legal;
  const F = content.footer;
  const t = (s) => renderSiteText(s ?? "");

  useEffect(() => {
    const title = `${t(L.termsTitle)} | ${BRAND_NAME}`;
    document.title = title;
    return () => {
      document.title = BRAND_NAME;
    };
  }, [L.termsTitle]);

  return (
    <div className="site-info-page">
      <div className="site-info-inner legal-prose-wrap">
        <h1>{t(L.termsTitle)}</h1>
        <div
          className="legal-prose"
          dangerouslySetInnerHTML={{ __html: t(L.termsBodyHtml) }}
        />
        <p className="legal-back">
          <Link to="/">Til forsiden</Link>
          {" · "}
          <Link to="/personvern">{t(F.linkPrivacy)}</Link>
        </p>
      </div>
    </div>
  );
}
