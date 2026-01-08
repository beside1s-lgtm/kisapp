'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';

const ADMIN_EMAIL = 'beside1s@kshcm.net';

async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    try {
        const response = await fetch(`/api/users/${email}`);
        if (response.status === 404) {
            return null; // User not found is not an error in this context
        }
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to fetch profile response:', errorBody);
            throw new Error('Failed to fetch profile');
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch profile from API", error);
        // Re-throw to be caught by the caller
        throw error;
    }
}

async function saveUserProfile(userId: string, email: string, profile: Partial<UserProfile>): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
     try {
        const response = await fetch(`/api/users/${email}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userId, profileData: profile }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({ error: 'Failed to save profile and parse error' }));
            throw new Error(data.error || 'Failed to save profile');
        }
        return await response.json();
    } catch (error: any) {
        console.error("Failed to save profile via API", error);
        return { success: false, error: error.message };
    }
}


interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: (user: FirebaseUser) => Promise<UserProfile | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: Error) => {
      // In a real app, you might want to log this to an error tracking service
      console.error("A Firestore permission error was globally caught:", error);
      toast({
        variant: 'destructive',
        title: '권한 오류',
        description: '요청한 작업을 수행할 권한이 없습니다. 관리자에게 문의하거나 보안 규칙을 확인하세요.',
        duration: 8000,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.removeListener('permission-error', handlePermissionError);
    };
  }, [toast]);


  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseUser?.email) return null;
    setProfileLoading(true);
    const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;

    try {
      let userProfile = await getUserProfileByEmail(firebaseUser.email);
      
      // If user has a profile, ensure it's up-to-date
      if (userProfile) {
         if (isHardcodedAdmin && !userProfile.isAdmin) {
          userProfile.isAdmin = true;
          await saveUserProfile(firebaseUser.uid, firebaseUser.email, { isAdmin: true });
        }
        
        if (userProfile.uid !== firebaseUser.uid || !userProfile.uid) {
            userProfile.uid = firebaseUser.uid;
            await saveUserProfile(firebaseUser.uid, firebaseUser.email, { uid: firebaseUser.uid });
        }
        setProfile(userProfile);
        return userProfile;

      } else {
        // If user has no profile, create a default one for them to allow login.
        const defaultProfile: Partial<UserProfile> = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || '새 사용자',
            email: firebaseUser.email,
            role: '교사', // Default role
            signature: '',
            isAdmin: isHardcodedAdmin, // Grant admin rights if it's the admin email
        };

        const result = await saveUserProfile(firebaseUser.uid, firebaseUser.email, defaultProfile);
        if (result.success && result.profile) {
            setProfile(result.profile);
            return result.profile;
        } else {
            // This can happen if the save fails. We should log out.
            throw new Error(result.error || "Failed to create default user profile.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch or create profile", error);
      toast({ variant: 'destructive', title: 'Profile Error', description: '프로필을 불러오는 데 실패했습니다.' });
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);

      if (firebaseUser && firebaseUser.email) {
        const allowedDomains = ['@kshcm.net', '@kish.kr'];
        const isAllowedDomain = allowedDomains.some(domain => firebaseUser.email!.endsWith(domain)) || process.env.NODE_ENV === 'development';

        if (!isAllowedDomain) {
            toast({ variant: 'destructive', title: '접근 거부', description: '허용된 도메인 계정으로만 로그인할 수 있습니다.'});
            await signOut(auth);
            setUser(null);
            setProfile(null);
        } else {
            try {
              const fetchedProfile = await fetchProfile(firebaseUser);
              if (fetchedProfile) {
                  setUser(firebaseUser);
              } else {
                  // This block should ideally not be reached with the new logic, but as a safeguard:
                  toast({ variant: 'destructive', title: '로그인 실패', description: '프로필을 설정하는 중에 오류가 발생했습니다.' });
                  await signOut(auth);
                  setUser(null);
                  setProfile(null);
              }
            } catch (e) {
               console.error("Login failed during profile fetch:", e);
               await signOut(auth);
               setUser(null);
               setProfile(null);
            }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      setProfileLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile, toast]);
  
  const googleSignIn = async () => {
    try {
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      // Re-throw the error to be caught by the caller in the login page
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };
  
  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}
