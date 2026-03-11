// Dashboard for bedrifter - administrer stillingsannonser og se søkere

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateJobPosting, isAIConfigured } from '../services/ai';
import '../styles/Dashboard.css';

function CompanyDashboard() {
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs');
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [rankingInProgress, setRankingInProgress] = useState(false);
  
  // Melding til søker
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');

  // Skjemadata for ny stilling
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    location: '',
    type: 'full-time',
    salary: '',
    keywords: ''
  });

  // Hent stillinger og søknader
  async function fetchData() {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Hent stillinger
      const jobsQuery = query(
        collection(db, 'jobs'),
        where('companyId', '==', currentUser.uid)
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsList = jobsSnapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));
      
      // Hent job IDs for denne bedriften
      const jobIds = jobsList.map(job => job.id);
      
      // Hent alle søknader - først prøv med companyId, deretter filtrer på jobId
      let appsList = [];
      
      if (jobIds.length > 0) {
        // Hent alle søknader fra databasen
        const allAppsSnapshot = await getDocs(collection(db, 'applications'));
        
        // Filtrer søknader som matcher våre stillinger
        const relevantApps = allAppsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return jobIds.includes(data.jobId) || data.companyId === currentUser.uid;
        });
        
        appsList = await Promise.all(
          relevantApps.map(async (document) => {
            const appData = { id: document.id, ...document.data() };
            
            // Hent søkerens profil hvis den finnes
            if (appData.userId) {
              try {
                const profileDoc = await getDoc(doc(db, 'profiles', appData.userId));
                if (profileDoc.exists()) {
                  appData.profile = profileDoc.data();
                }
              } catch (e) {
                console.error('Kunne ikke hente profil:', e);
              }
            }
            return appData;
          })
        );
      }

      // Oppdater søkertall på hver stilling
      const jobsWithCounts = jobsList.map(job => ({
        ...job,
        applicantCount: appsList.filter(app => app.jobId === job.id).length
      }));
      
      setJobs(jobsWithCounts);
      setApplications(appsList);
    } catch (error) {
      console.error('Feil ved henting av data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Lagrer ny stilling
  async function handleCreateJob(event) {
    event.preventDefault();

    try {
      await addDoc(collection(db, 'jobs'), {
        ...newJob,
        companyId: currentUser.uid,
        companyName: userData?.companyName || 'Ukjent bedrift',
        createdAt: new Date(),
        status: 'active'
      });

      setNewJob({
        title: '',
        description: '',
        location: '',
        type: 'full-time',
        salary: '',
        keywords: ''
      });
      setShowNewJobForm(false);
      fetchData();
    } catch (error) {
      console.error('Feil ved opprettelse av jobb:', error);
    }
  }

  async function handleDeleteJob(jobId) {
    if (!window.confirm('Er du sikker på at du vil slette denne stillingen?')) return;

    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      fetchData();
    } catch (error) {
      console.error('Feil ved sletting:', error);
    }
  }

  // AI-generering av stillingsannonse
  async function handleGenerateWithAI() {
    if (!newJob.title) {
      setAiError('Fyll inn stillingstittel først');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const generatedText = await generateJobPosting({
        title: newJob.title,
        company: userData?.companyName || 'Bedriften',
        location: newJob.location || 'Norge',
        type: newJob.type === 'full-time' ? 'Heltid' : 
              newJob.type === 'part-time' ? 'Deltid' : 
              newJob.type === 'contract' ? 'Kontrakt' : 'Internship',
        keywords: newJob.keywords
      });

      setNewJob({ ...newJob, description: generatedText });
    } catch (error) {
      console.error('AI-feil:', error);
      setAiError(error.message || 'Kunne ikke generere tekst. Prøv igjen.');
    } finally {
      setAiLoading(false);
    }
  }

  // AI-rangering av søkere for en stilling
  async function rankApplicants(job) {
    const jobApplications = applications.filter(app => app.jobId === job.id);
    if (jobApplications.length === 0) {
      toast.warning('Ingen søkere å rangere');
      return;
    }

    if (!isAIConfigured()) {
      toast.error('AI er ikke konfigurert');
      return;
    }

    setRankingInProgress(true);

    try {
      // Bygg søkeroversikt for AI
      const applicantSummaries = jobApplications.map((app, index) => {
        const profile = app.profile || {};
        return `
Søker ${index + 1} (ID: ${app.id}):
- Navn: ${app.applicantName || 'Ikke oppgitt'}
- Erfaring: ${profile.experience || 'Ikke oppgitt'}
- Utdanning: ${profile.education || 'Ikke oppgitt'}
- Ferdigheter: ${profile.skills || 'Ikke oppgitt'}
- Søknadstekst: ${app.coverLetter?.substring(0, 300) || 'Ingen'}
`;
      }).join('\n');

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
              content: `Du er en erfaren rekrutterer som evaluerer jobbsøkere objektivt.
Gi en score fra 1-100 og kort begrunnelse for hver søker.
Svar i JSON-format: [{"id": "søker-id", "score": tall, "reason": "kort begrunnelse"}]`
            },
            { 
              role: 'user', 
              content: `Ranger disse søkerne for stillingen "${job.title}".

Stillingsbeskrivelse:
${job.description?.substring(0, 500)}

Søkere:
${applicantSummaries}

Ranger søkerne fra best til dårligst match. Svar KUN med JSON-array.`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rankings = JSON.parse(jsonMatch[0]);
        
        // Oppdater søknadene med score
        for (const ranking of rankings) {
          const appRef = doc(db, 'applications', ranking.id);
          await updateDoc(appRef, {
            aiScore: ranking.score,
            aiReason: ranking.reason
          });
        }
        
        // Oppdater lokal state
        fetchData();
        toast.success('Søkere er rangert!');
      }
    } catch (error) {
      console.error('Rangering feilet:', error);
      toast.error('Kunne ikke rangere søkere. Prøv igjen.');
    }
    
    setRankingInProgress(false);
  }

  // Oppdater søknadsstatus
  // Håndter statusendring - vis meldingsmodal for intervju
  function handleStatusChange(applicant, newStatus) {
    if (newStatus === 'interview') {
      // Vis modal for å sende melding
      setMessageRecipient(applicant);
      setPendingStatus(newStatus);
      setMessageText(`Hei ${applicant.applicantName || 'søker'}!\n\nVi vil gjerne invitere deg til intervju for stillingen "${applicant.jobTitle}".\n\nVi tar kontakt med deg for å avtale tidspunkt.\n\nMed vennlig hilsen\n${userData?.companyName || 'Bedriften'}`);
      setShowMessageModal(true);
    } else {
      // Oppdater status direkte for andre statuser
      updateApplicationStatus(applicant.id, newStatus, null);
    }
  }

  // Oppdater status og eventuelt legg til melding
  async function updateApplicationStatus(appId, newStatus, message) {
    try {
      const updateData = { 
        status: newStatus,
        statusUpdatedAt: new Date()
      };
      
      if (message) {
        updateData.companyMessage = message;
        updateData.messageDate = new Date();
        updateData.messageSender = userData?.companyName || 'Bedriften';
      }
      
      await updateDoc(doc(db, 'applications', appId), updateData);
      fetchData();
    } catch (error) {
      console.error('Kunne ikke oppdatere status:', error);
    }
  }

  // Send melding og oppdater status
  async function sendMessageAndUpdateStatus() {
    if (!messageRecipient || !pendingStatus) return;
    
    await updateApplicationStatus(messageRecipient.id, pendingStatus, messageText);
    
    toast.success(`Invitasjon sendt til ${messageRecipient.applicantName}! 🎉`);
    
    setShowMessageModal(false);
    setMessageRecipient(null);
    setMessageText('');
    setPendingStatus('');
    
    if (selectedApplicant?.id === messageRecipient.id) {
      setSelectedApplicant({...selectedApplicant, status: pendingStatus, companyMessage: messageText});
    }
  }

  // Hent søkere for valgt stilling
  const getApplicantsForJob = (jobId) => {
    return applications
      .filter(app => app.jobId === jobId)
      .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
  };

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>🏢 {userData?.companyName || 'Min bedrift'}</h2>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={activeTab === 'jobs' ? 'active' : ''}
            onClick={() => { setActiveTab('jobs'); setSelectedJob(null); }}
          >
            📋 Stillinger ({jobs.length})
          </button>
          <button 
            className={activeTab === 'applicants' ? 'active' : ''}
            onClick={() => setActiveTab('applicants')}
          >
            👥 Alle søkere ({applications.length})
          </button>
        </nav>
      </aside>

      <main className="dashboard-main">
        {/* STILLINGER-FANE */}
        {activeTab === 'jobs' && !selectedJob && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Stillingsannonser</h1>
                <p>Administrer dine utlyste stillinger</p>
              </div>
              <button className="button primary" onClick={() => setShowNewJobForm(true)}>
                + Ny stilling
              </button>
            </header>

            <div className="dashboard-content">
              {loading ? (
                <p className="loading-text">Laster stillinger...</p>
              ) : jobs.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <h3>Ingen stillinger ennå</h3>
                  <p>Opprett din første stillingsannonse for å begynne å motta søkere.</p>
                  <button className="button primary" onClick={() => setShowNewJobForm(true)}>
                    + Opprett stilling
                  </button>
                </div>
              ) : (
                <div className="jobs-list">
                  {jobs.map(job => (
                    <div key={job.id} className="job-card">
                      <div className="job-card-header">
                        <h3>{job.title}</h3>
                        <span className={`status-badge ${job.status}`}>
                          {job.status === 'active' ? 'Aktiv' : 'Pauset'}
                        </span>
                      </div>
                      <div className="job-card-meta">
                        <span>📍 {job.location || 'Ikke spesifisert'}</span>
                        <span>💼 {job.type === 'full-time' ? 'Heltid' : job.type}</span>
                      </div>
                      <p className="job-card-description">
                        {job.description?.substring(0, 150)}...
                      </p>
                      <div className="job-card-footer">
                        <span className={`applicant-count ${job.applicantCount > 0 ? 'has-applicants' : ''}`}>
                          👥 {job.applicantCount || 0} søkere
                        </span>
                        <div className="job-card-actions">
                          <button 
                            className="button small primary"
                            onClick={() => setSelectedJob(job)}
                          >
                            Se søkere
                          </button>
                          <button 
                            className="button small danger"
                            onClick={() => handleDeleteJob(job.id)}
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* SØKERE FOR VALGT STILLING */}
        {activeTab === 'jobs' && selectedJob && (
          <>
            <header className="dashboard-header">
              <div>
                <button className="back-link" onClick={() => setSelectedJob(null)}>
                  ← Tilbake til stillinger
                </button>
                <h1>Søkere: {selectedJob.title}</h1>
                <p>{getApplicantsForJob(selectedJob.id).length} søkere</p>
              </div>
              {isAIConfigured() && getApplicantsForJob(selectedJob.id).length > 0 && (
                <button 
                  className="button primary ai-btn"
                  onClick={() => rankApplicants(selectedJob)}
                  disabled={rankingInProgress}
                >
                  {rankingInProgress ? '✨ Rangerer...' : '✨ AI-ranger søkere'}
                </button>
              )}
            </header>

            <div className="dashboard-content">
              {getApplicantsForJob(selectedJob.id).length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">👥</span>
                  <h3>Ingen søkere ennå</h3>
                  <p>Når jobbsøkere sender søknader, vil de vises her.</p>
                </div>
              ) : (
                <div className="applicants-list">
                  {getApplicantsForJob(selectedJob.id).map((app, index) => (
                    <div key={app.id} className="applicant-card">
                      <div className="applicant-rank">
                        {app.aiScore ? (
                          <div className="rank-badge">
                            <span className="rank-number">#{index + 1}</span>
                            <span className="rank-score">{app.aiScore}/100</span>
                          </div>
                        ) : (
                          <span className="no-rank">-</span>
                        )}
                      </div>
                      
                      <div className="applicant-info">
                        <div className="applicant-header">
                          {app.profile?.profileImage && (
                            <img src={app.profile.profileImage} alt="" className="applicant-avatar" />
                          )}
                          <div>
                            <h3>{app.applicantName || 'Ukjent søker'}</h3>
                            <p className="applicant-email">{app.applicantEmail}</p>
                          </div>
                        </div>
                        
                        {app.aiReason && (
                          <p className="ai-reason">✨ {app.aiReason}</p>
                        )}
                        
                        {app.profile?.skills && (
                          <div className="applicant-skills">
                            {app.profile.skills.split(',').slice(0, 4).map((skill, i) => (
                              <span key={i} className="skill-tag small">{skill.trim()}</span>
                            ))}
                          </div>
                        )}
                        
                        <p className="applicant-date">
                          Søkt: {app.appliedAt?.toDate?.()?.toLocaleDateString('nb-NO') || '-'}
                        </p>
                      </div>
                      
                      <div className="applicant-actions">
                        <select 
                          value={app.status || 'pending'}
                          onChange={(e) => handleStatusChange(app, e.target.value)}
                          className="status-select"
                        >
                          <option value="pending">Under vurdering</option>
                          <option value="reviewed">Gjennomgått</option>
                          <option value="interview">Til intervju</option>
                          <option value="accepted">Akseptert</option>
                          <option value="rejected">Avslått</option>
                        </select>
                        <button 
                          className="button small primary"
                          onClick={() => handleStatusChange(app, 'interview')}
                          title="Send melding og inviter til intervju"
                        >
                          📩 Inviter
                        </button>
                        <button 
                          className="button small"
                          onClick={() => setSelectedApplicant(app)}
                        >
                          Se detaljer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ALLE SØKERE-FANE */}
        {activeTab === 'applicants' && (
          <>
            <header className="dashboard-header">
              <div>
                <h1>Alle søkere</h1>
                <p>Oversikt over alle søknader du har mottatt</p>
              </div>
            </header>

            <div className="dashboard-content">
              {applications.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">👥</span>
                  <h3>Ingen søkere ennå</h3>
                  <p>Når jobbsøkere sender søknader på dine stillinger, vil de vises her.</p>
                </div>
              ) : (
                <div className="applicants-list">
                  {applications.map(app => (
                    <div key={app.id} className="applicant-card">
                      <div className="applicant-info">
                        <div className="applicant-header">
                          {app.profile?.profileImage && (
                            <img src={app.profile.profileImage} alt="" className="applicant-avatar" />
                          )}
                          <div>
                            <h3>{app.applicantName || 'Ukjent søker'}</h3>
                            <p className="applicant-job">Søkt på: {app.jobTitle}</p>
                          </div>
                        </div>
                        <p className="applicant-date">
                          {app.appliedAt?.toDate?.()?.toLocaleDateString('nb-NO') || '-'}
                        </p>
                      </div>
                      
                      <div className="applicant-actions">
                        <span className={`status-badge ${app.status || 'pending'}`}>
                          {app.status === 'interview' ? 'Til intervju' :
                           app.status === 'accepted' ? 'Akseptert' :
                           app.status === 'rejected' ? 'Avslått' :
                           app.status === 'reviewed' ? 'Gjennomgått' : 'Under vurdering'}
                        </span>
                        <button 
                          className="button small"
                          onClick={() => setSelectedApplicant(app)}
                        >
                          Se detaljer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* NY STILLING MODAL */}
        {showNewJobForm && (
          <div className="modal-overlay" onClick={() => setShowNewJobForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Opprett ny stilling</h2>
              <form onSubmit={handleCreateJob} className="job-form">
                <div className="form-group">
                  <label>Stillingstittel *</label>
                  <input
                    type="text"
                    value={newJob.title}
                    onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                    placeholder="F.eks. Frontend-utvikler"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nøkkelord for AI</label>
                  <input
                    type="text"
                    value={newJob.keywords}
                    onChange={(e) => setNewJob({...newJob, keywords: e.target.value})}
                    placeholder="F.eks. React, TypeScript, 3 års erfaring"
                  />
                </div>

                <div className="form-group">
                  <div className="description-header">
                    <label>Beskrivelse *</label>
                    {isAIConfigured() && (
                      <button
                        type="button"
                        className="ai-generate-btn"
                        onClick={handleGenerateWithAI}
                        disabled={aiLoading}
                      >
                        {aiLoading ? '✨ Genererer...' : '✨ Generer med AI'}
                      </button>
                    )}
                  </div>
                  {aiError && <p className="ai-error">{aiError}</p>}
                  {isAIConfigured() && (
                    <p className="ai-powered-by">Drevet av Groq + Llama 3.3</p>
                  )}
                  <textarea
                    value={newJob.description}
                    onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                    placeholder="Beskriv stillingen..."
                    rows={8}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sted</label>
                    <input
                      type="text"
                      value={newJob.location}
                      onChange={(e) => setNewJob({...newJob, location: e.target.value})}
                      placeholder="F.eks. Oslo"
                    />
                  </div>
                  <div className="form-group">
                    <label>Stillingstype</label>
                    <select
                      value={newJob.type}
                      onChange={(e) => setNewJob({...newJob, type: e.target.value})}
                    >
                      <option value="full-time">Heltid</option>
                      <option value="part-time">Deltid</option>
                      <option value="contract">Kontrakt</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Lønn (valgfritt)</label>
                  <input
                    type="text"
                    value={newJob.salary}
                    onChange={(e) => setNewJob({...newJob, salary: e.target.value})}
                    placeholder="F.eks. 500 000 - 650 000 kr"
                  />
                </div>

                <div className="form-buttons">
                  <button type="button" className="button secondary" onClick={() => setShowNewJobForm(false)}>
                    Avbryt
                  </button>
                  <button type="submit" className="button primary">
                    Publiser stilling
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SØKER-DETALJER MODAL */}
        {selectedApplicant && (
          <div className="modal-overlay" onClick={() => setSelectedApplicant(null)}>
            <div className="modal applicant-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setSelectedApplicant(null)}>✕</button>
              
              <div className="applicant-detail-header">
                {selectedApplicant.profile?.profileImage && (
                  <img src={selectedApplicant.profile.profileImage} alt="" className="detail-avatar" />
                )}
                <div>
                  <h2>{selectedApplicant.applicantName || 'Søker'}</h2>
                  <p>{selectedApplicant.applicantEmail}</p>
                  {selectedApplicant.aiScore && (
                    <span className="detail-score">AI-score: {selectedApplicant.aiScore}/100</span>
                  )}
                </div>
              </div>

              {selectedApplicant.aiReason && (
                <div className="detail-section ai-evaluation">
                  <h3>✨ AI-vurdering</h3>
                  <p>{selectedApplicant.aiReason}</p>
                </div>
              )}

              {/* Profil/CV kommer først */}
              {selectedApplicant.profile && (
                <>
                  {selectedApplicant.profile.summary && (
                    <div className="detail-section">
                      <h3>Om søkeren</h3>
                      <p>{String(selectedApplicant.profile.summary)}</p>
                    </div>
                  )}

                  {selectedApplicant.profile.experience && (
                    <div className="detail-section">
                      <h3>Erfaring</h3>
                      <p style={{whiteSpace: 'pre-line'}}>{String(selectedApplicant.profile.experience)}</p>
                    </div>
                  )}

                  {selectedApplicant.profile.education && (
                    <div className="detail-section">
                      <h3>Utdanning</h3>
                      <p style={{whiteSpace: 'pre-line'}}>{String(selectedApplicant.profile.education)}</p>
                    </div>
                  )}

                  {selectedApplicant.profile.skills && (
                    <div className="detail-section">
                      <h3>Ferdigheter</h3>
                      <div className="applicant-skills">
                        {String(selectedApplicant.profile.skills).split(',').map((skill, i) => (
                          <span key={i} className="skill-tag">{skill.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Søknadstekst kommer etter profilen */}
              <div className="detail-section">
                <h3>Søknadstekst</h3>
                {selectedApplicant.coverLetter ? (
                  <p className="cover-letter-text">{selectedApplicant.coverLetter}</p>
                ) : (
                  <p className="no-cover-letter">Søkeren sendte ikke med søknadstekst</p>
                )}
              </div>

              <div className="detail-actions">
                <select 
                  value={selectedApplicant.status || 'pending'}
                  onChange={(e) => handleStatusChange(selectedApplicant, e.target.value)}
                  className="status-select large"
                >
                  <option value="pending">Under vurdering</option>
                  <option value="reviewed">Gjennomgått</option>
                  <option value="interview">Til intervju</option>
                  <option value="accepted">Akseptert</option>
                  <option value="rejected">Avslått</option>
                </select>
                
                {/* Knapp for å invitere til intervju med melding */}
                <button 
                  className="button primary invite-btn"
                  onClick={() => handleStatusChange(selectedApplicant, 'interview')}
                >
                  📩 Inviter til intervju
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for å sende melding til søker ved intervju */}
        {showMessageModal && messageRecipient && (
          <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
            <div className="message-modal" onClick={(e) => e.stopPropagation()}>
              <h2>🎉 Inviter {messageRecipient.applicantName} til intervju</h2>
              
              <div className="message-modal-body">
                <p className="message-subtitle">
                  ✨ Søkeren vil se denne meldingen på sin profil
                </p>
                
                <div className="message-form">
                  <label>Din melding til kandidaten:</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Skriv en personlig melding til søkeren..."
                  />
                </div>
                
                <div className="message-actions">
                  <button 
                    className="button secondary"
                    onClick={() => setShowMessageModal(false)}
                  >
                    Avbryt
                  </button>
                  <button 
                    className="button primary"
                    onClick={sendMessageAndUpdateStatus}
                  >
                    ✓ Send invitasjon
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CompanyDashboard;
