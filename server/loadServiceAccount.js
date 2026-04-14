import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Leser Firebase Admin credentials fra fil (anbefalt lokalt) eller fra FIREBASE_SERVICE_ACCOUNT (JSON-streng).
 * @returns {object|null}
 */
export function loadServiceAccount() {
  const rawPath = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  if (rawPath) {
    const abs = path.isAbsolute(rawPath) ? rawPath : path.join(__dirname, rawPath);
    try {
      const text = fs.readFileSync(abs, 'utf8');
      return JSON.parse(text);
    } catch (e) {
      console.error(
        'Kunne ikke lese FIREBASE_SERVICE_ACCOUNT_PATH:',
        abs,
        '–',
        e.message,
      );
      return null;
    }
  }

  const inline = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT er ugyldig JSON:', e.message);
      return null;
    }
  }

  return null;
}
