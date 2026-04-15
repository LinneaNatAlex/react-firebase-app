import { Link } from "react-router-dom";
import { BRAND_NAME } from "../config/brand";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";
import "../styles/SiteInfoPages.css";

export default function FaqPage() {
  const { content } = useSiteContent();
  const P = content.faqPage;
  const t = (s) => renderSiteText(s ?? "");

  return (
    <div className="site-info-page">
      <div className="site-info-inner">
        <h1>{t(P.title)}</h1>
        <p className="site-info-lead">{t(P.lead)}</p>

        <div className="faq-list">
          {content.faq.map((item, i) => (
            <div key={i} className="faq-item">
              <h2>{t(item.q)}</h2>
              <p
                dangerouslySetInnerHTML={{
                  __html: t(item.a),
                }}
              />
            </div>
          ))}
        </div>

        <p style={{ marginTop: "2rem" }}>
          <Link to="/">Til forsiden</Link>
          {" · "}
          <Link to="/om">Om {BRAND_NAME}</Link>
        </p>
      </div>
    </div>
  );
}
