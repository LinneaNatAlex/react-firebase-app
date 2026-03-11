// Stillingslisteside - viser alle aktive jobber, alle kan se denne

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { collection, getDocs, addDoc, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isAIConfigured } from '../services/ai';
import '../styles/JobsPage.css';

function JobsPage() {
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Søk og filter
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Valgt jobb og søknadsprosess
  const [selectedJob, setSelectedJob] = useState(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  async function fetchJobs() {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'jobs'));
      
      const jobsList = querySnapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));
      
      // Vis kun aktive stillinger
      const activeJobs = jobsList.filter(job => job.status === 'active');
      setJobs(activeJobs);
    } catch (error) {
      console.error('Feil ved henting av stillinger:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  // Filtrer basert på søkeord og sted
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = !locationFilter || 
                           job.location?.toLowerCase().includes(locationFilter.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  // Hent brukerens CV/profil
  async function fetchUserProfile() {
    if (!currentUser) return;
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
      if (profileDoc.exists()) {
        setUserProfile(profileDoc.data());
      }
    } catch (error) {
      console.error('Feil ved henting av profil:', error);
    }
  }

  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser]);

  // Åpne søknadsskjema
  function openApplyForm(job) {
    setSelectedJob(job);
    setShowApplyForm(true);
    setCoverLetter('');
  }

  // AI-generer søknadstekst
  async function generateCoverLetterAI() {
    if (!selectedJob) return;
    
    setAiGenerating(true);
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
              content: `Skriv en søknadstekst for stillingen "${selectedJob.title}" hos ${selectedJob.companyName}.

Stillingsbeskrivelse:
${selectedJob.description?.substring(0, 500)}

${userProfile ? `Min bakgrunn:
${userProfile.summary || ''}
${userProfile.experience || ''}
${userProfile.skills || ''}` : 'Jeg er en motivert jobbsøker.'}

Skriv en personlig og engasjerende søknadstekst på 150-200 ord.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      setCoverLetter(data.choices[0].message.content);
    } catch (error) {
      console.error('AI-feil:', error);
      toast.error('Kunne ikke generere tekst. Prøv igjen.');
    }
    setAiGenerating(false);
  }

  // Sender søknad på en stilling
  async function handleApply() {
    if (!currentUser || !selectedJob) return;

    // Sjekk at søknadstekst er fylt ut
    if (!coverLetter || coverLetter.trim().length < 10) {
      toast.warning('Vennligst skriv en søknadstekst (minst 10 tegn)');
      return;
    }

    try {
      // Sjekk om bruker allerede har søkt på denne stillingen
      const existingQuery = query(
        collection(db, 'applications'),
        where('userId', '==', currentUser.uid),
        where('jobId', '==', selectedJob.id)
      );
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {
        toast.info('Du har allerede søkt på denne stillingen');
        return;
      }

      // Opprett søknad med CV og søknadstekst
      const applicationData = {
        userId: currentUser.uid,
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        companyId: selectedJob.companyId,
        companyName: selectedJob.companyName,
        appliedAt: new Date(),
        status: 'pending',
        applicantName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
        applicantEmail: currentUser.email,
        coverLetter: coverLetter.trim(),
        profile: userProfile || null
      };

      await addDoc(collection(db, 'applications'), applicationData);

      toast.success('Søknad sendt! 🎉');
      setSelectedJob(null);
      setShowApplyForm(false);
      setCoverLetter('');
      
      // Gå til dashboard etter 1.5 sekunder
      setTimeout(() => {
        navigate('/dashboard/user');
      }, 1500);
    } catch (error) {
      console.error('Feil ved søknad:', error);
      toast.error('Kunne ikke sende søknad. Prøv igjen.');
    }
  }

  return (
    <div className="jobs-page">
      {/* Header med søkefelt */}
      <header className="jobs-header">
        <div className="jobs-header-content">
          <h1>Finn din drømmejobb</h1>
          <p>Utforsk ledige stillinger fra topp bedrifter</p>
          
          <div className="search-container">
            <div className="search-box">
              <input
                type="text"
                placeholder="Søk etter stilling, bedrift eller nøkkelord..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <input
                type="text"
                placeholder="Sted"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="location-input"
              />
              <button className="search-button">🔍 Søk</button>
            </div>
          </div>
        </div>
      </header>

      <main className="jobs-content">
        <div className="jobs-results-header">
          <h2>{filteredJobs.length} ledige stillinger</h2>
        </div>

        {loading ? (
          <p className="loading-text">Laster stillinger...</p>
        ) : filteredJobs.length === 0 ? (
          <div className="no-results">
            <span className="no-results-icon">🔍</span>
            <h3>Ingen stillinger funnet</h3>
            <p>Prøv å justere søket ditt eller fjern filtre</p>
          </div>
        ) : (
          <div className="jobs-grid">
            {filteredJobs.map(job => (
              <div key={job.id} className="job-listing-card">
                <div className="job-listing-header">
                  <div className="company-logo">
                    {job.companyName?.charAt(0) || '?'}
                  </div>
                  <div className="job-listing-title">
                    <h3>{job.title}</h3>
                    <p className="company-name">{job.companyName}</p>
                  </div>
                </div>
                
                <div className="job-listing-meta">
                  <span>📍 {job.location || 'Ikke spesifisert'}</span>
                  <span>💼 {job.type === 'full-time' ? 'Heltid' : 
                           job.type === 'part-time' ? 'Deltid' : 
                           job.type === 'contract' ? 'Kontrakt' : 
                           job.type}</span>
                </div>

                {job.salary && (
                  <p className="job-salary">💰 {job.salary}</p>
                )}

                <p className="job-listing-description">
                  {job.description?.substring(0, 120)}...
                </p>

                <div className="job-listing-footer">
                  <span className="job-date">
                    Publisert: {job.createdAt?.toDate?.() 
                      ? new Date(job.createdAt.toDate()).toLocaleDateString('nb-NO')
                      : 'Nylig'}
                  </span>
                  <button 
                    className="view-job-button"
                    onClick={() => setSelectedJob(job)}
                  >
                    Se stilling →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal som viser full stillingsbeskrivelse */}
      {selectedJob && !showApplyForm && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="job-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-modal"
              onClick={() => setSelectedJob(null)}
            >
              ✕
            </button>

            <div className="job-modal-header">
              <div className="company-logo large">
                {selectedJob.companyName?.charAt(0) || '?'}
              </div>
              <div>
                <h2>{selectedJob.title}</h2>
                <p className="company-name">{selectedJob.companyName}</p>
              </div>
            </div>

            <div className="job-modal-meta">
              <span>📍 {selectedJob.location || 'Ikke spesifisert'}</span>
              <span>💼 {selectedJob.type === 'full-time' ? 'Heltid' : selectedJob.type}</span>
              {selectedJob.salary && <span>💰 {selectedJob.salary}</span>}
            </div>

            <div className="job-modal-description">
              <h3>Om stillingen</h3>
              <p>{selectedJob.description}</p>
            </div>

            <div className="job-modal-actions">
              {currentUser ? (
                userData?.userType === 'jobseeker' ? (
                  <button 
                    className="apply-button"
                    onClick={() => openApplyForm(selectedJob)}
                  >
                    Søk på stillingen
                  </button>
                ) : (
                  <p className="info-text">Logg inn som jobbsøker for å søke</p>
                )
              ) : (
                <p className="info-text">
                  <a href="/login">Logg inn</a> eller <a href="/register">registrer deg</a> for å søke
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Søknadsskjema-modal */}
      {showApplyForm && selectedJob && (
        <div className="modal-overlay" onClick={() => { setShowApplyForm(false); setSelectedJob(null); }}>
          <div className="job-modal apply-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-modal"
              onClick={() => { setShowApplyForm(false); setSelectedJob(null); }}
            >
              ✕
            </button>

            <h2>Søk på: {selectedJob.title}</h2>
            <p className="company-name">{selectedJob.companyName}</p>

            {userProfile ? (
              <div className="profile-preview">
                <h4>📎 Din CV vil bli vedlagt</h4>
                <p>{userProfile.summary?.substring(0, 100) || 'Profil uten sammendrag'}...</p>
              </div>
            ) : (
              <div className="profile-notice">
                <p>💡 <strong>Tips:</strong> <a href="/dashboard/user">Fyll ut CV-en din</a> for å gjøre søknaden mer komplett!</p>
              </div>
            )}

            <div className="apply-form">
              <div className="form-group">
                <div className="cover-letter-header">
                  <label>Søknadstekst *</label>
                  {isAIConfigured() && (
                    <>
                      <button 
                        type="button"
                        className="ai-btn-small"
                        onClick={generateCoverLetterAI}
                        disabled={aiGenerating}
                      >
                        {aiGenerating ? '✨ Genererer...' : '✨ Generer med AI'}
                      </button>
                      <span className="ai-credit-inline">Groq + Llama 3.3</span>
                    </>
                  )}
                </div>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Fortell hvorfor du er interessert i stillingen og hva du kan bidra med..."
                  rows={8}
                  required
                />
                <p className="form-hint">
                  {coverLetter.length > 0 
                    ? `${coverLetter.length} tegn` 
                    : 'Skriv selv eller klikk "Generer med AI" for å lage en søknadstekst'}
                </p>
              </div>

              <div className="apply-actions">
                <button 
                  className="button secondary"
                  onClick={() => { setShowApplyForm(false); setSelectedJob(null); }}
                >
                  Avbryt
                </button>
                <button 
                  className="apply-button"
                  onClick={handleApply}
                >
                  📨 Send søknad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobsPage;
