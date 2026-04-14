// Offentlig profil for jobbsøker – banner + profilbilde (samme idé som bedriftsprofil)

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  getFriendCount,
  getFollowedCompanyCount,
  listFriendUidsPreview,
  fetchFriendAvatarsForUids,
  listFollowedCompaniesForUser,
  getFriendshipState,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  unfollowCompanyAsUser,
} from '../services/social';
import PublicListModal from '../components/PublicListModal';
import { splitProfileIntroParagraphs } from '../utils/splitProfileIntroParagraphs';
import '../styles/CompanyProfilePage.css';

// «Om meg» (publicIntro): splitProfileIntroParagraphs + .person-public-body-text--prose (CompanyProfilePage.css)

function PersonPublicProfilePage() {
  const { userId } = useParams();
  const { currentUser, userData } = useAuth();
  const toast = useToast();
  const [userRow, setUserRow] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [friendCount, setFriendCount] = useState(0);
  const [followedCompanyCount, setFollowedCompanyCount] = useState(0);
  const [friendAvatars, setFriendAvatars] = useState([]);
  const [followedCompanies, setFollowedCompanies] = useState([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [friendshipState, setFriendshipState] = useState('none');
  const [friendBusy, setFriendBusy] = useState(false);
  const [companiesModalOpen, setCompaniesModalOpen] = useState(false);
  const [unfollowCompanyBusyId, setUnfollowCompanyBusyId] = useState(null);

  const isOwnProfile = Boolean(currentUser?.uid && userId && currentUser.uid === userId);
  const viewerIsJobseeker = userData?.userType === 'jobseeker';
  const profileIsJobseeker = userRow?.userType === 'jobseeker';

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
          setProfile(null);
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
        setNotFound(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setNotFound(true);
        }
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
    let cancelled = false;
    async function loadSocial() {
      if (!userId || !profileIsJobseeker || !userRow) {
        setSocialLoading(false);
        return;
      }
      setSocialLoading(true);
      try {
        const [fc, fcc, followedList] = await Promise.all([
          getFriendCount(db, userId),
          getFollowedCompanyCount(db, userId),
          listFollowedCompaniesForUser(db, userId, 500),
        ]);
        const friendUids = await listFriendUidsPreview(db, userId, 6);
        const avatars = await fetchFriendAvatarsForUids(db, friendUids);
        if (cancelled) return;
        setFriendCount(fc);
        setFollowedCompanyCount(fcc);
        setFriendAvatars(avatars);
        setFollowedCompanies(followedList);

        if (
          currentUser?.uid &&
          viewerIsJobseeker &&
          !isOwnProfile &&
          userId
        ) {
          const state = await getFriendshipState(db, currentUser.uid, userId);
          if (!cancelled) setFriendshipState(state);
        } else {
          setFriendshipState('none');
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setSocialLoading(false);
      }
    }
    loadSocial();
    return () => {
      cancelled = true;
    };
  }, [
    userId,
    profileIsJobseeker,
    userRow,
    currentUser?.uid,
    viewerIsJobseeker,
    isOwnProfile,
  ]);

  async function handleSendRequest() {
    if (!currentUser || !userId) return;
    setFriendBusy(true);
    try {
      await sendFriendRequest(db, currentUser.uid, userId);
      setFriendshipState('pending_out');
      toast.success('Venneforespørsel sendt.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke sende forespørsel.');
    }
    setFriendBusy(false);
  }

  async function handleCancelRequest() {
    if (!currentUser || !userId) return;
    setFriendBusy(true);
    try {
      await cancelFriendRequest(db, currentUser.uid, userId);
      setFriendshipState('none');
      toast.success('Forespørsel trukket tilbake.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke avbryte.');
    }
    setFriendBusy(false);
  }

  async function handleAccept() {
    if (!currentUser || !userId) return;
    setFriendBusy(true);
    try {
      await acceptFriendRequest(db, currentUser.uid, userId);
      setFriendshipState('friends');
      setFriendCount((n) => n + 1);
      toast.success('Dere er nå venner.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke godta.');
    }
    setFriendBusy(false);
  }

  async function handleDecline() {
    if (!currentUser || !userId) return;
    setFriendBusy(true);
    try {
      await declineFriendRequest(db, currentUser.uid, userId);
      setFriendshipState('none');
      toast.success('Forespørsel avslått.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke avslå.');
    }
    setFriendBusy(false);
  }

  async function handleRemoveFriend() {
    if (!currentUser || !userId) return;
    setFriendBusy(true);
    try {
      await removeFriend(db, currentUser.uid, userId);
      setFriendshipState('none');
      setFriendCount((n) => Math.max(0, n - 1));
      toast.success('Venn fjernet.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke fjerne venn.');
    }
    setFriendBusy(false);
  }

  async function handleUnfollowCompanyInModal(companyId) {
    if (!currentUser || !companyId || !isOwnProfile) return;
    setUnfollowCompanyBusyId(companyId);
    try {
      await unfollowCompanyAsUser(db, currentUser.uid, companyId);
      setFollowedCompanies((prev) => prev.filter((c) => c.companyId !== companyId));
      setFollowedCompanyCount((n) => Math.max(0, n - 1));
      toast.success('Du følger ikke lenger denne bedriften.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke avslutte følging.');
    }
    setUnfollowCompanyBusyId(null);
  }

  if (loading) {
    return (
      <div className="person-public-page person-public-page--loading">
        <p className="person-public-loading-label">Laster profil…</p>
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
          <p>Denne kontoen er en bedrift. Se bedriftssiden vår i stedet.</p>
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
  const publicHeadline = profile?.publicHeadline?.trim() || '';
  const publicIntro = profile?.publicIntro?.trim() || '';
  const imageSrc = profile?.profileImage || '';
  const coverSrc = profile?.coverImage || '';

  const hasPublicIntro = Boolean(publicIntro || publicHeadline);

  const hasCvContent =
    profile?.summary ||
    profile?.experience ||
    profile?.education ||
    profile?.skills ||
    profile?.languages ||
    profile?.desiredPosition ||
    profile?.jobTitle;

  const companiesModalTitle = isOwnProfile
    ? 'Bedrifter du følger'
    : 'Bedrifter vedkommende følger';

  return (
    <div className="person-public-page">
      <header className="person-public-topbar">
        <Link to="/jobs" className="company-profile-back">
          ← Finn jobber
        </Link>
        {isOwnProfile ? (
          <nav className="public-profile-topbar-actions" aria-label="Rediger profil">
            <Link
              to="/dashboard/user?tab=public-profile"
              className="public-profile-topbar-action"
              title="Rediger profilside"
            >
              Profilside
            </Link>
            <span className="public-profile-topbar-sep" aria-hidden>
              ·
            </span>
            <Link to="/dashboard/user?tab=cv" className="public-profile-topbar-action" title="Rediger CV">
              CV
            </Link>
          </nav>
        ) : null}
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
            <div className="person-public-name-row">
              <h1 className="person-public-title">{displayName}</h1>
            </div>
            {publicHeadline ? (
              <p className="person-public-headline">{publicHeadline}</p>
            ) : null}

            <div className="person-public-cv-row person-public-cv-row--split">
              <Link to={`/profil/${userId}/cv`} className="person-public-cv-cta">
                {hasCvContent ? 'Se full CV →' : 'Åpne CV-siden →'}
              </Link>
              {isOwnProfile ? (
                <Link
                  to={`/profil/${userId}/cv#referanser`}
                  className="person-public-cv-cta person-public-cv-cta--secondary person-public-cv-cta--ref-request"
                  title="Be om skriftlig referanse"
                >
                  <span className="person-public-cv-cta-label person-public-cv-cta-label--full">
                    Be om skriftlig referanse →
                  </span>
                  <span className="person-public-cv-cta-label person-public-cv-cta-label--short">
                    Få referanse →
                  </span>
                </Link>
              ) : null}
              {currentUser && !isOwnProfile && userData?.userType === 'company' && profileIsJobseeker ? (
                <Link
                  to={`/meldinger?with=${userId}`}
                  className="person-public-cv-cta person-public-cv-cta--secondary"
                >
                  Melding til søker →
                </Link>
              ) : null}
              {currentUser &&
              !isOwnProfile &&
              viewerIsJobseeker &&
              profileIsJobseeker &&
              friendshipState === 'friends' ? (
                <Link
                  to={`/meldinger?with=${userId}`}
                  className="person-public-cv-cta person-public-cv-cta--secondary"
                >
                  Send melding →
                </Link>
              ) : null}
            </div>

            {!socialLoading && (
              <div className="person-public-stats" aria-label="Statistikk">
                <span className="person-public-stat">
                  <strong>{friendCount}</strong>{' '}
                  {friendCount === 1 ? 'venn' : 'venner'}
                </span>
                <span className="person-public-stat-sep" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="person-public-stat-btn"
                  disabled={followedCompanyCount === 0}
                  onClick={() => followedCompanyCount > 0 && setCompaniesModalOpen(true)}
                >
                  Følger <strong>{followedCompanyCount}</strong>{' '}
                  {followedCompanyCount === 1 ? 'bedrift' : 'bedrifter'}
                </button>
              </div>
            )}

            {(() => {
              const showFriendBlock =
                currentUser && !isOwnProfile && viewerIsJobseeker;
              const showChips = Boolean(profile?.location || profile?.phone);
              if (!showFriendBlock && !showChips) return null;
              return (
                <>
                  <div className="person-public-inline-meta">
                    {showFriendBlock ? (
                      <div className="person-public-friend-actions">
                        {friendshipState === 'none' && (
                          <button
                            type="button"
                            className="person-public-friend-btn person-public-friend-btn--primary"
                            onClick={handleSendRequest}
                            disabled={friendBusy}
                          >
                            Send venneforespørsel
                          </button>
                        )}
                        {friendshipState === 'pending_out' && (
                          <button
                            type="button"
                            className="person-public-friend-btn"
                            onClick={handleCancelRequest}
                            disabled={friendBusy}
                          >
                            Trekk forespørsel
                          </button>
                        )}
                        {friendshipState === 'pending_in' && (
                          <div className="person-public-friend-row">
                            <button
                              type="button"
                              className="person-public-friend-btn person-public-friend-btn--primary"
                              onClick={handleAccept}
                              disabled={friendBusy}
                            >
                              Godta venneforespørsel
                            </button>
                            <button
                              type="button"
                              className="person-public-friend-btn"
                              onClick={handleDecline}
                              disabled={friendBusy}
                            >
                              Avslå
                            </button>
                          </div>
                        )}
                        {friendshipState === 'friends' && (
                          <span className="person-public-friend-badge">
                            Dere er venner
                          </span>
                        )}
                      </div>
                    ) : null}
                    {showChips ? (
                      <div className="person-public-chips">
                        {profile?.location ? (
                          <span className="person-public-chip">
                            <span className="person-public-chip-label">Sted</span>
                            {profile.location}
                          </span>
                        ) : null}
                        {profile?.phone ? (
                          <span className="person-public-chip">
                            <span className="person-public-chip-label">Tlf.</span>
                            {profile.phone}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {showFriendBlock && friendshipState === 'friends' ? (
                    <div className="person-public-remove-friend">
                      <button
                        type="button"
                        className="person-public-friend-remove-link"
                        onClick={handleRemoveFriend}
                        disabled={friendBusy}
                      >
                        Fjern venn
                      </button>
                    </div>
                  ) : null}
                </>
              );
            })()}
            <div className="person-public-links">
              {profile?.linkedIn ? (
                <a
                  href={
                    profile.linkedIn.startsWith('http')
                      ? profile.linkedIn
                      : `https://${profile.linkedIn}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-public-link-btn"
                >
                  LinkedIn
                </a>
              ) : null}
              {profile?.portfolio ? (
                <a
                  href={
                    profile.portfolio.startsWith('http')
                      ? profile.portfolio
                      : `https://${profile.portfolio}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="person-public-link-btn"
                >
                  Nettsted
                </a>
              ) : null}
            </div>
          </div>
        </article>

        <div className="person-public-layout">
          <div className="person-public-main">
            {publicIntro ? (
              <section className="person-public-panel">
                <h2 className="person-public-panel-title">Om meg</h2>
                {/* Full CV ligger på /profil/:id/cv; samme tekst-utils som der */}
                <div
                  className="person-public-body-text person-public-body-text--prose"
                  lang="nb"
                >
                  {splitProfileIntroParagraphs(publicIntro).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {!hasPublicIntro && (
              <section className="person-public-panel person-public-panel--muted">
                <p className="person-public-muted-inline">
                  {isOwnProfile
                    ? 'Her vises en kort tekst du skriver selv – uavhengig av CV-en. Gå til «Min side» → Profilside for å legge inn overskrift og «Om meg».'
                    : 'Ingen profiltekst er lagt inn ennå.'}
                </p>
                {isOwnProfile ? (
                  <Link
                    to="/dashboard/user?tab=public-profile"
                    className="person-public-edit-pill person-public-edit-pill--block"
                  >
                    Åpne Profilside
                  </Link>
                ) : null}
              </section>
            )}
          </div>

          <aside className="person-public-aside" aria-label="Kort om profilen">
            {friendCount > 0 ? (
              <div className="person-public-aside-card person-public-aside-card--friends">
                <h3 className="person-public-aside-title">Venner</h3>
                <p className="person-public-friends-hint">
                  {friendAvatars.length > 0 && friendCount > friendAvatars.length
                    ? `Viser ${friendAvatars.length} av ${friendCount}`
                    : `${friendCount} ${friendCount === 1 ? 'venn' : 'venner'}`}
                </p>
                {friendAvatars.length > 0 ? (
                  <div className="person-public-friends-grid">
                    {friendAvatars.map((f) => (
                      <Link
                        key={f.uid}
                        to={`/profil/${f.uid}`}
                        className="person-public-friend-avatar"
                        title={f.label}
                      >
                        {f.photoUrl ? (
                          <img src={f.photoUrl} alt="" />
                        ) : (
                          <span className="person-public-friend-avatar-fallback" aria-hidden>
                            {f.label.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="person-public-friends-empty">
                    Forhåndsvisning av venner lastet ikke akkurat nå – antallet over stemmer likevel.
                  </p>
                )}
              </div>
            ) : null}

            <div className="person-public-aside-card">
              <h3 className="person-public-aside-title">Kontakt & lenker</h3>
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
              {isOwnProfile ? (
                <p className="person-public-aside-hint">
                  <strong>Profilside</strong> (tekst her) og <strong>CV</strong> redigeres hver for seg under{' '}
                  <strong>Min side</strong>. Banner og bilde lastes opp i sidefeltet der.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <PublicListModal
        open={companiesModalOpen}
        title={companiesModalTitle}
        onClose={() => setCompaniesModalOpen(false)}
      >
        {followedCompanies.length === 0 ? (
          <p className="person-public-modal-empty">Ingen bedrifter i listen.</p>
        ) : (
          <ul className="person-public-modal-list person-public-modal-list--rows">
            {followedCompanies.map((c) => (
              <li key={c.companyId} className="person-public-modal-list-row">
                <Link to={`/bedrift/${c.companyId}`} onClick={() => setCompaniesModalOpen(false)}>
                  {c.companyName}
                </Link>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="person-public-modal-unfollow-btn"
                    disabled={unfollowCompanyBusyId === c.companyId}
                    onClick={() => handleUnfollowCompanyInModal(c.companyId)}
                  >
                    {unfollowCompanyBusyId === c.companyId ? '…' : 'Slutt å følge'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PublicListModal>
    </div>
  );
}

export default PersonPublicProfilePage;
