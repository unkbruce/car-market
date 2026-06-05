import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import api from '../api/api.js';
import { auth } from '../firebase/firebase.js';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setIsAuthLoading(true);
        setCurrentUser(user);

        if (!user) {
          setProfile(null);
          return;
        }

        const response = await api.get('/api/users/me', {
          params: {
            uid: user.uid,
          },
        });

        setProfile(response.data.data || null);
      } catch {
        setProfile(null);
      } finally {
        setIsAuthLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function register({ email, password, displayName, role }) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(credential.user, {
      displayName,
    });

    const response = await api.post('/api/users', {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName,
      role,
    });

    setCurrentUser(credential.user);
    setProfile(response.data.data || null);

    return credential;
  }

  function login({ email, password }) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setProfile(null);
    return signOut(auth);
  }

  const value = useMemo(
    () => ({
      currentUser,
      profile,
      isAuthenticated: Boolean(currentUser),
      isAuthLoading,
      register,
      login,
      logout,
    }),
    [currentUser, profile, isAuthLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

export { AuthProvider, useAuth };
