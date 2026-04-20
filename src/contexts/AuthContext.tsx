import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  uid: string;
  matricula: string;
  name: string;
  role: 'employee' | 'manager';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (matricula: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'employees', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (matricula: string) => {
    // Mock database of employees for name identification
    const EMPLOYEE_DATABASE: Record<string, string> = {
      '4429': 'João Silva',
      '5560': 'Maria Oliveira',
      '1234': 'Roberto Junior',
      '999': 'Kayo Santos',
      '2026': 'Beatriz Souza',
      '7890': 'Ana Paula Rangel'
    };

    // Using anonymous auth for a frictionless experience with just Matricula
    const userCredential = await signInAnonymously(auth);
    const u = userCredential.user;
    
    // Check if profile exists, otherwise create
    const docRef = doc(db, 'employees', u.uid);
    const docSnap = await getDoc(docRef);
    
    let newProfile: UserProfile;
    if (!docSnap.exists()) {
      // Identity the name or fallback to generic
      const identifiedName = EMPLOYEE_DATABASE[matricula] || `Colaborador ${matricula}`;
      // Default roles for demo (Matricula containing '999' as manager)
      const role = matricula.includes('999') ? 'manager' : 'employee';
      newProfile = {
        uid: u.uid,
        matricula,
        name: identifiedName,
        role
      };
      await setDoc(docRef, newProfile);
    } else {
      newProfile = docSnap.data() as UserProfile;
    }
    setProfile(newProfile);
  };
    
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const u = userCredential.user;
    
    const docRef = doc(db, 'employees', u.uid);
    const docSnap = await getDoc(docRef);
    
    let newProfile: UserProfile;
    if (!docSnap.exists()) {
      newProfile = {
        uid: u.uid,
        matricula: 'MG' + u.uid.substring(0, 4),
        name: u.displayName || 'Gestor',
        role: u.email === 'kayosantos1980@gmail.com' ? 'manager' : 'employee'
      };
      await setDoc(docRef, newProfile);
    } else {
      newProfile = docSnap.data() as UserProfile;
      // Ensure admin has manager role if they log in via Google
      if (u.email === 'kayosantos1980@gmail.com' && newProfile.role !== 'manager') {
        newProfile.role = 'manager';
        await updateDoc(docRef, { role: 'manager' });
      }
    }
    setProfile(newProfile);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
