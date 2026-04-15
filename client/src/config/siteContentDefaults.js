/**
 * Standardtekster for offentlige sider. Overskrives av Firestore siteContent/public.
 * Bruk {{brand}} og {{magazine}} der merkenavn skal inn.
 */

import {
  DEFAULT_PRIVACY_BODY_HTML,
  DEFAULT_TERMS_BODY_HTML,
} from "./legalDefaults";

export const SITE_CONTENT_DOC_ID = "public";

export const SITE_CONTENT_DEFAULTS = {
  landing: {
    heroTitle:
      "Første jobb og tidlig karriere — uten å drukne blant de mest erfarne",
    heroSubtitle:
      "{{brand}} er bygget for studenter, nyutdannede og bedrifter som vil bygge med unge talenter. Samle annonser, søknader og CV på ett sted, med valgfri hjelp til tekst når du trenger det. Du trenger ikke være student for å være med — alle som søker jobb eller ansetter er velkomne.",
    pillar1Label: "For bedrifter",
    pillar1Text:
      "Rekrutter traineer, praksis, nyutdannede og andre roller — med oversikt over søkere og status underveis.",
    pillar2Label: "For studenter og tidlig karriere",
    pillar2Text:
      "CV, søknad og søknader samlet. Et alternativ der feed og søk ikke bare speiler de med lengst erfaring.",
    pillar3Label: "Åpent om verktøy",
    pillar3Text: "Valgfri hjelp til annonse og tekst. Du styrer innholdet.",
    featuresTitle: "Det du faktisk får",
    featuresLead:
      "Konkrete deler av flyten — ikke bare «én plattform» der erfarne profiler ofte dominerer søket.",
    feature1Title: "Stillingsannonse",
    feature1Text:
      "Skriv selv, eller bruk forslag som utgangspunkt og rediger i egen tone.",
    feature2Title: "Søknad og CV",
    feature2Text:
      "Privatpersoner bygger profil og søknadstekst her, så bedriften ser hele bildet når du søker.",
    feature3Title: "Oversikt for bedriften",
    feature3Text:
      "Søkere per stilling, status og meldinger, for eksempel ved intervju.",
    feature4Title: "Valgfri rangering",
    feature4Text:
      "Kan brukes som støtte ved mange søkere. Beslutningen er fortsatt deres.",
    forWhomTitle: "Hvem passer det for?",
    forWhomIntro:
      "Naturlig for studenter og tidlig karriere — og for bedrifter som vil nå dem. Andre kandidater og arbeidsgivere er like velkomne.",
    companyCardTitle: "Bedrifter",
    privateCardTitle: "Privatpersoner",
    companyBullet1: "Publiser stillinger som treffer juniorer og nyutdannede",
    companyBullet2: "Liste over søkere og detaljer",
    companyBullet3: "Status og melding til kandidater",
    privateBullet1: "Profil og CV-tekst på ett sted",
    privateBullet2: "Søk på utlyste stillinger — også uten studentbevis",
    privateBullet3: "Se status og beskjeder fra arbeidsgivere",
    ctaTitle: "Lyst å prøve?",
    ctaText: "Opprett konto og utforsk, uten salgstale i veien.",
    heroBtnPrimary: "Opprett konto",
    heroBtnSecondary: "Se stillinger",
    companyRegBtn: "Registrer som bedrift",
    privateRegBtn: "Registrer som privatperson",
    ctaBtn: "Kom i gang",
  },
  about: {
    pageTitle: "Om {{brand}}",
    headingValues: "Våre verdier",
    headingEmphasis: "Hva vi legger vekt på",
    headingBak: "Bak plattformen",
    headingKontakt: "Kontakt",
    contactPlaceholderHtml:
      'Offentlig kontaktpunkt kommer. I mellomtiden kan du lese mer under <a href="/faq">ofte stilte spørsmål</a>.',
    intro1:
      "{{brand}} er laget for studenter, nyutdannede og bedrifter som vil møtes rundt tidlig karriere: stillingsannonser, søknader, CV og oversikt — uten at erfarne profiler dominerer alt i feed og søk.",
    intro2:
      "Du trenger ikke være student for å være med. Både jobbsøkere og arbeidsgivere som passer inn i dette bildet er velkomne.",
    values1:
      "Vi tror det er en verdi i seg selv å få nyutdannede og folk tidlig i karrieren ut i jobb — og at bedrifter som ansetter dem styrker både team og samfunn.",
    values2:
      "Kunstig intelligens endrer mye av det rutinemessige i arbeidslivet. Vi vil likevel at jobb- og søknadsflyten skal være menneskelig: du skal forstå hva du sender inn, hvem du snakker med, og hvorfor. {{brand}} skal støtte den flyten, ikke erstatte den.",
    values3:
      "KI kan gjøre ting enklere og raskere når du velger å bruke den — men den erstatter ikke utdanning, faglig tyngde eller dømmekraft. Vi ønsker å minne om at det å mestre verktøyene, inkludert KI, fortsatt krever kunnskap og øving.",
    emphasis1:
      "Tydelig skille mellom hva som er gratis for privatpersoner og hva som er tillegg for bedrifter (for eksempel AI-verktøy).",
    emphasis2:
      "Valgfri hjelp til tekst og struktur — du beholder kontrollen over innholdet.",
    emphasis3:
      "Magasinet {{magazine}} som egen kanal for journalistikk og stemmer.",
    priserLineNoEmail:
      'Priser og produktpakker finner du på <a href="/priser">siden for priser</a>.',
    priserLineWithEmail:
      'Priser og produktpakker finner du på <a href="/priser">siden for priser</a>, og du kan nå oss på e-post under.',
    bak1:
      "{{brand}} er utviklet med tydelig faglig forankring: hensikt, målgruppe og prioriteringer er resultat av menneskelige valg — ikke av automatiserte verktøy alene. Konseptet springer ut av utdanning og erfaring innen markedsføring og merkevareledelse, supplert med teknisk kompetanse fra frontend. Målet er en tjeneste som oppleves gjennomtenkt og forutsigbar for dem som bruker den.",
    bak2:
      "I arbeidet med løsningen og tekstene på nettsiden følger vi moderne utviklingspraksis og bruker kunstig intelligens der det gir effektivitet og oversikt. Slik teknologi tar hånd om deler av det rutinemessige; den erstatter ikke vurdering. Beslutninger om hva som publiseres, hvordan {{brand}} skal oppleves, og når innhold må bearbeides på nytt, treffes med faglig skjønn og gjennomgås fortløpende.",
  },
  faq: [
    {
      q: "Hvem er {{brand}} for?",
      a: "Studenter, nyutdannede og andre i tidlig karriere som søker jobb, og bedrifter som vil rekruttere i det segmentet. Andre brukere er også velkomne.",
    },
    {
      q: "Koster det noe for meg som jobbsøker?",
      a: 'Grunnleggende bruk som privatperson er gratis. Søknadsbibliotek og relaterte funksjoner er beskrevet på <a href="/priser">prissiden</a>. Bedrifts-AI er et eget tillegg og gjelder ikke privatkontoer på samme måte.',
    },
    {
      q: "Hva er forskjellen på privatkonto og bedrift?",
      a: "Privatpersoner bygger profil, søknad og CV og søker på stillinger. Bedrifter publiserer stillinger, ser søkere og kan bruke valgfrie verktøy for bedrifter (inkludert betalt AI der det er aktivert).",
    },
    {
      q: "Er det gratis prøveperiode på bedrifts-AI?",
      a: "Nei. Tilgang til sky-AI for bedrifter forutsetter betaling eller aktiv tilgang satt av administrator — det finnes ingen gratis prøveperiode for den delen.",
    },
    {
      q: "Hva er {{magazine}}?",
      a: "Et magasin inne i {{brand}} med artikler og egen redaksjon for de som har journalist- eller redaktørrolle. Forsiden og enkeltartikler er tilgjengelige for alle.",
    },
    {
      q: "Hvor finner jeg teknisk attribusjon (åpne komponenter)?",
      a: 'Se siden <a href="/credits">Åpne komponenter</a> for embedding-modell og lisenser vi bygger på.',
    },
  ],
  faqPage: {
    title: "Ofte stilte spørsmål",
    lead:
      "Korte svar om {{brand}}. Fullstendige priser og vilkår finnes der det er lenket.",
  },
  footer: {
    columnProdukt: "Produkt",
    columnInfo: "Info",
    linkJobs: "Ledige stillinger",
    linkMagazine: "{{magazine}}",
    linkPricing: "Priser",
    linkRegister: "Registrering",
    linkLogin: "Logg inn",
    linkAbout: "Om oss",
    linkFaq: "Ofte stilte spørsmål",
    linkCredits: "Åpne komponenter",
    linkContact: "Kontakt",
    columnLegal: "Juridisk",
    linkPrivacy: "Personvern",
    linkTerms: "Vilkår",
    aiCredit:
      "Privatpersoner: lokale maler. Bedrifter: sky-AI mot betaling – ingen gratis prøveperioder.",
  },
  credits: {
    title: "Åpne komponenter og modeller",
    lead:
      "{{brand}} består av egen kode og tredjepartsbiblioteker. Under følger attribusjon for embedding-modellen som brukes i bedriftens AI-flyt (rangering m.m.), slik den er satt opp i vår tjeneste.",
    disclaimer:
      "Modellfiler kan lastes ned fra Hugging Face Hub ved første kjøring av vår AI-tjeneste. Annen modell kan konfigureres internt; lisens følger da den valgte modellen.",
  },
  legal: {
    privacyTitle: "Personvernerklæring",
    privacyBodyHtml: DEFAULT_PRIVACY_BODY_HTML,
    termsTitle: "Vilkår for bruk",
    termsBodyHtml: DEFAULT_TERMS_BODY_HTML,
  },
};
