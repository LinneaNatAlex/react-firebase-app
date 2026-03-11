// Håndterer innlogging for hele appen
// Bruk useAuth() i andre komponenter for å få tilgang til brukerdata og funksjoner

import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

const AuthContext = createContext();

// Denne hooken brukes i andre komponenter: const { login, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext);
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

    // Lagre brukertype og annen info i Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: email,
      userType: userType,
      createdAt: new Date(),
      ...additionalData,
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
    });
    
    // Oppdater lokal userData
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (userDoc.exists()) {
      setUserData(userDoc.data());
    }
  }

  function logout() {
    return signOut(auth);
  }

  // Kjører når appen starter - sjekker om bruker allerede er logget inn
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      // Hent ekstra brukerdata fra database hvis innlogget
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
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
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
