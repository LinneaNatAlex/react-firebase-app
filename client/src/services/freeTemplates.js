import { BRAND_NAME } from "../config/brand";

// Gratis tekstmaler og lokale verktøy – kjører i nettleseren, ingen API-kostnad

function typeLabel(type) {
  const map = {
    'full-time': 'Heltid',
    'part-time': 'Deltid',
    'contract': 'Kontrakt / prosjekt',
    'internship': 'Praksis / internship',
  };
  return map[type] || 'Heltid';
}

/** Stillingsannonse ut fra feltene du har fylt inn – rediger fritt etterpå */
export function buildJobPostingTemplate({
  title,
  company,
  location,
  type,
  salary,
  keywords,
  companyAbout,
}) {
  const sted = location?.trim() || 'Avtales / hybrid';
  const brøk = typeLabel(type);
  const bedrift = company?.trim() || 'Bedriften';
  const tittel = title?.trim() || 'stillingen';
  const omBedriften = companyAbout?.trim()
    ? `Om oss\n${companyAbout.trim()}\n\n`
    : '';

  const lønn = salary?.trim()
    ? `Lønnsbetingelser: ${salary.trim()}`
    : 'Lønnsbetingelser avklares i samtale med aktuelle kandidater.';

  const nøkkel = keywords?.trim()
    ? `Vi vektlegger blant annet: ${keywords.trim()}.`
    : 'Vi ser etter riktig kompetanse og lagspill for rollen.';

  return `${bedrift} søker ${tittel}

Arbeidssted: ${sted}
Stillingsbrøk: ${brøk}

${omBedriften}Om stillingen
Du blir en del av arbeidsmiljøet vårt og bidrar i det daglige. Nærmere ansvar og oppgaver avklares sammen med deg.

Vi ser etter deg som
• Har relevant bakgrunn eller er motivert til å lære
• Samarbeider godt og kommuniserer tydelig
• Er strukturert og pålitelig i leveranser

${nøkkel}

Vi tilbyr
• Et inkluderende arbeidsmiljø
• Mulighet til faglig utvikling
• ${lønn}

Søknad
Send søknad med CV og kort søknadstekst her i ${BRAND_NAME}. Vi tar kontakt med aktuelle kandidater.

${bedrift}
`;
}

/** Enkel søknadstekst ut fra stilling og profil */
export function buildCoverLetterTemplate({
  jobTitle,
  companyName,
  jobDescriptionSnippet,
  profile,
  applicantEmail,
}) {
  const tittel = jobTitle?.trim() || 'stillingen';
  const bedrift = companyName?.trim() || 'bedriften';
  const sammendrag = profile?.summary?.trim();
  const erfaring = profile?.experience?.trim();
  const skills = profile?.skills?.trim();

  let body = `Hei,\n\nJeg søker på stillingen som ${tittel} hos ${bedrift}.\n\n`;

  if (sammendrag) {
    body += `${sammendrag}\n\n`;
  } else {
    body +=
      'Jeg er motivert for rollen og ønsker å bidra i teamet deres.\n\n';
  }

  if (erfaring) {
    body += `Relevant erfaring:\n${erfaring}\n\n`;
  }

  if (skills) {
    body += `Ferdigheter: ${skills}\n\n`;
  }

  if (jobDescriptionSnippet?.trim()) {
    body += `Jeg har lest stillingsbeskrivelsen og ser at dette passer godt med det jeg kan og vil jobbe med.\n\n`;
  }

  body += `Jeg håper på en prat for å utdype hvordan jeg kan bidra.\n\nMed vennlig hilsen`;

  if (applicantEmail) {
    body += `\n${applicantEmail}`;
  }

  return body;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Rangeringshjelp uten ekstern AI: teller hvor mange meningsbærende ord fra annonsen
 * som også finnes i søknad + profil. Kostnad for deg som eier: 0 uansett antall brukere.
 */
export function scoreApplicationAgainstJob(jobDescription, app) {
  const jobWords = [...new Set(tokenize(jobDescription))];
  if (jobWords.length === 0) {
    return {
      score: 50,
      reason:
        'Kort eller tom annonse – bruk egen vurdering. (Automatisk treff, ingen sky-tjeneste.)',
    };
  }
  const candidateBlob = [
    app.coverLetter,
    app.profile?.summary,
    app.profile?.experience,
    app.profile?.skills,
    app.profile?.education,
    app.profile?.languages,
  ]
    .map((x) => String(x || ''))
    .join(' ');
  const candWords = new Set(tokenize(candidateBlob));
  let hits = 0;
  for (const w of jobWords) {
    if (candWords.has(w)) hits += 1;
  }
  const ratio = hits / jobWords.length;
  const score = Math.min(100, Math.max(15, Math.round(25 + ratio * 75)));
  const reason = `Automatisk treff: ${hits} av ${jobWords.length} ord fra annonsen finnes i søknad/CV. Dette er ikke «forståelse», kun tekstmatch – les alltid søknaden selv.`;
  return { score, reason };
}

/** Rydder lister/punkt for CV-forhåndsvisning uten språkmodell */
export function polishProfileLocal(profile) {
  const bulletBlock = (text) => {
    const lines = String(text || '')
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines
      .map((l) =>
        l.startsWith('•')
          ? l
          : l.startsWith('-')
            ? `• ${l.slice(1).trim()}`
            : `• ${l}`,
      )
      .join('\n');
  };
  let languages = profile.languages;
  if (typeof languages === 'object' && languages !== null) {
    languages = JSON.stringify(languages)
      .replace(/[{}"]/g, '')
      .replace(/,/g, ', ')
      .replace(/:/g, ': ');
  } else {
    languages = String(languages || '');
  }
  return {
    headline: profile.jobTitle?.trim() || 'Privatperson',
    summary:
      String(profile.summary || '').trim() ||
      'Legg inn kort om deg under «Rediger CV».',
    experience: bulletBlock(profile.experience),
    education: bulletBlock(profile.education),
    skills: String(profile.skills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', '),
    languages,
  };
}
