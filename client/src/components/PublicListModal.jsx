/**
 * Enkel modal for lister (følgere, bedrifter fulgt, osv.)
 */
export default function PublicListModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="public-profile-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="public-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-list-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="public-profile-modal-header">
          <h2 id="public-list-modal-title" className="public-profile-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="public-profile-modal-close"
            onClick={onClose}
            aria-label="Lukk"
          >
            ×
          </button>
        </div>
        <div className="public-profile-modal-body">{children}</div>
      </div>
    </div>
  );
}
