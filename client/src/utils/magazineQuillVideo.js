/**
 * Video-innbygging i Utblikk (Quill): YouTube og Vimeo som sikre embed-URL-er.
 */

import Quill from "quill";
import { BlockEmbed } from "quill/blots/block.js";

/**
 * Gjør vanlige delingslenker om til embed-URL. Returnerer null hvis ikke støttet.
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeVideoEmbedUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  let u;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  const youtubeHosts = new Set([
    "youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
  ]);

  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\//, "").split("/")[0];
    if (id && /^[a-zA-Z0-9_-]{10,12}$/.test(id)) {
      return `https://www.youtube.com/embed/${id.slice(0, 11)}`;
    }
    return null;
  }

  if (host === "youtube-nocookie.com" && u.pathname.startsWith("/embed/")) {
    const id = u.pathname.slice("/embed/".length).split("/")[0];
    if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
  }

  if (youtubeHosts.has(host)) {
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.slice("/embed/".length).split("/")[0];
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.slice("/shorts/".length).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.pathname === "/watch" || u.pathname.startsWith("/watch/")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return `https://www.youtube.com/embed/${v}`;
      }
    }
    return null;
  }

  if (host === "vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const vid = parts.find((p) => /^\d+$/.test(p));
    if (vid) return `https://player.vimeo.com/video/${vid}`;
    return null;
  }

  if (host === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
    const vid = u.pathname.slice("/video/".length).split("/")[0];
    if (vid && /^\d+$/.test(vid)) {
      return `https://player.vimeo.com/video/${vid}`;
    }
  }

  return null;
}

/** @param {string} url */
export function isAllowedVideoEmbedUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (
      (h === "youtube.com" || h === "youtube-nocookie.com") &&
      u.pathname.startsWith("/embed/")
    ) {
      return true;
    }
    if (h === "player.vimeo.com" && u.pathname.startsWith("/video/")) return true;
  } catch {
    return false;
  }
  return false;
}

class MagazineVideoBlot extends BlockEmbed {
  static blotName = "video";
  static tagName = "div";
  static className = "magazine-video-wrapper";

  static create(value) {
    const node = super.create();
    const src = typeof value === "string" ? value : "";
    if (!isAllowedVideoEmbedUrl(src)) {
      return node;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", src);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", "Innebygd video");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    iframe.className = "magazine-video-iframe";
    node.appendChild(iframe);
    return node;
  }

  static value(node) {
    const iframe = node.querySelector("iframe");
    const s = iframe?.getAttribute("src") || "";
    return isAllowedVideoEmbedUrl(s) ? s : "";
  }
}

let blotRegistered = false;

export function registerMagazineVideoBlot() {
  if (blotRegistered) return;
  Quill.register(MagazineVideoBlot, true);
  blotRegistered = true;
}

/**
 * @param {import("quill").Quill} quill
 * @param {string} pageUrl Brukerens limte lenke
 * @returns {boolean}
 */
export function insertVideoAtSelection(quill, pageUrl) {
  const embed = normalizeVideoEmbedUrl(pageUrl);
  if (!embed || !isAllowedVideoEmbedUrl(embed)) return false;

  let range = quill.getSelection(true);
  if (!range) {
    const len = quill.getLength();
    range = { index: Math.max(0, len - 1), length: 0 };
  }

  quill.insertEmbed(range.index, "video", embed, "user");
  quill.insertText(range.index + 1, "\n", "user");
  quill.setSelection(range.index + 2, 0, "silent");
  return true;
}
