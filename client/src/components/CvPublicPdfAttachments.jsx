import { useRef, useState, useEffect, useCallback } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { db } from "../firebase";
import { storage } from "../firebase";
import { base64ToPdfBlob } from "../utils/pdfBase64Blob";

const MAX_FILES = 5;
/** Firestore-felt ~1 MiB; base64 øker ~33 % – hold rå PDF under dette. */
const MAX_BYTES = 650 * 1024;

function newPdfId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Offentlige CV-PDF-er lagres i Firestore: profiles/{uid}/publicPdfs/{id}
 * (base64 – ingen Firebase Storage nødvendig).
 * Eksisterende vedlegg fra Storage (downloadUrl i profilen) vises fortsatt.
 */
export default function CvPublicPdfAttachments({ profile, setProfile, userId, toast }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);

  const refreshList = useCallback(async () => {
    if (!userId) {
      setList([]);
      return;
    }
    const snap = await getDocs(collection(db, "profiles", userId, "publicPdfs"));
    const fromSub = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      source: "firestore",
    }));
    const legacy = (Array.isArray(profile?.cvPdfAttachments) ? profile.cvPdfAttachments : [])
      .filter((a) => a?.downloadUrl && a?.id && !fromSub.some((s) => s.id === a.id))
      .map((a) => ({ ...a, source: "legacy" }));
    const merged = [...fromSub, ...legacy].sort(
      (a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0),
    );
    setList(merged);
  }, [userId, profile?.cvPdfAttachments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshList();
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Kunne ikke laste PDF-liste.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    if (file.type !== "application/pdf") {
      toast.error("Kun PDF-filer er tillatt.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`PDF kan være maks ${Math.round(MAX_BYTES / 1024)} KB (lagres i database uten Storage).`);
      return;
    }
    if (list.length >= MAX_FILES) {
      toast.error(`Maks ${MAX_FILES} PDF-filer.`);
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const comma = String(dataUrl).indexOf(",");
      const base64 = comma >= 0 ? String(dataUrl).slice(comma + 1) : "";
      if (!base64) {
        toast.error("Kunne ikke lese filen.");
        setBusy(false);
        return;
      }

      const id = newPdfId();
      const label =
        file.name.replace(/\.pdf$/i, "").trim().slice(0, 80) || "Dokument";

      await setDoc(doc(db, "profiles", userId, "publicPdfs", id), {
        title: label,
        fileName: file.name,
        dataBase64: base64,
        uploadedAt: Date.now(),
        sizeBytes: file.size,
      });

      await refreshList();
      toast.success("PDF lagt til. Husk å lagre CV.");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre PDF. Prøv igjen.");
    }
    setBusy(false);
  }

  async function remove(id) {
    const att = list.find((a) => a.id === id);
    if (!att || !userId) return;
    setBusy(true);
    try {
      if (att.source === "firestore") {
        await deleteDoc(doc(db, "profiles", userId, "publicPdfs", id));
      } else if (att.storagePath) {
        try {
          await deleteObject(storageRef(storage, att.storagePath));
        } catch (e) {
          console.warn("deleteObject storage", e);
        }
        const next = (profile.cvPdfAttachments || []).filter((a) => a.id !== id);
        await updateDoc(doc(db, "profiles", userId), { cvPdfAttachments: next });
        setProfile({ ...profile, cvPdfAttachments: next });
      }
      await refreshList();
      toast.success(att.source === "firestore" ? "Fjernet." : "Fjernet. Husk å lagre CV.");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke fjerne filen.");
    }
    setBusy(false);
  }

  async function persistTitle(id, title) {
    const att = list.find((a) => a.id === id);
    if (!att || !userId) return;
    const t = title.slice(0, 120);
    if (att.source === "firestore") {
      setBusy(true);
      try {
        await updateDoc(doc(db, "profiles", userId, "publicPdfs", id), { title: t });
        await refreshList();
      } catch (e) {
        console.error(e);
        toast.error("Kunne ikke lagre tittel.");
      }
      setBusy(false);
      return;
    }
    const next = (profile.cvPdfAttachments || []).map((a) =>
      a.id === id ? { ...a, title: t } : a,
    );
    setProfile({ ...profile, cvPdfAttachments: next });
  }

  function openPdf(att) {
    if (att.downloadUrl) {
      window.open(att.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (att.dataBase64) {
      const blob = base64ToPdfBlob(att.dataBase64);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    }
  }

  return (
    <div className="cv-public-pdf-attachments">
      <div className="form-section-title form-section-title--accent">PDF til offentlig CV</div>
      <p className="form-hint cv-public-pdf-lead">
        Dokumenter som vises på CV-siden under «Kontakt» – for eksempel CV som PDF, eller andre
        vedlegg arbeidsgivere kan laste ned. Lagres i databasen (maks{" "}
        {Math.round(MAX_BYTES / 1024)} KB per fil) – du trenger ikke Firebase Storage.
      </p>

      {list.length > 0 ? (
        <ul className="cv-public-pdf-list">
          {list.map((a) => (
            <li key={a.id} className="cv-public-pdf-row">
              <div className="cv-public-pdf-row-fields">
                <label className="cv-public-pdf-label">
                  <input
                    type="text"
                    value={a.title || ""}
                    onChange={(e) =>
                      setList((prev) =>
                        prev.map((x) =>
                          x.id === a.id ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                    onBlur={(e) => void persistTitle(a.id, e.target.value)}
                    placeholder="Tittel (f.eks. CV, Attest)"
                    disabled={busy}
                    aria-label="Tittel på dokument"
                  />
                </label>
                <span className="cv-public-pdf-filename" title={a.fileName}>
                  {a.fileName}
                </span>
              </div>
              <div className="cv-public-pdf-row-actions">
                {(a.downloadUrl || a.dataBase64) ? (
                  <button
                    type="button"
                    className="cv-public-pdf-open"
                    onClick={() => openPdf(a)}
                  >
                    Åpne
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cv-public-pdf-remove"
                  onClick={() => remove(a.id)}
                  disabled={busy}
                >
                  Fjern
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="cv-public-pdf-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="visually-hidden-file-input"
          onChange={handleFileChange}
          disabled={busy || list.length >= MAX_FILES}
        />
        <button
          type="button"
          className="button secondary small"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || list.length >= MAX_FILES}
        >
          {busy ? "Laster…" : "Last opp PDF"}
        </button>
        <span className="cv-public-pdf-limit">
          {list.length}/{MAX_FILES} · maks {Math.round(MAX_BYTES / 1024)} KB per fil
        </span>
      </div>
    </div>
  );
}
