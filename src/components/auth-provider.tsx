'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    setProfileLoading(true);
    try {
      let userProfile = await getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        // Create a basic profile if one doesn't exist
        const newProfile: UserProfile = {
          name: firebaseUser.displayName || 'New User',
          role: '담당', // default role
          email: firebaseUser.email!,
          signature: '',
        };
        await saveUserProfile(firebaseUser.uid, firebaseUser.email!, newProfile);
        userProfile = newProfile;
      }
      setProfile(userProfile);
    } catch (error) {
      console.error("Failed to fetch or create profile", error);
      toast({ variant: 'destructive', title: 'Profile Error', description: 'Could not load your profile.' });
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.email?.endsWith('@kshcm.net')) {
            setUser(firebaseUser);
            await fetchProfile(firebaseUser);
        } else {
            toast({ variant: 'destructive', title: '접근 거부', description: 'kshcm.net 도메인 계정으로만 로그인할 수 있습니다.'});
            await signOut(auth);
            setUser(null);
            setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile, toast]);
  
  const googleSignIn = async () => {
    setLoading(true);
    try {
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error(error);
      let description = 'Could not sign in with Google.';
      if (error.code === 'auth/unauthorized-domain') {
        description = 'This domain is not authorized for sign-in. Please contact support.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        description = 'Sign-in popup was closed before completion.';
      }
      toast({ variant: 'destructive', title: 'Sign-in Failed', description: description });
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
       console.error(error);
       toast({ variant: 'destructive', title: 'Sign-out Failed', description: 'An error occurred while signing out.' });
    } finally {
      setLoading(false);
    }
  };
  
  const value = { user, profile, loading, profileLoading, googleSignIn, logout, setProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
