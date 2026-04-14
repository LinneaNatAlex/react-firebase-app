export function base64ToPdfBlob(base64) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    arr[i] = bin.charCodeAt(i);
  }
  return new Blob([arr], { type: "application/pdf" });
}

export function openPdfBase64InNewTab(base64) {
  const blob = base64ToPdfBlob(base64);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
