// Dashboard for privatkonto (userType jobseeker) – CV, søknader og profil

import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { polishProfileLocal } from '../services/freeTemplates';
import { syncPublicProfileImageFromCv } from '../services/social';
import { buildUserSearchNameLower } from '../utils/searchName';
import UserNetworkPanel from '../components/UserNetworkPanel';
import IncomingFriendRequestsPanel from '../components/IncomingFriendRequestsPanel';
import NotificationSettingsPanel from '../components/NotificationSettingsPanel';
import '../styles/Dashboard.css';

const dismissedMessagesStorageKey = (uid) => `jobportal-dismissed-company-messages:${uid}`;

function readDismissedMessageAppIds(uid) {
  if (!uid) return new Set();
  try {
    const raw = localStorage.getItem(dismissedMessagesStorageKey(uid));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissedMessageAppIds(uid, idSet) {
  if (!uid) return;
  localStorage.setItem(dismissedMessagesStorageKey(uid), JSON.stringify([...idSet]));
}

function UserDashboard() {
  const { currentUser, userData, refreshUserData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('applications');
  const [saving, setSaving] = useState(false);
  const [enhancedCV, setEnhancedCV] = useState(null);
  const [generatingCV, setGeneratingCV] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dismissedMessageAppIds, setDismissedMessageAppIds] = useState(() => new Set());
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  
  // CV/Profil-data
  const [profile, setProfile] = useState({
    summary: '',
    experience: '',
    education: '',
    skills: '',
    languages: '',
    jobTitle: '',
    profileImage: '',
    phone: '',
    location: '',
    desiredPosition: '',
    linkedIn: '',
    portfolio: '',
    publicHandle: '',
    coverImage: '',
    publicHeadline: '',
    publicIntro: '',
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

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'network') {
      setActiveTab('network');
    } else if (tab === 'cv') {
      setActiveTab('cv');
    } else if (tab === 'public-profile') {
      setActiveTab('public-profile');
    } else if (tab === 'notifications') {
      setActiveTab('notifications');
    } else if (tab === 'applications') {
      setActiveTab('applications');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setDismissedMessageAppIds(new Set());
      return;
    }
    setDismissedMessageAppIds(readDismissedMessageAppIds(currentUser.uid));
  }, [currentUser?.uid]);

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
      await refreshUserData();
      try {
        await syncPublicProfileImageFromCv(currentUser.uid);
      } catch {
        /* ingen offentlig profil ennå */
      }

      toast.success('Profilbilde lagret på kontoen din');

    } catch (error) {
      console.error('Feil ved opplasting:', error);
      toast.error('Kunne ikke laste opp bilde. Prøv igjen.');
    }
    setUploadingImage(false);
  }

  async function handleCoverUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    event.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Velg et bilde (JPG, PNG …)');
      return;
    }
    if (file.size > 1.2 * 1024 * 1024) {
      toast.error('Bannerbilde kan være maks ca. 1,2 MB. Prøv et mindre bilde.');
      return;
    }

    setUploadingCover(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await setDoc(
        doc(db, 'profiles', currentUser.uid),
        { coverImage: base64, updatedAt: new Date() },
        { merge: true },
      );
      setProfile((prev) => ({ ...prev, coverImage: base64 }));
      await refreshUserData();
      toast.success('Banner lagret — vises øverst på den offentlige profilen');
    } catch (error) {
      console.error(error);
      toast.error('Kunne ikke laste opp banner.');
    }
    setUploadingCover(false);
  }

  // Lagre CV/profil og generer forhåndsvisning
  async function savePublicProfile() {
    if (!currentUser) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'profiles', currentUser.uid),
        {
          publicHeadline: profile.publicHeadline,
          publicIntro: profile.publicIntro,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      await updateDoc(doc(db, 'users', currentUser.uid), {
        searchNameLower: buildUserSearchNameLower(
          userData?.firstName,
          userData?.lastName,
        ),
      });

      toast.success('Profilside lagret – slik ser besøkende deg først.');
    } catch (error) {
      console.error('Feil ved lagring av profilside:', error);
      toast.error('Kunne ikke lagre profilside. Prøv igjen.');
    }
    setSaving(false);
  }

  async function saveProfile() {
    if (!currentUser) return;
    
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'profiles', currentUser.uid),
        {
          ...profile,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      await updateDoc(doc(db, 'users', currentUser.uid), {
        searchNameLower: buildUserSearchNameLower(
          userData?.firstName,
          userData?.lastName,
        ),
      });

      try {
        await syncPublicProfileImageFromCv(currentUser.uid);
      } catch {
        /* ingen offentlig profil */
      }

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

  // Ryddet CV-visning (punktlister) – helt lokalt
  async function generateEnhancedCV() {
    setGeneratingCV(true);
    try {
      setEnhancedCV(polishProfileLocal(profile));
    } catch (error) {
      console.error('CV-formatering feilet:', error);
      setEnhancedCV(null);
    }
    setGeneratingCV(false);
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
    : 'Privatperson';

  const applicationsWithCompanyMessage = applications.filter((a) => a.companyMessage);
  const undismissedMessageApps = applicationsWithCompanyMessage.filter(
    (a) => !dismissedMessageAppIds.has(a.id),
  );

  function dismissCompanyMessagesBanner() {
    if (!currentUser?.uid) return;
    const next = new Set(dismissedMessageAppIds);
    applicationsWithCompanyMessage.forEach((a) => next.add(a.id));
    setDismissedMessageAppIds(next);
    writeDismissedMessageAppIds(currentUser.uid, next);
  }

  // AuthContext har allerede hentet profilbilde fra Firestore før dashboardet vises;
  // ikke bruk currentUser.photoURL her – det gir et kort blink med Google-bilde før fetchData() er ferdig.
  const displayProfileImage = profile.profileImage || userData?.profileImage || '';

  return (
    <div className="dashboard">
      {/* Skjult filvelger – alltid montert (sidebar + CV-fanen bruker samme) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="visually-hidden-file-input"
        aria-hidden="true"
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="visually-hidden-file-input"
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-account-card">
          <button
            type="button"
            className="sidebar-avatar-wrap"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            title="Bytt profilbilde"
          >
            {displayProfileImage ? (
              <img src={displayProfileImage} alt="" className="sidebar-avatar" />
            ) : (
              <span className="sidebar-avatar-placeholder" aria-hidden>+</span>
            )}
            {uploadingImage && <span className="sidebar-avatar-loading">…</span>}
          </button>
          <p className="sidebar-account-label">Profilbilde på kontoen</p>
          <button
            type="button"
            className="sidebar-photo-link"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {displayProfileImage ? 'Bytt bilde' : 'Legg til bilde'}
          </button>
          <p className="sidebar-account-hint">Vises på offentlig profil og når du søker</p>
        </div>

        <div className="sidebar-banner-block">
          <p className="sidebar-account-label">Banner på profilsiden</p>
          <p className="sidebar-account-hint">Bredde bilde øverst når andre åpner profilen din.</p>
          <button
            type="button"
            className="sidebar-photo-link"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
          >
            {uploadingCover ? 'Laster opp…' : profile.coverImage ? 'Bytt banner' : 'Last opp banner'}
          </button>
        </div>

        <div className="sidebar-header">
          <h2 className="sidebar-user-name">{fullName}</h2>
        </div>
        <nav className="sidebar-nav" aria-label="Dashbordmeny">
          <p className="sidebar-label">Offentlig profil</p>
          <div className="sidebar-nav-stack">
            <Link to="/profil/me" className="sidebar-nav-link sidebar-nav-link--highlight">
              Vis profilen
            </Link>
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'public-profile' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('public-profile');
                setSearchParams({ tab: 'public-profile' });
              }}
            >
              Rediger profilside
            </button>
            <Link to="/profil/me/cv" className="sidebar-nav-link">
              CV-side (lenke)
            </Link>
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'network' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('network');
                setSearchParams({ tab: 'network' });
              }}
            >
              Nettverk & tips
            </button>
          </div>

          <p className="sidebar-label sidebar-label--spaced">CV og søknader</p>
          <div className="sidebar-nav-stack">
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'applications' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('applications');
                setSearchParams({});
              }}
            >
              Mine søknader
            </button>
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'cv' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('cv');
                setSearchParams({});
              }}
            >
              Rediger CV
            </button>
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'cv-preview' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('cv-preview');
                setSearchParams({});
              }}
            >
              Forhåndsvis CV
            </button>
          </div>

          <p className="sidebar-label sidebar-label--spaced">Konto</p>
          <div className="sidebar-nav-stack">
            <button
              type="button"
              className={`sidebar-nav-link${activeTab === 'notifications' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('notifications');
                setSearchParams({ tab: 'notifications' });
              }}
            >
              Varsler
            </button>
          </div>

          <div className="sidebar-nav-divider" role="presentation" />
          <Link to="/jobs" className="sidebar-nav-link sidebar-nav-link--jobs">
            Finn jobber
          </Link>
        </nav>
      </aside>

      <main className="dashboard-main">
        <IncomingFriendRequestsPanel />

        {activeTab === 'public-profile' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Profilside</h1>
                <p>
                  Dette er teksten besøkende ser på din{' '}
                  <Link to="/profil/me">offentlige profil</Link> – adskilt fra CV-en. CV med erfaring
                  og utdanning ligger på <Link to="/profil/me/cv">CV-siden</Link>.
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                onClick={savePublicProfile}
                disabled={saving}
              >
                {saving ? 'Lagrer…' : 'Lagre profilside'}
              </button>
            </header>

            <div className="dashboard-content">
              <div className="cv-form">
                <div className="form-group">
                  <label>Overskrift (valgfritt)</label>
                  <input
                    type="text"
                    value={profile.publicHeadline}
                    onChange={(e) =>
                      setProfile({ ...profile, publicHeadline: e.target.value })
                    }
                    placeholder="F.eks: Markedskoordinator · Oslo"
                  />
                  <small className="form-hint">
                    Kort linje under navnet – trenger ikke matche stillingstittel i CV.
                  </small>
                </div>
                <div className="form-group">
                  <label>Om meg (profilside)</label>
                  <textarea
                    value={profile.publicIntro}
                    onChange={(e) =>
                      setProfile({ ...profile, publicIntro: e.target.value })
                    }
                    placeholder="Skriv en kort introduksjon til besøkende (2–5 setninger). Dette er ikke CV-sammendraget – det redigerer du under «Rediger CV»."
                    rows={6}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* FANE: Mine søknader */}
        {activeTab === 'applications' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Mine søknader</h1>
                <p>Følg med på statusen til dine jobbsøknader</p>
              </div>
              <Link to="/jobs" className="button primary">
                Finn nye jobber
              </Link>
            </header>

            <div className={`stats-grid${loading ? ' stats-grid--pending' : ''}`}>
              <div className="stat-card">
                <span className="stat-number">{loading ? '–' : applications.length}</span>
                <span className="stat-label">Totalt søknader</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {loading ? '–' : applications.filter(a => a.status === 'pending').length}
                </span>
                <span className="stat-label">Under vurdering</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">
                  {loading ? '–' : applications.filter(a => a.status === 'interview').length}
                </span>
                <span className="stat-label">Til intervju</span>
              </div>
            </div>

            {/* Varsel om nye meldinger (kan lukkes; lagres lokalt per søknad-ID) */}
            {undismissedMessageApps.length > 0 && (
              <div className="interview-alert">
                <div className="alert-content">
                  <strong>
                    Du har {undismissedMessageApps.length} melding(er) fra bedrifter!
                  </strong>
                  <p>Se nedenfor for detaljer om intervjuinvitasjoner eller annen informasjon.</p>
                </div>
                <button
                  type="button"
                  className="interview-alert-dismiss"
                  onClick={dismissCompanyMessagesBanner}
                  aria-label="Lukk varsel"
                  title="Skjul varselet (meldingene finnes fortsatt under hver søknad)"
                >
                  ×
                </button>
              </div>
            )}

            <div className="dashboard-content">
              <h2 className="section-title">Søknadshistorikk</h2>
              
              {loading ? (
                <p className="loading-text">Laster søknader...</p>
              ) : applications.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-graphic" aria-hidden />
                  <h3>Ingen søknader ennå</h3>
                  <p>Du har ikke sendt noen søknader ennå. Finn din drømmejobb!</p>
                  <Link to="/jobs" className="button primary">
                    Finn jobber
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
                          {application.companyId ? (
                            <Link to={`/bedrift/${application.companyId}`} className="company-name application-company-link">
                              {application.companyName}
                            </Link>
                          ) : (
                            <p className="company-name">{application.companyName}</p>
                          )}
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
                <p>
                  Dette innholdet brukes i søknader og på CV-siden – ikke på forsiden av den offentlige
                  profilen (rediger «Profilside» for det).
                </p>
              </div>
              <button 
                className="button primary" 
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? 'Lagrer...' : 'Lagre CV'}
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
                    {displayProfileImage ? (
                      <img src={displayProfileImage} alt="Profilbilde" />
                    ) : (
                      <div className="upload-placeholder">
                        <span className="upload-icon" aria-hidden>+</span>
                        <span>Legg til bilde</span>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="upload-overlay">
                        <span>Laster opp...</span>
                      </div>
                    )}
                  </div>
                  <p className="image-hint">Klikk for å laste opp profilbilde (samme som i menyen til venstre)</p>
                </div>

                {/* Kontaktinformasjon */}
                <div className="form-section-title form-section-title--accent">Kontaktinformasjon</div>
                
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
                <div className="form-section-title form-section-title--accent">Jobbønsker</div>

                <div className="form-group">
                  <label>Ønsket stilling / Yrke</label>
                  <input
                    type="text"
                    value={profile.jobTitle}
                    onChange={(e) => setProfile({...profile, jobTitle: e.target.value})}
                    placeholder="F.eks: Frontend-utvikler, Markedssjef, Sykepleier"
                  />
                  <small className="form-hint">Brukes i forhåndsvisning og i lokale søknadsmaler</small>
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
                <div className="form-section-title form-section-title--accent">Om deg</div>

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
              <h2>Tips for god CV</h2>
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
                <h1>Min CV</h1>
                <p>Slik ser CV-en din ut for arbeidsgivere</p>
              </div>
              <div className="header-actions">
                <button 
                  className="button secondary"
                  onClick={() => setActiveTab('cv')}
                >
                  Rediger
                </button>
                <button 
                  className="button primary"
                  onClick={generateEnhancedCV}
                  disabled={generatingCV}
                >
                  {generatingCV ? 'Formatterer…' : 'Strukturer CV (lokalt)'}
                </button>
              </div>
            </header>

            {generatingCV ? (
              <div className="cv-loading">
                <div className="loading-spinner"></div>
                <p>Formatterer CV-en…</p>
              </div>
            ) : (
              <div className="cv-preview-container">
                <div className="cv-document">
                  {/* Header med navn og bilde */}
                  <div className="cv-header">
                    {displayProfileImage && (
                      <img 
                        src={displayProfileImage} 
                        alt={fullName}
                        className="cv-profile-image"
                      />
                    )}
                    <div className="cv-header-text">
                      <h1 className="cv-name">{fullName}</h1>
                      <p className="cv-headline">
                        {String(enhancedCV?.headline || profile.jobTitle || 'Privatperson')}
                      </p>
                      <div className="cv-contact-info">
                        <span>{userData?.email || currentUser?.email}</span>
                        {profile.phone && <span>{profile.phone}</span>}
                        {profile.location && <span>{profile.location}</span>}
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
                    Strukturert visning (lokalt) – innholdet er ditt; les gjennom før du søker.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'notifications' && <NotificationSettingsPanel />}

        {activeTab === 'network' && (
          <div className="dashboard-content dashboard-content--network">
            <UserNetworkPanel />
          </div>
        )}
      </main>
    </div>
  );
}

export default UserDashboard;
