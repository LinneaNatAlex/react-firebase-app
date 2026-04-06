/**
 * Enkel bekreftelsesdialog — erstatter window.confirm med egen blokk.
 */

export default function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = "Bekreft",
  cancelLabel = "Avbryt",
  onConfirm,
  onClose,
  variant = "primary",
  confirmBusy = false,
}) {
  if (!open) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={confirmBusy ? undefined : onClose}
      role="presentation"
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h2>
        <div className="confirm-modal-body">{children}</div>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="magazine-editor-btn secondary"
            onClick={onClose}
            disabled={confirmBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              variant === "danger"
                ? "magazine-editor-btn danger-solid"
                : "magazine-editor-btn primary"
            }
            onClick={onConfirm}
            disabled={confirmBusy}
          >
            {confirmBusy ? "Vent…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
