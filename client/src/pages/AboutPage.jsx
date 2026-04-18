import { Link } from "react-router-dom";
import { BRAND_TAGLINE } from "../config/brand";
import { useSiteContent } from "../context/SiteContentContext";
import { getPublicContactEmail, renderSiteText } from "../utils/siteText";
import "../styles/SiteInfoPages.css";

export default function AboutPage() {
  const { content } = useSiteContent();
  const A = content.about;
  const contactEmail = getPublicContactEmail();
  const t = (s) => renderSiteText(s ?? "");

  const priserHtml = t(
    contactEmail ? A.priserLineWithEmail : A.priserLineNoEmail,
  );

  return (
    <div className="site-info-page">
      <div className="site-info-inner">
        <h1>{t(A.pageTitle)}</h1>
        <p className="site-info-lead">{BRAND_TAGLINE}</p>
        <p>{t(A.intro1)}</p>
        <p>{t(A.intro2)}</p>

        <h2>{t(A.headingValues)}</h2>
        <div className="site-info-values">
          <p>{t(A.values1)}</p>
          <p>{t(A.values2)}</p>
          <p>{t(A.values3)}</p>
        </div>

        <h2>{t(A.headingEmphasis)}</h2>
        <ul>
          <li>{t(A.emphasis1)}</li>
          <li>{t(A.emphasis2)}</li>
          <li>{t(A.emphasis3)}</li>
        </ul>

        <p
          dangerouslySetInnerHTML={{ __html: priserHtml }}
          className="site-info-priser-line"
        />

        <h2>{t(A.headingBak)}</h2>
        <p>{t(A.bak1)}</p>
        <p>{t(A.bak2)}</p>

        <h2 id="kontakt">{t(A.headingKontakt)}</h2>
        {contactEmail ? (
          <p>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        ) : (
          <p
            className="site-info-lead"
            style={{ marginBottom: 0 }}
            dangerouslySetInnerHTML={{
              __html: t(A.contactPlaceholderHtml),
            }}
          />
        )}
      </div>
    </div>
  );
}
