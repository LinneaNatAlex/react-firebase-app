import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import {
  listAllFriendUids,
  fetchFriendAvatarsForUids,
  listFollowedCompaniesForUser,
  removeFriend,
  unfollowCompanyAsUser,
} from '../services/social';

/**
 * Nettverk på Min side: administrer venner og bedrifter du følger.
 */
export default function UserNetworkPanel() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [busyFriendUid, setBusyFriendUid] = useState(null);
  const [busyCompanyId, setBusyCompanyId] = useState(null);

  const load = useCallback(async () => {
    if (!currentUser?.uid) {
      setFriends([]);
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [uids, companyRows] = await Promise.all([
        listAllFriendUids(db, currentUser.uid),
        listFollowedCompaniesForUser(db, currentUser.uid, 500),
      ]);
      const avatars = await fetchFriendAvatarsForUids(db, uids);
      setFriends(avatars);
      setCompanies(companyRows);
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke laste nettverket.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemoveFriend(otherUid) {
    if (!currentUser?.uid || !otherUid) return;
    setBusyFriendUid(otherUid);
    try {
      await removeFriend(db, currentUser.uid, otherUid);
      setFriends((prev) => prev.filter((f) => f.uid !== otherUid));
      toast.success('Venn fjernet.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke fjerne venn.');
    }
    setBusyFriendUid(null);
  }

  async function handleUnfollowCompany(companyId) {
    if (!currentUser?.uid || !companyId) return;
    setBusyCompanyId(companyId);
    try {
      await unfollowCompanyAsUser(db, currentUser.uid, companyId);
      setCompanies((prev) => prev.filter((c) => c.companyId !== companyId));
      toast.success('Du følger ikke lenger denne bedriften.');
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke avslutte følging.');
    }
    setBusyCompanyId(null);
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Nettverk</h1>
          <p>
            Administrer venner og bedrifter du følger. Den offentlige profilen viser{' '}
            <strong>Profilside</strong>-tekst og bilde; full CV ligger på egen side.
          </p>
        </div>
      </header>

      <div className="network-panel-grid">
        <section className="network-manage-card">
          <h2>Venner</h2>
          {loading ? (
            <p className="network-muted">Laster…</p>
          ) : friends.length === 0 ? (
            <p className="network-muted">Du har ingen venner i listen ennå.</p>
          ) : (
            <ul className="network-manage-list">
              {friends.map((f) => (
                <li key={f.uid} className="network-manage-row">
                  <Link to={`/profil/${f.uid}`} className="network-manage-link">
                    {f.photoUrl ? (
                      <img src={f.photoUrl} alt="" className="network-manage-avatar" />
                    ) : (
                      <span className="network-manage-avatar-fallback" aria-hidden>
                        {f.label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="network-manage-label">{f.label}</span>
                  </Link>
                  <button
                    type="button"
                    className="network-manage-btn network-manage-btn--danger"
                    disabled={busyFriendUid === f.uid}
                    onClick={() => handleRemoveFriend(f.uid)}
                  >
                    {busyFriendUid === f.uid ? '…' : 'Fjern'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="network-manage-card">
          <h2>Bedrifter du følger</h2>
          {loading ? (
            <p className="network-muted">Laster…</p>
          ) : companies.length === 0 ? (
            <p className="network-muted">Du følger ingen bedrifter ennå.</p>
          ) : (
            <ul className="network-manage-list">
              {companies.map((c) => (
                <li key={c.companyId} className="network-manage-row">
                  <Link to={`/bedrift/${c.companyId}`} className="network-manage-link network-manage-link--text-only">
                    <span className="network-manage-label">{c.companyName}</span>
                  </Link>
                  <button
                    type="button"
                    className="network-manage-btn network-manage-btn--danger"
                    disabled={busyCompanyId === c.companyId}
                    onClick={() => handleUnfollowCompany(c.companyId)}
                  >
                    {busyCompanyId === c.companyId ? '…' : 'Slutt å følge'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="network-info-card network-info-card--muted">
          <h2>Tips</h2>
          <p className="network-muted">
            Du kan også fjerne venner fra en annen persons profil når dere er venner, eller slutte å følge
            bedrifter fra modalen «Følger X bedrifter» på din egen offentlige profil.
          </p>
          <div className="network-cta-row">
            <Link to="/profil/me" className="button primary">
              Åpne min offentlige profil
            </Link>
            <Link to="/dashboard/user?tab=public-profile" className="button secondary">
              Gå til Profilside
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
