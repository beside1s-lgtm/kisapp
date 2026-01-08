'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';

// 관리자 이메일 하드코딩
const ADMIN_EMAIL = 'beside1s@kshcm.net';
const ALLOWED_DOMAIN = 'kshcm.net';

// --- [API Helper Functions] ---

// API가 실패해도 에러를 던지지 않고 null을 반환하도록 수정
async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`/api/users/${email}`);
    if (response.status === 404) return null;
    
    if (!response.ok) {
      console.warn(`Profile fetch failed with status: ${response.status}`);
      return null; // 에러를 던지지 않고 null 반환 (신규 생성 유도)
    }
    
    const text = await response.text();
    if (!text) return null; // 빈 응답이면 null
    
    return JSON.parse(text);
  } catch (error) {
    console.warn("API connection failed, proceeding with fallback:", error);
    return null; // 네트워크 에러 시에도 null 반환
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
      // [수정] 서버가 보낸 구체적인 에러 내용을 확인합니다.
      const errorText = await response.text();
      console.error(`[saveUserProfile] API Error: ${response.status} ${response.statusText}`);
      console.error(`[saveUserProfile] Server Response: ${errorText}`);
      
      return { success: false, error: `API Error (${response.status}): ${errorText}` };
    }
    return await response.json();
  } catch (error: any) {
    console.error("Failed to save profile via API", error);
    return { success: false, error: error.message };
  }
}

// --- [Context & Provider] ---

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
      console.error("Permission error:", error);
      toast({
        variant: 'destructive',
        title: '권한 오류',
        description: '작업 권한이 없습니다.',
      });
    };
    errorEmitter.on('permission-error', handlePermissionError);
    return () => { errorEmitter.removeListener('permission-error', handlePermissionError); };
  }, [toast]);

  const isDomainAllowed = (email: string | null) => {
    if (!email) return false;
    if (process.env.NODE_ENV === 'development') return true;
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === ALLOWED_DOMAIN;
  };

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseUser?.email) return null;
    setProfileLoading(true);

    try {
      // 1. API로 프로필 조회 시도
      let userProfile = await getUserProfileByEmail(firebaseUser.email);
      const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;

      // 2. 프로필이 없거나 API가 실패했다면 -> 임시/신규 프로필 객체 생성
      if (!userProfile) {
        console.log("No profile found or API failed. Creating temporary/new profile.");
        userProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || '사용자',
            email: firebaseUser.email,
            role: '교사',
            signature: '',
            isAdmin: isHardcodedAdmin,
        };

        // 백그라운드에서 저장 시도 (실패해도 유저는 로그인 상태 유지)
        saveUserProfile(firebaseUser.uid, firebaseUser.email, userProfile).catch(err => console.error("Background save failed:", err));
      }

      // 3. 관리자 권한 강제 보정
      if (isHardcodedAdmin && !userProfile.isAdmin) {
          userProfile.isAdmin = true;
      }
      
      setProfile(userProfile);
      return userProfile;

    } catch (error) {
      console.error("Critical Profile Error:", error);
      // 최악의 경우에도 로그인 상태를 유지하기 위해 깡통 프로필 리턴
      const fallbackProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Unknown',
          email: firebaseUser.email,
          role: 'Guest',
          isAdmin: false,
      };
      setProfile(fallbackProfile);
      return fallbackProfile;
    } finally {
      setProfileLoading(false);
    }
  }, []); // 의존성 제거

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        if (!isDomainAllowed(firebaseUser.email)) {
          toast({ variant: 'destructive', title: '로그인 실패', description: '허용되지 않은 도메인입니다.' });
          await signOut(auth);
          setUser(null);
          setProfile(null);
        } else {
          setUser(firebaseUser);
          await fetchProfile(firebaseUser);
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
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      toast({ variant: 'destructive', title: '로그인 오류', description: error.message });
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}