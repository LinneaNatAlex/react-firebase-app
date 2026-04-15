import { Link } from "react-router-dom";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";

/** Kompakt lenker til personvern og vilkår (innhold fra CMS). */
export default function AuthLegalLinks() {
  const { content } = useSiteContent();
  const F = content.footer;
  return (
    <p className="auth-legal-links">
      <Link to="/personvern">{renderSiteText(F.linkPrivacy)}</Link>
      {" · "}
      <Link to="/vilkar">{renderSiteText(F.linkTerms)}</Link>
    </p>
  );
}
