/**
 * Sky-AI for bedrifter: stillingsannonse + søkerrangering (OpenAI-kompatibel chat).
 * AI krever aiPass=true (betaling / admin) – ingen gratis forsøk.
 * Stillingsbibliotek + utlyste stillinger kan også indekseres til RAG (se server/rag.js) når AI brukes.
 *
 * Leverandør velges med miljøvariabler (se resolveLlmConfig nedenfor).
 */

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

/**
 * Støtter LLM_* (anbefalt) eller legacy GROQ_*.
 * Eksempler:
 * - Groq: GROQ_API_KEY (+ valgfritt GROQ_MODEL)
 * - Google Gemini (OpenAI-kompatibel): LLM_API_KEY, LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai, LLM_MODEL=gemini-2.0-flash
 * - OpenRouter / Together / DeepInfra: LLM_API_KEY + LLM_BASE_URL + LLM_MODEL
 * - Lokal Ollama: LLM_BASE_URL=http://127.0.0.1:11434/v1, LLM_API_KEY=ollama (dummy), LLM_MODEL=llama3.2
 */
export function resolveLlmConfig() {
  const apiKey = (process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '').trim();
  const explicitBase = trimSlash(process.env.LLM_BASE_URL || '');
  const groqOnly =
    Boolean((process.env.GROQ_API_KEY || '').trim()) &&
    !(process.env.LLM_API_KEY || '').trim();
  const baseUrl =
    explicitBase ||
    (groqOnly ? 'https://api.groq.com/openai/v1' : '');
  const model = (
    process.env.LLM_MODEL ||
    process.env.GROQ_MODEL ||
    'llama-3.1-8b-instant'
  ).trim();
  return { apiKey, baseUrl, model };
}

async function openAiCompatibleChat(messages, options = {}, llm = {}) {
  const { apiKey, baseUrl, model } = llm;
  const url = `${trimSlash(baseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 2048,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message || res.statusText || 'LLM-feil';
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Tomt svar fra modellen');
  return text.trim();
}

/** Kun aiPass=true gir tilgang – ingen gratiskvote */
export async function getAiQuotaStatus(db, uid) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      allowed: false,
      reason: 'no_user_doc',
      remaining: 0,
      used: 0,
      limit: 0,
      pass: false,
    };
  }
  const d = snap.data();
  if (d.aiPass === true) {
    return {
      allowed: true,
      reason: 'pass',
      remaining: null,
      used: null,
      limit: null,
      pass: true,
    };
  }
  return {
    allowed: false,
    reason: 'no_pass',
    remaining: 0,
    used: 0,
    limit: 0,
    pass: false,
  };
}

function buildJobPostingPrompt(payload) {
  const { title, company, location, type, salary, keywords, companyAbout, ragContext } = payload;
  const about = String(companyAbout || '').trim();
  const aboutBlock = about
    ? `\nOm bedriften (fast tekst fra arbeidsgiver – bruk som utgangspunkt; ikke finn på nye fakta utover dette og feltene over):\n${about.slice(0, 6000)}`
    : '';
  const ragBlock = ragContext?.trim()
    ? `\n\nTidligere stillingstekster fra samme bedrift (utdrag fra egne annonser/bibliotek – bruk som stil og tone; ikke kopier ordrett; ikke finn på fakta som ikke finnes i oppgaven over):\n${ragContext.trim().slice(0, 12000)}`
    : '';
  return [
    {
      role: 'system',
      content:
        'Du skriver profesjonelle stillingsannonser på norsk (bokmål). Bruk tydelige avsnitt og punktlister der det passer. Ikke finn på fakta som ikke er gitt.',
    },
    {
      role: 'user',
      content: `Lag en full stillingsannonse på norsk ut fra dette:
Stillingstittel: ${title || ''}
Bedrift: ${company || ''}
Sted: ${location || ''}
Stillingsbrøk/type: ${type || ''}
Lønn (hvis oppgitt): ${salary || 'ikke oppgitt'}
Nøkkelord/krav: ${keywords || 'ikke oppgitt'}${aboutBlock}

Inkluder: kort intro (gjerne med kort «om oss» hvis du har materiale), om rollen, kvalifikasjoner (punktliste), vi tilbyr (punktliste), søknad (kort). Avslutt med bedriftsnavn.${ragBlock}`,
    },
  ];
}

function buildRankPrompt(payload) {
  const { jobDescription, applicants } = payload;
  const lines = (applicants || []).map((a, i) => {
    const prof = [
      a.profile?.summary,
      a.profile?.experience,
      a.profile?.skills,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 1200);
    return `ID ${a.id || `app_${i}`}: Navn: ${a.applicantName || 'Ukjent'}. Søknad: ${String(a.coverLetter || '').slice(0, 2000)}. Profil: ${prof}`;
  });
  return [
    {
      role: 'system',
      content: `Du er rekrutteringsassistent. Ranger kandidater mot stillingsannonsen. Svar KUN med JSON-array: [{"id":"...","score":0-100,"reason":"kort norsk begrunnelse"}]. Samme id som i input.`,
    },
    {
      role: 'user',
      content: `Stillingsannonse:\n${String(jobDescription || '').slice(0, 8000)}\n\nKandidater:\n${lines.join('\n\n')}`,
    },
  ];
}

function parseJsonLoose(text) {
  const t = String(text).trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return JSON.parse(t.slice(start, end + 1));
  }
  const oStart = t.indexOf('{');
  const oEnd = t.lastIndexOf('}');
  if (oStart >= 0 && oEnd > oStart) {
    return JSON.parse(t.slice(oStart, oEnd + 1));
  }
  return JSON.parse(t);
}

function safeParseJson(text, label) {
  try {
    return parseJsonLoose(text);
  } catch (e) {
    const err = new Error(`${label}: kunne ikke tolke JSON fra modellen`);
    err.status = 502;
    throw err;
  }
}

export async function handleAiAction({ action, payload }, llm) {
  const builders = {
    jobPosting: () => buildJobPostingPrompt(payload),
    rankApplicants: () => buildRankPrompt(payload),
  };
  const build = builders[action];
  if (!build) {
    const err = new Error('Ukjent handling');
    err.status = 400;
    throw err;
  }

  const messages = build();
  const text = await openAiCompatibleChat(
    messages,
    {
      temperature: action === 'rankApplicants' ? 0.2 : 0.5,
      max_tokens: action === 'rankApplicants' ? 4096 : 2048,
    },
    llm,
  );

  if (action === 'rankApplicants') {
    const arr = safeParseJson(text, 'rankApplicants');
    if (!Array.isArray(arr)) {
      const err = new Error('Ugyldig rangerings-svar');
      err.status = 502;
      throw err;
    }
    return { rankings: arr };
  }
  return { text };
}
