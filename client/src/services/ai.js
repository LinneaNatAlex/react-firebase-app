// AI-tjeneste med Groq API (https://groq.com)
// Modell: Llama 3.3 70B Versatile (Meta)
// Brukes for å generere stillingsannonser, forbedre CV-er og evaluere søkere

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Hent API-nøkkel fra miljøvariabler
function getApiKey() {
  return import.meta.env.VITE_GROQ_API_KEY;
}

// Sjekk om AI er konfigurert
export function isAIConfigured() {
  const key = getApiKey();
  return key && key !== "undefined" && key.length > 0;
}

// Generell funksjon for å sende forespørsel til Groq
async function askAI(prompt, systemPrompt = "") {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Groq API-nøkkel mangler. Legg til VITE_GROQ_API_KEY i .env filen.");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt || "Du er en hjelpsom assistent som skriver på norsk." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Feil ved AI-forespørsel");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Generer stillingsannonse basert på grunnleggende info
export async function generateJobPosting(jobInfo) {
  const { title, company, location, type, keywords } = jobInfo;
  
  const systemPrompt = `Du er en ekspert på HR og rekruttering i Norge. 
Du skriver profesjonelle, engasjerende stillingsannonser på norsk.
Annonsene skal være inkluderende, tydelige og tiltrekke de beste kandidatene.
Bruk et profesjonelt men vennlig språk.`;

  const prompt = `Lag en komplett stillingsannonse for følgende stilling:

Stillingstittel: ${title}
Bedrift: ${company}
Sted: ${location}
Stillingstype: ${type}
${keywords ? `Nøkkelord/ferdigheter: ${keywords}` : ""}

Strukturer annonsen slik:
1. En fengende ingress (2-3 setninger)
2. Om stillingen (3-4 punkter)
3. Kvalifikasjoner vi ser etter (4-5 punkter, skill mellom "må ha" og "fint å ha")
4. Vi tilbyr (3-4 punkter om fordeler/goder)
5. En avsluttende oppfordring til å søke

Skriv naturlig og unngå klisjeer. Ikke bruk overskrifter som "Om stillingen:" - la teksten flyte naturlig.`;

  return await askAI(prompt, systemPrompt);
}

// Evaluer en jobbsøker basert på CV/søknad
export async function evaluateApplicant(applicantInfo, jobRequirements) {
  const systemPrompt = `Du er en erfaren rekrutterer som evaluerer jobbsøkere objektivt og rettferdig.
Du gir konstruktive, balanserte vurderinger på norsk.
Fokuser på kompetanse og erfaring, ikke personlige egenskaper.`;

  const prompt = `Evaluer denne søkeren mot stillingskravene:

STILLINGSKRAV:
${jobRequirements}

SØKERENS PROFIL:
${applicantInfo}

Gi en vurdering som inkluderer:
1. Samlet score (1-10)
2. Styrker (2-3 punkter)
3. Mulige gaps/utviklingsområder (1-2 punkter)
4. Anbefaling (kall til intervju / kanskje / ikke aktuell)
5. Forslag til intervjuspørsmål (2-3 spørsmål)

Vær objektiv og fokuser på fakta fra søknaden.`;

  return await askAI(prompt, systemPrompt);
}

// Foreslå intervjuspørsmål for en stilling
export async function generateInterviewQuestions(jobTitle, requirements) {
  const systemPrompt = `Du er en erfaren intervjuer som lager gode, relevante intervjuspørsmål.
Spørsmålene skal avdekke både faglig kompetanse og personlige egenskaper.`;

  const prompt = `Lag 8-10 intervjuspørsmål for stillingen "${jobTitle}".

Krav til stillingen:
${requirements}

Inkluder:
- 2-3 tekniske/faglige spørsmål
- 2-3 atferdsspørsmål (STAR-metoden)
- 2 situasjonsspørsmål
- 1-2 spørsmål om motivasjon og kultur-fit

Skriv spørsmålene på norsk.`;

  return await askAI(prompt, systemPrompt);
}

// Forbedre en eksisterende stillingstekst
export async function improveJobPosting(currentText) {
  const systemPrompt = `Du er en ekspert på stillingsannonser og employer branding.
Du forbedrer tekster for å gjøre dem mer engasjerende og effektive.`;

  const prompt = `Forbedre denne stillingsannonsen. Gjør den mer:
- Engasjerende og fristende
- Tydelig på krav og forventninger
- Inkluderende i språket
- Profesjonell men vennlig

Nåværende tekst:
${currentText}

Gi meg den forbedrede versjonen. Behold strukturen men forbedre språket og innholdet.`;

  return await askAI(prompt, systemPrompt);
}
