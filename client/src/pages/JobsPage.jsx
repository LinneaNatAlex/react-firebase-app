// Stillingslisteside - viser alle aktive jobber, alle kan se denne

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { collection, getDocs, addDoc, query, where, doc, getDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { buildCoverLetterTemplate } from '../services/freeTemplates';
import {
  fetchCoverLettersFromApplications,
  fetchJobseekerCoverLetters,
  saveJobseekerCoverLetter,
} from '../services/jobseekerCoverLetters';
import '../styles/JobsPage.css';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

function JobsPage() {
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Søk og filter
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Valgt jobb og søknadsprosess
  const [selectedJob, setSelectedJob] = useState(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applicationCvMode, setApplicationCvMode] = useState('profile'); // 'profile' | 'pdf'
  const [cvPdf, setCvPdf] = useState(null);
  const [coverLetterPdf, setCoverLetterPdf] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [coverLetterLibrary, setCoverLetterLibrary] = useState([]);
  const [coverLetterSearch, setCoverLetterSearch] = useState('');
  const [coverLetterPick, setCoverLetterPick] = useState('');

  const filteredCoverLetterLibrary = useMemo(() => {
    const q = coverLetterSearch.trim().toLowerCase();
    const base = coverLetterLibrary || [];
    if (!q) return base;
    return base.filter((x) => {
      const hay = `${x.companyName || ''} ${x.jobTitle || ''} ${x.location || ''} ${x.coverLetter || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [coverLetterLibrary, coverLetterSearch]);
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

  useEffect(() => {
    const openJobId = location.state?.openJobId;
    if (!openJobId || jobs.length === 0) return;
    const job = jobs.find((j) => j.id === openJobId);
    if (job) {
      setSelectedJob(job);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, jobs, location.pathname, navigate]);

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
    setApplicationCvMode('profile');
    setCvPdf(null);
    setCoverLetterPdf(null);
    setCoverLetterSearch('');
    setCoverLetterPick('');
  }

  function fillCoverLetterTemplate() {
    if (!selectedJob) return;
    const text = buildCoverLetterTemplate({
      jobTitle: selectedJob.title,
      companyName: selectedJob.companyName,
      jobDescriptionSnippet: selectedJob.description,
      profile: userProfile,
      applicantEmail: currentUser?.email,
    });
    setCoverLetter(text);
    toast.success('Utkast lagt inn lokalt – tilpass før du sender');
  }

  // Sender søknad på en stilling
  async function handleApply() {
    if (!currentUser || !selectedJob) return;

    // Sjekk at søknadstekst er fylt ut (hvis ikke PDF-søknad brukes)
    const coverText = String(coverLetter || '').trim();
    if (applicationCvMode !== 'pdf' && coverText.length < 10) {
      toast.warning('Vennligst skriv en søknadstekst (minst 10 tegn)');
      return;
    }
    if (applicationCvMode === 'pdf' && !cvPdf) {
      toast.warning('Velg en PDF å legge ved (CV/søknad).');
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
        coverLetter: coverText,
        coverLetterPdfUrl: '',
        coverLetterPdfName: '',
        cvAttachmentType: applicationCvMode === 'pdf' ? 'pdf' : 'profile',
        cvPdfUrl: '',
        cvPdfName: '',
        profile: applicationCvMode === 'profile' ? (userProfile || null) : null,
      };

      if (applicationCvMode === 'pdf' && cvPdf) {
        if (cvPdf.type !== 'application/pdf') {
          toast.warning('CV-vedlegg må være en PDF-fil.');
          return;
        }
        if (cvPdf.size > 5 * 1024 * 1024) {
          toast.warning('CV-vedlegg kan være maks 5 MB.');
          return;
        }

        setPdfUploading(true);
        try {
          const safeName = cvPdf.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
          const path = `applications/${currentUser.uid}/${selectedJob.id}/cv_${Date.now()}_${safeName}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, cvPdf, { contentType: 'application/pdf' });
          const url = await getDownloadURL(fileRef);
          applicationData.cvPdfUrl = url;
          applicationData.cvPdfName = cvPdf.name;
        } catch (e) {
          console.error('CV PDF upload:', e);
          toast.error('Kunne ikke laste opp PDF. Prøv igjen.');
          return;
        } finally {
          setPdfUploading(false);
        }
      }

      if (coverLetterPdf) {
        if (coverLetterPdf.type !== 'application/pdf') {
          toast.warning('PDF-vedlegg må være en PDF-fil.');
          return;
        }
        if (coverLetterPdf.size > 5 * 1024 * 1024) {
          toast.warning('PDF-vedlegg kan være maks 5 MB.');
          return;
        }

        setPdfUploading(true);
        try {
          const safeName = coverLetterPdf.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
          const path = `applications/${currentUser.uid}/${selectedJob.id}/${Date.now()}_${safeName}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, coverLetterPdf, {
            contentType: 'application/pdf',
          });
          const url = await getDownloadURL(fileRef);
          applicationData.coverLetterPdfUrl = url;
          applicationData.coverLetterPdfName = coverLetterPdf.name;
        } catch (e) {
          console.error('PDF upload:', e);
          toast.error('Kunne ikke laste opp PDF. Prøv igjen.');
          return;
        } finally {
          setPdfUploading(false);
        }
      }

      await addDoc(collection(db, 'applications'), applicationData);

      // Lagre også i søknadsbibliotek (egen tekst – ikke AI)
      try {
        await saveJobseekerCoverLetter({
          userId: currentUser.uid,
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          companyId: selectedJob.companyId,
          companyName: selectedJob.companyName,
          location: selectedJob.location,
          coverLetter: coverLetter.trim(),
        });
      } catch (e) {
        console.warn('Kunne ikke lagre søknad i bibliotek:', e);
      }

      toast.success('Søknad sendt.');
      setSelectedJob(null);
      setShowApplyForm(false);
      setCoverLetter('');
      setCvPdf(null);
      setCoverLetterPdf(null);
      
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
          <h1>Ledige muligheter</h1>
          <p>
            Stillinger fra bedrifter på Sprang — mange passer studenter,
            praksis, trainee eller første jobb. Alle kan søke; ingen krav om
            studentstatus.
          </p>
          
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
              <button type="button" className="search-button">Søk</button>
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
            <span className="no-results-icon" aria-hidden />
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
                    {job.companyId ? (
                      <Link to={`/bedrift/${job.companyId}`} className="company-name company-name-link">
                        {job.companyName}
                      </Link>
                    ) : (
                      <p className="company-name">{job.companyName}</p>
                    )}
                  </div>
                </div>
                
                <div className="job-listing-meta">
                  <span>Sted: {job.location || 'Ikke spesifisert'}</span>
                  <span>Type: {job.type === 'full-time' ? 'Heltid' : 
                           job.type === 'part-time' ? 'Deltid' : 
                           job.type === 'contract' ? 'Kontrakt' : 
                           job.type}</span>
                </div>

                {job.salary && (
                  <p className="job-salary">Lønn: {job.salary}</p>
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
              ×
            </button>

            <div className="job-modal-header">
              <div className="company-logo large">
                {selectedJob.companyName?.charAt(0) || '?'}
              </div>
              <div>
                <h2>{selectedJob.title}</h2>
                {selectedJob.companyId ? (
                  <Link to={`/bedrift/${selectedJob.companyId}`} className="company-name company-name-link">
                    {selectedJob.companyName}
                  </Link>
                ) : (
                  <p className="company-name">{selectedJob.companyName}</p>
                )}
              </div>
            </div>

            <div className="job-modal-meta">
              <span>Sted: {selectedJob.location || 'Ikke spesifisert'}</span>
              <span>Type: {selectedJob.type === 'full-time' ? 'Heltid' : selectedJob.type}</span>
              {selectedJob.salary && <span>Lønn: {selectedJob.salary}</span>}
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
                  <p className="info-text">Logg inn med privatkonto for å søke</p>
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
              ×
            </button>

            <h2>Søk på: {selectedJob.title}</h2>
            {selectedJob.companyId ? (
              <Link to={`/bedrift/${selectedJob.companyId}`} className="company-name company-name-link">
                {selectedJob.companyName}
              </Link>
            ) : (
              <p className="company-name">{selectedJob.companyName}</p>
            )}

            {userProfile ? (
              <div className="profile-preview">
                <h4>Din CV vil bli vedlagt</h4>
                <p>{userProfile.summary?.substring(0, 100) || 'Profil uten sammendrag'}...</p>
              </div>
            ) : (
              <div className="profile-notice">
                <p><strong>Tips:</strong> <a href="/dashboard/user">Fyll ut CV-en din</a> for å gjøre søknaden mer komplett!</p>
              </div>
            )}

            <div className="apply-form">
              <div className="form-group">
                <label>Vedlegg</label>
                <div className="apply-attach-mode">
                  <label className="apply-attach-option">
                    <input
                      type="radio"
                      name="cv-mode"
                      value="profile"
                      checked={applicationCvMode === 'profile'}
                      onChange={() => setApplicationCvMode('profile')}
                    />
                    Bruk CV-profilen min
                  </label>
                  <label className="apply-attach-option">
                    <input
                      type="radio"
                      name="cv-mode"
                      value="pdf"
                      checked={applicationCvMode === 'pdf'}
                      onChange={() => setApplicationCvMode('pdf')}
                    />
                    Last opp PDF (CV/søknad)
                  </label>
                </div>
                {applicationCvMode === 'pdf' ? (
                  <div className="apply-attach-pdf">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setCvPdf(e.target.files?.[0] || null)}
                    />
                    <p className="form-hint">
                      {cvPdf ? `Valgt: ${cvPdf.name}` : 'Velg en PDF du vil sende i stedet for CV-profilen.'}
                      {pdfUploading ? ' (laster opp...)' : ''}
                    </p>
                  </div>
                ) : (
                  <p className="form-hint">
                    Vi legger ved profilen/CV-en du har fylt ut på «Min side».
                  </p>
                )}
              </div>

              <div className="form-group">
                <div className="cover-letter-header">
                  <label>
                    Søknadstekst{applicationCvMode === 'pdf' ? ' (valgfritt)' : ' *'}
                  </label>
                  <div className="cover-letter-actions">
                    <button
                      type="button"
                      className="template-btn-small"
                      onClick={fillCoverLetterTemplate}
                    >
                      Lag utkast fra CV
                    </button>
                  </div>
                </div>

                {currentUser?.uid ? (
                  <div className="cover-letter-library">
                    <div className="cover-letter-library-row">
                      <input
                        type="search"
                        value={coverLetterSearch}
                        onChange={(e) => setCoverLetterSearch(e.target.value)}
                        placeholder="Hent fra tidligere søknader (søk)…"
                        className="cover-letter-library-search"
                      />
                      <button
                        type="button"
                        className="template-btn-small"
                        onClick={async () => {
                          try {
                            // Primært: hent fra tidligere sendte søknader (applications)
                            const list = await fetchCoverLettersFromApplications(currentUser.uid, 80);
                            if (list.length > 0) {
                              setCoverLetterLibrary(list);
                              return;
                            }

                            // Fallback: egen bibliotek-samling (for nye lagringer)
                            const lib = await fetchJobseekerCoverLetters(currentUser.uid, 60);
                            setCoverLetterLibrary(lib);
                            if (lib.length === 0) toast.info('Ingen lagrede søknader ennå.');
                          } catch (e) {
                            console.error(e);
                            toast.error('Kunne ikke hente bibliotek.');
                          }
                        }}
                      >
                        Hent
                      </button>
                    </div>
                    {coverLetterLibrary.length > 0 ? (
                      <div className="cover-letter-library-row">
                        <select
                          value={coverLetterPick}
                          onChange={(e) => setCoverLetterPick(e.target.value)}
                          className="cover-letter-library-select"
                        >
                          <option value="">Velg tidligere søknad…</option>
                          {filteredCoverLetterLibrary.map((x) => (
                            <option key={x.id} value={x.id}>
                              {(x.companyName || 'Bedrift') + ' — ' + (x.jobTitle || 'Stilling')}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="template-btn-small"
                          disabled={!coverLetterPick}
                          onClick={() => {
                            const picked = coverLetterLibrary.find((x) => x.id === coverLetterPick);
                            if (!picked?.coverLetter) return;
                            setCoverLetter(String(picked.coverLetter));
                            toast.success('Tidligere søknad lagt inn – tilpass før du sender.');
                          }}
                        >
                          Bruk tekst
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Fortell hvorfor du er interessert i stillingen og hva du kan bidra med..."
                  rows={8}
                  required={applicationCvMode !== 'pdf'}
                />
                <p className="form-hint">
                  {coverLetter.length > 0 
                    ? `${coverLetter.length} tegn` 
                    : 'Skriv selv eller bruk «Lag utkast fra CV» (lokalt, gratis).'}
                </p>
              </div>

              <div className="form-group">
                <label>Legg ved vedlegg (valgfritt)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setCoverLetterPdf(e.target.files?.[0] || null)}
                />
                <p className="form-hint">
                  {coverLetterPdf
                    ? `Valgt: ${coverLetterPdf.name}`
                    : 'Legg ved vedlegg om du ønsker.'}
                  {pdfUploading ? ' (laster opp...)' : ''}
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
                  disabled={pdfUploading}
                >
                  {pdfUploading ? 'Laster opp…' : 'Send søknad'}
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
