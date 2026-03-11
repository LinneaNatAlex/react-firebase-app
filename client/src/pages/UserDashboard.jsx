// Dashboard for jobbsøkere - CV, søknader og profil

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isAIConfigured } from '../services/ai';
import '../styles/Dashboard.css';

function UserDashboard() {
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('applications');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [enhancedCV, setEnhancedCV] = useState(null);
  const [generatingCV, setGeneratingCV] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  
  // CV/Profil-data
  const [profile, setProfile] = useState({
    summary: '',
    experience: '',
    education: '',
    skills: '',
    languages: '',
    jobTitle: '',
    profileImage: '',
    coverLetterTemplate: '',
    phone: '',
    location: '',
    desiredPosition: '',
    linkedIn: '',
    portfolio: ''
  });

  // Henter søknader og profil
  async function fetchData() {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Hent søknader
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(applicationsQuery);
      const applicationsList = querySnapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));
      setApplications(applicationsList);
      
      // Hent CV/profil
      const profileDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        setProfile(prevProfile => ({ ...prevProfile, ...profileData }));
      }
    } catch (error) {
      console.error('Feil ved henting av data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Last opp profilbilde (lagres som base64 i Firestore)
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    // Sjekk filtype
    if (!file.type.startsWith('image/')) {
      toast.error('Vennligst velg et bilde (JPG, PNG, etc.)');
      return;
    }

    // Sjekk størrelse (maks 1MB for base64)
    if (file.size > 1024 * 1024) {
      toast.error('Bildet er for stort. Maks 1MB.');
      return;
    }

    setUploadingImage(true);
    try {
      // Konverter bilde til base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Lagre base64 i Firestore
      await setDoc(doc(db, 'profiles', currentUser.uid), {
        profileImage: base64,
        updatedAt: new Date()
      }, { merge: true });
      
      // Oppdater lokal state
      setProfile(prevProfile => ({ ...prevProfile, profileImage: base64 }));
      
      toast.success('Bilde lastet opp!');

    } catch (error) {
      console.error('Feil ved opplasting:', error);
      toast.error('Kunne ikke laste opp bilde. Prøv igjen.');
    }
    setUploadingImage(false);
  }

  // Lagre CV/profil og generer forhåndsvisning
  async function saveProfile() {
    if (!currentUser) return;
    
    setSaving(true);
    try {
      await setDoc(doc(db, 'profiles', currentUser.uid), {
        ...profile,
        updatedAt: new Date()
      });
      
      // Generer forbedret CV med AI
      await generateEnhancedCV();
      
      // Bytt til forhåndsvisning-fanen
      setActiveTab('cv-preview');
      toast.success('CV lagret!');
    } catch (error) {
      console.error('Feil ved lagring:', error);
      toast.error('Kunne ikke lagre. Prøv igjen.');
    }
    setSaving(false);
  }

  // AI-genererer en forbedret versjon av CV-en
  async function generateEnhancedCV() {
    if (!isAIConfigured()) {
      setEnhancedCV(null);
      return;
    }

    setGeneratingCV(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: `Du er en ekspert på CV-skriving og karriererådgivning. 
Du skal forbedre og profesjonalisere CV-tekster på norsk.
Behold all faktisk informasjon, men gjør språket mer profesjonelt og slagkraftig.
Bruk aktive verb og kvantifiser resultater der mulig.`
            },
            { 
              role: 'user', 
              content: `Forbedre denne CV-en for en person som søker stilling som ${profile.jobTitle || 'generell stilling'}:

SAMMENDRAG:
${profile.summary || 'Ikke oppgitt'}

ERFARING:
${profile.experience || 'Ikke oppgitt'}

UTDANNING:
${profile.education || 'Ikke oppgitt'}

FERDIGHETER:
${profile.skills || 'Ikke oppgitt'}

SPRÅK:
${profile.languages || 'Ikke oppgitt'}

Gi meg en forbedret versjon i JSON-format:
{
  "summary": "forbedret sammendrag",
  "experience": "forbedret erfaring med bullet points",
  "education": "forbedret utdanning",
  "skills": "kategoriserte ferdigheter",
  "languages": "språk med nivå",
  "headline": "en profesjonell overskrift/tittel for personen"
}

Svar KUN med JSON, ingen annen tekst.`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse JSON fra AI-respons
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enhanced = JSON.parse(jsonMatch[0]);
        setEnhancedCV(enhanced);
      }
    } catch (error) {
      console.error('AI CV-feil:', error);
      setEnhancedCV(null);
    }
    setGeneratingCV(false);
  }

  // AI-generering av søknadstekst
  async function generateCoverLetter(jobTitle, companyName) {
    if (!isAIConfigured()) {
      toast.error('AI er ikke konfigurert');
      return '';
    }

    setAiLoading(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: 'Du er en ekspert på å skrive overbevisende søknadstekster på norsk. Skriv personlig og engasjerende.'
            },
            { 
              role: 'user', 
              content: `Skriv en søknadstekst for stillingen "${jobTitle}" hos ${companyName}.

Min bakgrunn:
${profile.summary || 'Ikke oppgitt'}

Min erfaring:
${profile.experience || 'Ikke oppgitt'}

Mine ferdigheter:
${profile.skills || 'Ikke oppgitt'}

Skriv en personlig og engasjerende søknadstekst på 150-200 ord.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      setAiLoading(false);
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI-feil:', error);
      setAiLoading(false);
      return '';
    }
  }

  // Konverterer status-kode til norsk tekst og farge
  function getStatusInfo(status) {
    switch (status) {
      case 'pending': return { text: 'Under vurdering', color: 'yellow' };
      case 'reviewed': return { text: 'Gjennomgått', color: 'blue' };
      case 'interview': return { text: 'Til intervju', color: 'green' };
      case 'rejected': return { text: 'Avslått', color: 'red' };
      case 'accepted': return { text: 'Akseptert', color: 'green' };
      case 'withdrawn': return { text: 'Trukket', color: 'gray' };
      default: return { text: 'Ukjent', color: 'gray' };
    }
  }

  // Trekk tilbake søknad
  async function withdrawApplication(applicationId) {
    if (!window.confirm('Er du sikker på at du vil trekke denne søknaden? Dette kan ikke angres.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'applications', applicationId));
      // Oppdater lokal state
      setApplications(applications.filter(app => app.id !== applicationId));
      toast.success('Søknad trukket tilbake');
    } catch (error) {
      console.error('Feil ved tilbaketrekking:', error);
      toast.error('Kunne ikke trekke søknaden. Prøv igjen.');
    }
  }

  const fullName = userData 
    ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
    : 'Jobbsøker';

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>👤 {fullName}</h2>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={activeTab === 'applications' ? 'active' : ''}
            onClick={() => setActiveTab('applications')}
          >
            📄 Mine søknader
          </button>
          <button 
            className={activeTab === 'cv' ? 'active' : ''}
            onClick={() => setActiveTab('cv')}
          >
            ✏️ Rediger CV
          </button>
          <button 
            className={activeTab === 'cv-preview' ? 'active' : ''}
            onClick={() => setActiveTab('cv-preview')}
          >
            📎 Se CV
          </button>
          <button 
            className={activeTab === 'cover-letter' ? 'active' : ''}
            onClick={() => setActiveTab('cover-letter')}
          >
            ✍️ Søknadstekst
          </button>
          <Link to="/jobs" className="nav-item">🔍 Finn jobber</Link>
        </nav>
      </aside>

      <main className="dashboard-main">
        {/* FANE: Mine søknader */}
        {activeTab === 'applications' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Mine søknader</h1>
                <p>Følg med på statusen til dine jobbsøknader</p>
              </div>
              <Link to="/jobs" className="button primary">
                🔍 Finn nye jobber
              </Link>
            </header>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{applications.length}</span>
                <span className="stat-label">Totalt søknader</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {applications.filter(a => a.status === 'pending').length}
                </span>
                <span className="stat-label">Under vurdering</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {applications.filter(a => a.status === 'interview').length}
                </span>
                <span className="stat-label">Til intervju</span>
              </div>
            </div>

            {/* Varsel om nye meldinger */}
            {applications.filter(a => a.companyMessage).length > 0 && (
              <div className="interview-alert">
                <span className="alert-icon">🎉</span>
                <div className="alert-content">
                  <strong>Du har {applications.filter(a => a.companyMessage).length} melding(er) fra bedrifter!</strong>
                  <p>Se nedenfor for detaljer om intervjuinvitasjoner eller annen informasjon.</p>
                </div>
              </div>
            )}

            <div className="dashboard-content">
              <h2 className="section-title">Søknadshistorikk</h2>
              
              {loading ? (
                <p className="loading-text">Laster søknader...</p>
              ) : applications.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📄</span>
                  <h3>Ingen søknader ennå</h3>
                  <p>Du har ikke sendt noen søknader ennå. Finn din drømmejobb!</p>
                  <Link to="/jobs" className="button primary">
                    🔍 Finn jobber
                  </Link>
                </div>
              ) : (
                <div className="applications-list">
                  {applications.map(application => {
                    const statusInfo = getStatusInfo(application.status);
                    const canWithdraw = !['accepted', 'rejected', 'withdrawn'].includes(application.status);
                    const hasMessage = application.companyMessage;
                    
                    return (
                      <div key={application.id} className={`application-card ${hasMessage ? 'has-message' : ''}`}>
                        <div className="application-card-main">
                          <h3>{application.jobTitle}</h3>
                          <p className="company-name">{application.companyName}</p>
                          <p className="application-date">
                            Søkt: {application.appliedAt?.toDate?.()?.toLocaleDateString('nb-NO') || '-'}
                          </p>
                        </div>
                        <div className="application-card-actions">
                          <span className={`status-badge ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                          {canWithdraw && (
                            <button 
                              className="withdraw-btn"
                              onClick={() => withdrawApplication(application.id)}
                            >
                              Trekk søknad
                            </button>
                          )}
                        </div>
                        
                        {/* Melding fra bedriften */}
                        {hasMessage && (
                          <div className="company-message-box">
                            <div className="message-header">
                              <span className="message-icon">📩</span>
                              <span className="message-title">Melding fra {application.messageSender || application.companyName}</span>
                              {application.messageDate && (
                                <span className="message-date">
                                  {application.messageDate.toDate?.()?.toLocaleDateString('nb-NO') || ''}
                                </span>
                              )}
                            </div>
                            <div className="message-content">
                              {application.companyMessage.split('\n').map((line, i) => (
                                <p key={i}>{line || '\u00A0'}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* FANE: Min CV */}
        {activeTab === 'cv' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Min CV</h1>
                <p>Fyll ut din profil - denne brukes når du søker på jobber</p>
              </div>
              <button 
                className="button primary" 
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? 'Lagrer...' : '💾 Lagre CV'}
              </button>
            </header>

            <div className="dashboard-content">
              <div className="cv-form">
                {/* Profilbilde */}
                <div className="profile-image-section">
                  <div 
                    className="profile-image-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profile.profileImage ? (
                      <img src={profile.profileImage} alt="Profilbilde" />
                    ) : (
                      <div className="upload-placeholder">
                        <span className="upload-icon">📷</span>
                        <span>Legg til bilde</span>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="upload-overlay">
                        <span>Laster opp...</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <p className="image-hint">Klikk for å laste opp profilbilde</p>
                </div>

                {/* Kontaktinformasjon */}
                <div className="form-section-title">📞 Kontaktinformasjon</div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Telefon</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      placeholder="F.eks: 412 34 567"
                    />
                  </div>
                  <div className="form-group">
                    <label>Bosted</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => setProfile({...profile, location: e.target.value})}
                      placeholder="F.eks: Oslo, Bergen, Trondheim"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>LinkedIn (valgfritt)</label>
                    <input
                      type="url"
                      value={profile.linkedIn}
                      onChange={(e) => setProfile({...profile, linkedIn: e.target.value})}
                      placeholder="linkedin.com/in/ditt-navn"
                    />
                  </div>
                  <div className="form-group">
                    <label>Portefølje / Nettside (valgfritt)</label>
                    <input
                      type="url"
                      value={profile.portfolio}
                      onChange={(e) => setProfile({...profile, portfolio: e.target.value})}
                      placeholder="www.minside.no"
                    />
                  </div>
                </div>

                {/* Jobbønsker */}
                <div className="form-section-title">🎯 Jobbønsker</div>

                <div className="form-group">
                  <label>Ønsket stilling / Yrke</label>
                  <input
                    type="text"
                    value={profile.jobTitle}
                    onChange={(e) => setProfile({...profile, jobTitle: e.target.value})}
                    placeholder="F.eks: Frontend-utvikler, Markedssjef, Sykepleier"
                  />
                  <small className="form-hint">AI bruker dette til å tilpasse CV-en din</small>
                </div>

                <div className="form-group">
                  <label>Hva ser du etter? (Ønsket arbeidstype)</label>
                  <textarea
                    value={profile.desiredPosition}
                    onChange={(e) => setProfile({...profile, desiredPosition: e.target.value})}
                    placeholder="F.eks: Jeg ser etter en fulltidsstilling hvor jeg kan jobbe med webutvikling. Åpen for remote arbeid. Ønsker et kreativt miljø med mulighet for faglig utvikling."
                    rows={3}
                  />
                </div>

                {/* Om deg */}
                <div className="form-section-title">👤 Om deg</div>

                <div className="form-group">
                  <label>Kort om meg</label>
                  <textarea
                    value={profile.summary}
                    onChange={(e) => setProfile({...profile, summary: e.target.value})}
                    placeholder="Skriv en kort introduksjon om deg selv (2-3 setninger)"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Arbeidserfaring</label>
                  <textarea
                    value={profile.experience}
                    onChange={(e) => setProfile({...profile, experience: e.target.value})}
                    placeholder="Liste over tidligere jobber, f.eks:&#10;• Selger hos Elkjøp (2020-2022)&#10;• Kundeservice hos Telenor (2022-nå)"
                    rows={6}
                  />
                </div>

                <div className="form-group">
                  <label>Utdanning</label>
                  <textarea
                    value={profile.education}
                    onChange={(e) => setProfile({...profile, education: e.target.value})}
                    placeholder="F.eks:&#10;• Bachelor i økonomi, BI (2018-2021)&#10;• Videregående, Studiespesialisering (2015-2018)"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Ferdigheter</label>
                  <textarea
                    value={profile.skills}
                    onChange={(e) => setProfile({...profile, skills: e.target.value})}
                    placeholder="F.eks: Excel, PowerPoint, kundeservice, salg"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Språk</label>
                  <input
                    type="text"
                    value={profile.languages}
                    onChange={(e) => setProfile({...profile, languages: e.target.value})}
                    placeholder="F.eks: Norsk (morsmål), Engelsk (flytende)"
                  />
                </div>
              </div>
            </div>

            <div className="tips-section">
              <h2>💡 Tips for god CV</h2>
              <div className="tips-grid">
                <div className="tip-card">
                  <h4>Vær konkret</h4>
                  <p>Bruk tall og resultater: "Økte salget med 20%"</p>
                </div>
                <div className="tip-card">
                  <h4>Tilpass til stillingen</h4>
                  <p>Fremhev erfaring som er relevant for jobben</p>
                </div>
                <div className="tip-card">
                  <h4>Hold det oppdatert</h4>
                  <p>Legg til nye erfaringer og ferdigheter jevnlig</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* FANE: CV Forhåndsvisning */}
        {activeTab === 'cv-preview' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>📎 Min CV</h1>
                <p>Slik ser CV-en din ut for arbeidsgivere</p>
              </div>
              <div className="header-actions">
                <button 
                  className="button secondary"
                  onClick={() => setActiveTab('cv')}
                >
                  ✏️ Rediger
                </button>
                <button 
                  className="button primary"
                  onClick={generateEnhancedCV}
                  disabled={generatingCV}
                >
                  {generatingCV ? '✨ Forbedrer...' : '✨ Forbedre med AI'}
                </button>
              </div>
              {isAIConfigured() && <p className="ai-powered-by">Drevet av Groq + Llama 3.3</p>}
            </header>

            {generatingCV ? (
              <div className="cv-loading">
                <div className="loading-spinner"></div>
                <p>AI forbedrer CV-en din...</p>
              </div>
            ) : (
              <div className="cv-preview-container">
                <div className="cv-document">
                  {/* Header med navn og bilde */}
                  <div className="cv-header">
                    {profile.profileImage && (
                      <img 
                        src={profile.profileImage} 
                        alt={fullName}
                        className="cv-profile-image"
                      />
                    )}
                    <div className="cv-header-text">
                      <h1 className="cv-name">{fullName}</h1>
                      <p className="cv-headline">
                        {String(enhancedCV?.headline || profile.jobTitle || 'Jobbsøker')}
                      </p>
                      <div className="cv-contact-info">
                        <span>{userData?.email || currentUser?.email}</span>
                        {profile.phone && <span>📞 {profile.phone}</span>}
                        {profile.location && <span>📍 {profile.location}</span>}
                      </div>
                      {(profile.linkedIn || profile.portfolio) && (
                        <div className="cv-links">
                          {profile.linkedIn && (
                            <a href={profile.linkedIn.startsWith('http') ? profile.linkedIn : `https://${profile.linkedIn}`} 
                               target="_blank" rel="noopener noreferrer">
                              LinkedIn
                            </a>
                          )}
                          {profile.portfolio && (
                            <a href={profile.portfolio.startsWith('http') ? profile.portfolio : `https://${profile.portfolio}`}
                               target="_blank" rel="noopener noreferrer">
                              Portefølje
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sammendrag */}
                  {(enhancedCV?.summary || profile.summary) && (
                    <div className="cv-section">
                      <h2>Profil</h2>
                      <p>{String(enhancedCV?.summary || profile.summary || '')}</p>
                    </div>
                  )}

                  {/* Hva jeg ser etter */}
                  {profile.desiredPosition && (
                    <div className="cv-section cv-desired">
                      <h2>Hva jeg ser etter</h2>
                      <p>{profile.desiredPosition}</p>
                    </div>
                  )}

                  {/* Erfaring */}
                  {(enhancedCV?.experience || profile.experience) && (
                    <div className="cv-section">
                      <h2>Arbeidserfaring</h2>
                      <div className="cv-content">
                        {String(enhancedCV?.experience || profile.experience || '').split('\n').map((line, i) => (
                          line && <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Utdanning */}
                  {(enhancedCV?.education || profile.education) && (
                    <div className="cv-section">
                      <h2>Utdanning</h2>
                      <div className="cv-content">
                        {String(enhancedCV?.education || profile.education || '').split('\n').map((line, i) => (
                          line && <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ferdigheter */}
                  {(enhancedCV?.skills || profile.skills) && (
                    <div className="cv-section">
                      <h2>Ferdigheter</h2>
                      <div className="cv-skills">
                        {String(enhancedCV?.skills || profile.skills || '').split(',').map((skill, i) => (
                          skill.trim() && <span key={i} className="skill-tag">{skill.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Språk */}
                  {(enhancedCV?.languages || profile.languages) && (
                    <div className="cv-section">
                      <h2>Språk</h2>
                      <p>{typeof (enhancedCV?.languages || profile.languages) === 'object' 
                        ? JSON.stringify(enhancedCV?.languages || profile.languages).replace(/[{}"]/g, '').replace(/,/g, ', ').replace(/:/g, ': ')
                        : (enhancedCV?.languages || profile.languages)
                      }</p>
                    </div>
                  )}

                  {/* Tom CV melding */}
                  {!profile.summary && !profile.experience && !profile.education && (
                    <div className="cv-empty">
                      <p>CV-en din er tom. <button onClick={() => setActiveTab('cv')}>Fyll ut informasjon</button> for å se forhåndsvisning.</p>
                    </div>
                  )}
                </div>

                {enhancedCV && (
                  <div className="cv-enhanced-notice">
                    ✨ CV-en er forbedret med AI for å fremstå mer profesjonell
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* FANE: Søknadstekst-generator */}
        {activeTab === 'cover-letter' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>✍️ Søknadstekst-generator</h1>
                <p>Bruk AI til å lage personlige søknadstekster</p>
              </div>
            </header>

            <div className="dashboard-content">
              <CoverLetterGenerator 
                profile={profile} 
                aiLoading={aiLoading}
                generateCoverLetter={generateCoverLetter}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Komponent for søknadstekst-generator
function CoverLetterGenerator({ profile, aiLoading, generateCoverLetter }) {
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState('ai'); // 'ai' eller 'manual'

  async function handleGenerate() {
    if (!jobTitle || !companyName) {
      toast.warning('Fyll inn stillingstittel og bedriftsnavn');
      return;
    }

    if (!profile.summary && !profile.experience && !profile.skills) {
      toast.info('Tips: Fyll ut CV-en din for bedre søknadstekster');
    }

    setIsGenerating(true);
    const text = await generateCoverLetter(jobTitle, companyName);
    setCoverLetterText(text);
    setIsGenerating(false);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(coverLetterText);
    toast.success('Kopiert til utklippstavlen!');
  }

  return (
    <div className="cover-letter-generator">
      {/* Velg modus */}
      <div className="mode-selector">
        <button 
          className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
          onClick={() => setMode('ai')}
        >
          ✨ Generer med AI
        </button>
        <button 
          className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          ✏️ Skriv / Lim inn egen
        </button>
      </div>

      {mode === 'ai' && (
        <div className="generator-inputs">
          <div className="form-group">
            <label>Hvilken stilling søker du på?</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="F.eks. Frontend-utvikler"
            />
          </div>

          <div className="form-group">
            <label>Hvilken bedrift?</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="F.eks. TechNorge AS"
            />
          </div>

          <button 
            className="button primary ai-btn"
            onClick={handleGenerate}
            disabled={isGenerating || aiLoading}
          >
            {isGenerating ? '✨ Genererer...' : '✨ Generer søknadstekst'}
          </button>
          <p className="ai-powered-by">Drevet av Groq + Llama 3.3</p>

          {!profile.summary && !profile.experience && (
            <div className="generator-notice">
              <p>💡 <strong>Tips:</strong> Fyll ut CV-en din under "Rediger CV"-fanen for at AI-en skal kunne lage mer personlige søknadstekster.</p>
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div className="manual-input">
          <div className="form-group">
            <label>Lim inn eller skriv din søknadstekst</label>
            <textarea
              value={coverLetterText}
              onChange={(e) => setCoverLetterText(e.target.value)}
              placeholder="Lim inn din eksisterende søknadstekst her, eller skriv en ny fra bunnen av..."
              rows={12}
            />
          </div>
          <p className="manual-hint">
            💡 Du kan lime inn søknadstekster du allerede har skrevet og redigere dem her.
          </p>
        </div>
      )}

      {/* Resultat / Redigering */}
      {coverLetterText && (
        <div className="generated-result">
          <div className="result-header">
            <h3>{mode === 'ai' ? 'Generert søknadstekst' : 'Din søknadstekst'}</h3>
            <button className="button small" onClick={copyToClipboard}>
              📋 Kopier
            </button>
          </div>
          <textarea
            className="result-textarea"
            value={coverLetterText}
            onChange={(e) => setCoverLetterText(e.target.value)}
            rows={10}
          />
          <p className="result-hint">
            ✏️ Du kan redigere teksten direkte over før du kopierer den.
          </p>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
