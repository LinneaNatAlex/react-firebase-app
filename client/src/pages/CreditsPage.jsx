import { Link } from "react-router-dom";
import { useSiteContent } from "../context/SiteContentContext";
import { renderSiteText } from "../utils/siteText";
import "../styles/SiteInfoPages.css";

const HF_MODEL =
  "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const APACHE = "https://www.apache.org/licenses/LICENSE-2.0";
const ARXIV = "https://arxiv.org/abs/1908.10084";
const SBERT = "https://www.sbert.net/";

export default function CreditsPage() {
  const { content } = useSiteContent();
  const C = content.credits;
  const t = (s) => renderSiteText(s ?? "");

  return (
    <div className="site-info-page">
      <div className="site-info-inner">
        <h1>{t(C.title)}</h1>
        <p className="site-info-lead">{t(C.lead)}</p>

        <h2>Sentence embeddings (bedrifts-AI)</h2>
        <div className="credits-box">
          <p>
            Embedding for denne delen av tjenesten kan bruke modellen{" "}
            <em>paraphrase-multilingual-MiniLM-L12-v2</em> fra{" "}
            <a href={HF_MODEL} target="_blank" rel="noopener noreferrer">
              sentence-transformers på Hugging Face
            </a>
            , lisensiert under{" "}
            <a href={APACHE} target="_blank" rel="noopener noreferrer">
              Apache License 2.0
            </a>
            .
          </p>
          <p>
            Metodikk og opphav beskrives i Reimers &amp; Gurevych (2019),{" "}
            <a href={ARXIV} target="_blank" rel="noopener noreferrer">
              Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks
            </a>
            . Mer om prosjektet:{" "}
            <a href={SBERT} target="_blank" rel="noopener noreferrer">
              sbert.net
            </a>
            .
          </p>
        </div>
        <p style={{ fontSize: "0.9rem", color: "var(--color-muted)" }}>
          {t(C.disclaimer)}
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link to="/">Til forsiden</Link>
          {" · "}
          <Link to="/faq">Ofte stilte spørsmål</Link>
        </p>
      </div>
    </div>
  );
}
