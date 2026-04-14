// Full CV-visning for jobbsøker – egen URL, ikke samme som offentlig «profilside»
// Tekstfelt → HTML: se kommentarer ved hver seksjon og utils/splitProfileIntroParagraphs.js

import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import ProfileReferencesSection from '../components/ProfileReferencesSection';
import {
  splitCvMultilineParagraphs,
  splitProfileIntroParagraphs,
} from '../utils/splitProfileIntroParagraphs';
import { openPdfBase64InNewTab } from '../utils/pdfBase64Blob';
import '../styles/CompanyProfilePage.css';

function PersonPublicCvPage() {
  const { userId } = useParams();
  const location = useLocation();
  const [userRow, setUserRow] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [publicPdfDocs, setPublicPdfDocs] = useState([]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('person-public-hide-scrollbar');
    return () => root.classList.remove('person-public-hide-scrollbar');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;
        if (!userSnap.exists()) {
          setUserRow(null);
          setNotFound(true);
          setLoading(false);
          return;
        }
        const u = userSnap.data();
        if (u.userType === 'company') {
          setUserRow(u);
          setProfile(null);
          setNotFound(false);
          setLoading(false);
          return;
        }
        setUserRow(u);
        const profSnap = await getDoc(doc(db, 'profiles', userId));
        if (cancelled) return;
        setProfile(profSnap.exists() ? profSnap.data() : {});
        try {
          const pdfSnap = await getDocs(collection(db, 'profiles', userId, 'publicPdfs'));
          if (!cancelled) {
            setPublicPdfDocs(
              pdfSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            );
          }
        } catch (pdfErr) {
          console.warn('publicPdfs:', pdfErr);
          if (!cancelled) setPublicPdfDocs([]);
        }
        setNotFound(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || notFound || !userRow || userRow.userType === 'company') return;
    if (location.hash !== '#referanser') return;
    const t = window.setTimeout(() => {
      document.getElementById('referanser')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
    return () => window.clearTimeout(t);
  }, [loading, notFound, userRow, location.hash]);

  if (loading) {
    return (
      <div className="person-public-page person-public-page--loading">
        <p className="person-public-loading-label">Laster CV…</p>
      </div>
    );
  }

  if (notFound || !userRow) {
    return (
      <div className="person-public-page">
        <div className="company-public-card company-public-empty">
          <h1>Finner ikke profilen</h1>
          <p>Brukeren finnes ikke, eller lenken er ugyldig.</p>
          <Link to="/jobs" className="button primary">
            Se ledige stillinger
          </Link>
        </div>
      </div>
    );
  }

  if (userRow.userType === 'company') {
    return (
      <div className="person-public-page">
        <div className="company-public-card company-public-empty">
          <h1>Bedriftsprofil</h1>
          <p>Denne kontoen er en bedrift.</p>
          <Link to={`/bedrift/${userId}`} className="button primary">
            Gå til bedriftssiden
          </Link>
        </div>
      </div>
    );
  }

  const displayName =
    [userRow.firstName, userRow.lastName].filter(Boolean).join(' ').trim() ||
    profile?.jobTitle ||
    'Profil';
  const imageSrc = profile?.profileImage || '';
  const coverSrc = profile?.coverImage || '';

  const hasCvBody =
    profile?.summary ||
    profile?.experience ||
    profile?.education ||
    profile?.skills ||
    profile?.languages ||
    profile?.desiredPosition ||
    profile?.jobTitle;

  return (
    <div className="person-public-page person-public-cv-page">
      <header className="person-public-topbar person-public-topbar--split">
        <Link to={`/profil/${userId}`} className="company-profile-back">
          ← Tilbake til profil
        </Link>
        <Link to="/jobs" className="person-public-cv-toplink">
          Finn jobber
        </Link>
      </header>

      <div className="person-public-shell">
        <div
          className={`person-public-banner ${coverSrc ? 'person-public-banner--custom' : ''}`}
          style={
            coverSrc
              ? {
                  backgroundImage: `url(${coverSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
          aria-hidden="true"
        />

        <article className="person-public-identity">
          <div className="person-public-avatar-wrap">
            {imageSrc ? (
              <img className="person-public-avatar" src={imageSrc} alt="" />
            ) : (
              <div className="person-public-avatar-fallback" aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="person-public-identity-text">
            <p className="person-public-cv-kicker">CV</p>
            <h1 className="person-public-title">{displayName}</h1>
            {profile?.jobTitle ? (
              <p className="person-public-headline">{profile.jobTitle}</p>
            ) : null}
          </div>
        </article>

        <div className="person-public-layout">
          <div className="person-public-main">
            {!hasCvBody ? (
              <section className="person-public-panel person-public-panel--muted">
                <p className="person-public-muted-inline">
                  Ingen CV-innhold er lagt inn ennå.
                </p>
              </section>
            ) : null}

            {/* Sammendrag / korte felt: splitProfileIntroParagraphs (flytende avsnitt). */}
            {profile?.summary ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Profil / sammendrag</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitProfileIntroParagraphs(profile.summary).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {profile?.desiredPosition &&
            profile.desiredPosition.trim() !== (profile?.jobTitle || '').trim() ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Ønsket stilling</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitProfileIntroParagraphs(profile.desiredPosition).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Erfaring / utdanning / ferdigheter: splitCvMultilineParagraphs + CSS --multiline */}
            {profile?.experience ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Erfaring</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitCvMultilineParagraphs(profile.experience).map((para, i) => (
                    <p key={i} className="person-public-body-text--multiline">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {profile?.education ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Utdanning</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitCvMultilineParagraphs(profile.education).map((para, i) => (
                    <p key={i} className="person-public-body-text--multiline">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {profile?.skills ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Ferdigheter</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitCvMultilineParagraphs(profile.skills).map((para, i) => (
                    <p key={i} className="person-public-body-text--multiline">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Språk: vanligvis tekst fra skjema; objekt = eldre data */}
            {profile?.languages ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Språk</h2>
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {typeof profile.languages === 'object' ? (
                    <p className="person-public-body-text--multiline">
                      {JSON.stringify(profile.languages)}
                    </p>
                  ) : (
                    splitProfileIntroParagraphs(String(profile.languages)).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            <ProfileReferencesSection subjectUid={userId} />
          </div>

          <aside className="person-public-aside" aria-label="Kontakt">
            <div className="person-public-aside-card">
              <h3 className="person-public-aside-title">Kontakt</h3>
              {profile?.location ? (
                <p className="person-public-aside-line">
                  <strong>Sted</strong>
                  <br />
                  {profile.location}
                </p>
              ) : null}
              {profile?.phone ? (
                <p className="person-public-aside-line">
                  <strong>Telefon</strong>
                  <br />
                  {profile.phone}
                </p>
              ) : null}
              {!profile?.location && !profile?.phone ? (
                <p className="person-public-aside-muted">Ingen kontaktinfo lagt inn.</p>
              ) : null}
            </div>

            {(() => {
              const legacy = (Array.isArray(profile?.cvPdfAttachments)
                ? profile.cvPdfAttachments
                : []
              ).filter((a) => a?.downloadUrl && a?.id);
              const fromDb = publicPdfDocs.filter((d) => d?.dataBase64 && d?.id);
              const hasDocs = legacy.length > 0 || fromDb.length > 0;
              if (!hasDocs) return null;
              return (
              <div className="person-public-aside-card person-public-aside-card--docs">
                <h3 className="person-public-aside-title">Dokumenter</h3>
                <ul className="person-public-doc-list">
                  {fromDb.map((d) => (
                    <li key={d.id} className="person-public-doc-item">
                      <button
                        type="button"
                        className="person-public-doc-link person-public-doc-link--button"
                        onClick={() => openPdfBase64InNewTab(d.dataBase64)}
                      >
                        {d.title || d.fileName || 'PDF'}
                      </button>
                      <span className="person-public-doc-badge">PDF</span>
                    </li>
                  ))}
                  {legacy.map((a) => (
                    <li key={a.id} className="person-public-doc-item">
                      <a
                        href={a.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="person-public-doc-link"
                      >
                        {a.title || a.fileName || 'PDF'}
                      </a>
                      <span className="person-public-doc-badge">PDF</span>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })()}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default PersonPublicCvPage;
