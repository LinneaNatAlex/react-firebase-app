// Vises når bedriften ikke har AI-tilgang (402) eller ved klikk før kjøp.

import { Link } from 'react-router-dom';

export default function AiPaywallModal({
  open,
  onClose,
  message,
  showPricingLink = true,
  title,
}) {
  if (!open) return null;
  const upgradeUrl = String(import.meta.env.VITE_AI_UPGRADE_URL || '').trim();
  const heading = title || 'AI krever tilgang';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{heading}</h2>
        <p className="template-hint" style={{ marginBottom: '1rem' }}>
          {message ||
            'Det finnes ingen gratis AI-prøver. Kjøp tilgang eller kontakt administrator for å aktivere AI for bedriften.'}
        </p>
        <div className="form-buttons" style={{ justifyContent: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          {showPricingLink ? (
            <>
              <Link to="/priser" className="button primary" onClick={onClose}>
                Se anbefalt pris og detaljer
              </Link>
              {upgradeUrl ? (
                <a
                  className="button secondary"
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gå til betaling
                </a>
              ) : null}
              <button type="button" className="button secondary" onClick={onClose}>
                Lukk
              </button>
            </>
          ) : (
            <button type="button" className="button primary" onClick={onClose}>
              Lukk
            </button>
          )}
        </div>
        {showPricingLink ? (
          <p className="form-hint" style={{ marginTop: '0.75rem' }}>
            På <Link to="/priser" onClick={onClose}>prissiden for bedrifter</Link> ser du anbefalt månedspris og hva som
            inngår.
          </p>
        ) : null}
      </div>
    </div>
  );
}
