// Håndterer innlogging for hele appen
// Bruk useAuth() i andre komponenter for å få tilgang til brukerdata og funksjoner

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  buildCompanySearchNameLower,
  buildUserSearchNameLower,
} from "../utils/searchName";
import { auth, db, googleProvider } from "../firebase";
import { resolveAccountDeletionOnLogin } from "../services/accountDeletion";

const AuthContext = createContext();

// Denne hooken brukes i andre komponenter: const { login, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext);
}

// Hent bruker-dokument + profilbilde fra CV-profil (samme konto)
async function fetchUserWithProfilePhoto(uid) {
  let userDoc;
  try {
    userDoc = await getDoc(doc(db, "users", uid));
  } catch (e) {
    console.warn("Auth: kunne ikke lese users-dokument", e);
    return null;
  }
  if (!userDoc.exists()) return null;
  const data = { ...userDoc.data() };
  try {
    const profileDoc = await getDoc(doc(db, "profiles", uid));
    if (profileDoc.exists() && profileDoc.data().profileImage) {
      data.profileImage = profileDoc.data().profileImage;
    }
  } catch (e) {
    console.warn("Auth: kunne ikke lese profil (profilbilde)", e);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Oppretter ny bruker i Firebase Auth + lagrer ekstra info i databasen
  async function register(email, password, userType, additionalData) {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Lagre brukertype og annen info i Firestore (AI-kvote kun for bedrifter)
    await setDoc(doc(db, "users", user.uid), {
      email: email,
      userType: userType,
      createdAt: new Date(),
      ...additionalData,
      ...(userType === "company" ? { aiPass: false } : {}),
    });

    return user;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Google-innlogging
  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Sjekk om brukeren finnes i databasen fra før
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return { user, isNewUser: !userDoc.exists() };
  }

  // Fullfør sosial innlogging med valgt brukertype
  async function completeSocialSignup(userType, additionalData = {}) {
    if (!currentUser) return;

    await setDoc(doc(db, "users", currentUser.uid), {
      email: currentUser.email,
      userType: userType,
      createdAt: new Date(),
      ...additionalData,
      ...(userType === "company" ? { aiPass: false } : {}),
    });

    // Oppdater lokal userData
    const merged = await fetchUserWithProfilePhoto(currentUser.uid);
    if (merged) setUserData(merged);
  }

  function logout() {
    return signOut(auth);
  }

  // Oppdater brukerdata (f.eks. etter nytt profilbilde eller endret rolle i Firestore)
  const refreshUserData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    const merged = await fetchUserWithProfilePhoto(user.uid);
    setUserData(merged);
    return merged;
  }, []);

  // Kjører når appen starter - sjekker om bruker allerede er logget inn
  useEffect(() => {
    let settled = false;
    const failOpenMs = 10000;
    const failOpenTimer = setTimeout(() => {
      if (!settled) {
        console.warn(
          "Auth: onAuthStateChanged tok for lang tid – viser appen likevel (f.eks. innebygd nettleser).",
        );
        setLoading(false);
      }
    }, failOpenMs);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        let merged = await fetchUserWithProfilePhoto(user.uid);
        if (merged?.accountDeletionDeadline?.toMillis) {
          const result = await resolveAccountDeletionOnLogin(db, user, merged);
          if (result === "purged") {
            setUserData(null);
            settled = true;
            clearTimeout(failOpenTimer);
            setLoading(false);
            return;
          }
          if (result === "cancelled") {
            merged = await fetchUserWithProfilePhoto(user.uid);
          }
        }
        setUserData(merged);
      } else {
        setUserData(null);
      }

      settled = true;
      clearTimeout(failOpenTimer);
      setLoading(false);
    });

    return () => {
      clearTimeout(failOpenTimer);
      unsubscribe();
    };
  }, []);

  // Disse verdiene blir tilgjengelige via useAuth()
  const value = {
    currentUser,
    userData,
    register,
    login,
    loginWithGoogle,
    completeSocialSignup,
    logout,
    refreshUserData,
    loading,
  };

  // Alltid rendre children: å skjule hele appen til auth er klar gir tom skjerm i noen
  // innebygde nettlesere (f.eks. Cursor) hvis Firebase Auth/IndexedDB henger eller er blokkert.
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
