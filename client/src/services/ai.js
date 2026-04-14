// AI via Node → lokal Python (ingen Groq/sky-LLM). Kun bedrifter med tilgang. Lokale maler i freeTemplates.js

export { postAi, getAiApiBase } from './aiApi';
export {
  buildJobPostingTemplate,
  buildCoverLetterTemplate,
  scoreApplicationAgainstJob,
  polishProfileLocal,
} from './freeTemplates';

export function isAIConfigured() {
  return true;
}
