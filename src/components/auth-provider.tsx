'use client';

import { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, KeyRound } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';
import { getUserProfileByEmail, saveUserProfile } from '@/lib/services/userService';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ADMIN_EMAIL = 'beside1s@kshcm.net';

// --- Pure JS TOTP & Base32 Decoding Helpers (Offline & Turbopack Safe) ---

function base32Decode(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/=+$/, '').toUpperCase();
  const len = clean.length;
  
  const byteLength = Math.floor((len * 5) / 8);
  const view = new DataView(new ArrayBuffer(byteLength));
  
  let bits = 0;
  let value = 0;
  let index = 0;
  
  for (let i = 0; i < len; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      if (index < byteLength) {
        view.setUint8(index++, (value >>> bits) & 255);
      }
    }
  }
  return new Uint8Array(view.buffer);
}

async function generateTOTPForCounter(keyBytes: Uint8Array, counter: number): Promise<string> {
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = temp >> 8;
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: "SHA-1" } },
    false,
    ["sign"]
  );

  const signature = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    counterBytes
  );

  const hmacResult = new Uint8Array(signature);
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  try {
    const keyBytes = base32Decode(secret);
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const time = Math.floor(epoch / 30);
    
    // ±1 타임스텝 허용 (30초 시각 오차 보정용)
    for (let i = -1; i <= 1; i++) {
      const computed = await generateTOTPForCounter(keyBytes, time + i);
      if (computed === token) return true;
    }
  } catch (e) {
    console.error("TOTP verify error:", e);
  }
  return false;
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
  updateProfile: (updatedData: Partial<UserProfile>) => void;
  isParent: boolean;
  bypassLogin: (role: 'admin' | 'parent') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  const [pendingMfaUser, setPendingMfaUser] = useState<FirebaseUser | null>(null);
  const [pendingMfaProfile, setPendingMfaProfile] = useState<UserProfile | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // 개발 테스트 우회 로그인 플래그 (bypass 세션 중에는 onAuthStateChanged 무시)
  const isDevBypassRef = useRef(false);

  const generateBase32Secret = (email: string | null | undefined) => {
    if (!email) return '';
    const clean = email.replace(/[^a-z2-7]/gi, '').toUpperCase();
    return (clean + 'KISHCM2026SECRET').slice(0, 16);
  };

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

  // 로컬 동적 QR 코드 생성 효과
  useEffect(() => {
    if (!pendingMfaUser?.email) {
      setQrDataUrl('');
      return;
    }
    const secret = generateBase32Secret(pendingMfaUser.email);
    const otpauthUri = `otpauth://totp/KIS_Afterschool:${pendingMfaUser.email}?secret=${secret}&issuer=KIS_Afterschool`;
    
    QRCode.toDataURL(otpauthUri, { width: 120, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.error("QR Code Generation failed:", err);
        setQrDataUrl('');
      });
  }, [pendingMfaUser]);

  const isStudentPattern = (email: string | null) => {
    if (!email) return false;
    if (process.env.NODE_ENV === 'development' && email.includes('student')) return true; // dev 환경 폴백
    // 이메일 앞부분이 숫자 4자리로 시작하고, 도메인이 @kshcm.net인지 검사
    return /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/.test(email);
  };

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseUser?.email) return null;
    setProfileLoading(true);

    try {
      let userProfile = await getUserProfileByEmail(firebaseUser.email);
      const emailLower = firebaseUser.email.toLowerCase().trim();
      const isHardcodedAdmin = emailLower === ADMIN_EMAIL || emailLower === 'bus@kshcm.net';
      
      let needsSave = false;
      const profileUpdates: Partial<UserProfile> = {};

      // 1. 프로필이 없으면 (즉, users 컬렉션에 없는 경우) -> 버스 담당자 또는 학생 패턴인지 확인
      if (!userProfile) {
        if (emailLower === 'bus@kshcm.net') {
          console.log("Auto-provisioning bus manager account.");
          needsSave = true;
          userProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '스쿨버스 담당자',
              email: emailLower,
              role: '행정실',
              signature: '',
              isAdmin: true,
          };
        } else if (isStudentPattern(firebaseUser.email)) {
          console.log("No profile found, but matches student pattern. Creating parent profile.");
          needsSave = true;
          userProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '사용자',
              email: firebaseUser.email,
              role: '학부모',
              signature: '',
              isAdmin: isHardcodedAdmin,
          };
        } else {
          // DB에도 없고 학생 패턴도 아니면 차단 (등록되지 않은 교직원이거나 외부 계정)
          throw new Error("unregistered_account");
        }
      }

      // 2. UID가 다르면 -> 최신 UID로 업데이트 준비
      if (userProfile.uid !== firebaseUser.uid) {
        console.log(`UID mismatch. DB: ${userProfile.uid}, Auth: ${firebaseUser.uid}. Updating.`);
        needsSave = true;
        profileUpdates.uid = firebaseUser.uid;
        userProfile.uid = firebaseUser.uid; // 즉시 반영
      }

      // 3. 관리자 권한 강제 보정
      if (isHardcodedAdmin && !userProfile.isAdmin) {
          console.log("Forcing admin status for hardcoded admin email.");
          needsSave = true;
          profileUpdates.isAdmin = true;
          userProfile.isAdmin = true; // 즉시 반영
      }

      // 4. 변경사항이 있으면 저장
      if (needsSave) {
          const combinedUpdates = { ...userProfile, ...profileUpdates };
          const saveResult = await saveUserProfile(firebaseUser.uid, firebaseUser.email, combinedUpdates);
          if (!saveResult.success) {
               throw new Error(saveResult.error || "Failed to save updated user profile.");
          }
           // 저장 후 반환된 프로필을 최종본으로 사용
          if(saveResult.profile) {
            userProfile = saveResult.profile;
          }
      }
      
      setProfile(userProfile);
      return userProfile;

    } catch (error: any) {
      if (error.message === "unregistered_account") {
        throw error; // onAuthStateChanged 로 에러 전파하여 로그아웃 처리
      }
      console.error("Critical Profile Error:", error);
      toast({
          variant: 'destructive',
          title: '프로필 로딩 실패',
          description: '프로필을 불러오는 중 심각한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [toast]); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // 개발 테스트 우회 세션 중이면 Firebase 상태 변화를 무시한다
      if (isDevBypassRef.current) return;

      setLoading(true);
      setProfileLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const isKshcmDomain = firebaseUser.email.endsWith('@kshcm.net') || (process.env.NODE_ENV === 'development');
        
        if (!isKshcmDomain) {
          toast({ variant: 'destructive', title: '로그인 실패', description: '올바른 학교 계정(@kshcm.net)이 아닙니다.' });
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
        } else {
          try {
            const fetchedProfile = await fetchProfile(firebaseUser);
            if (fetchedProfile) {
              const isTeacher = !isStudentPattern(firebaseUser.email);
              const mfaSessionKey = `mfa_verified_${firebaseUser.email.trim().toLowerCase()}`;
              let isAlreadyVerified = false;
              try {
                const sess = sessionStorage.getItem(mfaSessionKey);
                const local = localStorage.getItem(mfaSessionKey);
                if (sess === 'true') {
                  isAlreadyVerified = true;
                } else if (local) {
                  // 7일간 신뢰할 수 있는 브라우저 세션 유지
                  const passedTime = Date.now() - parseInt(local, 10);
                  if (!isNaN(passedTime) && passedTime < 7 * 24 * 60 * 60 * 1000) {
                    isAlreadyVerified = true;
                    sessionStorage.setItem(mfaSessionKey, 'true');
                  }
                }
              } catch (e) {}

              const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
              const isExemptMfaRoute = currentPath.startsWith('/teacher/bus') || currentPath.startsWith('/parents');

              if (isTeacher && !isAlreadyVerified && !isExemptMfaRoute) {
                setPendingMfaUser(firebaseUser);
                setPendingMfaProfile(fetchedProfile);
                setUser(null);
                setProfile(null);
              } else {
                setUser(firebaseUser);
                setProfile(fetchedProfile);
                setPendingMfaUser(null);
                setPendingMfaProfile(null);
              }
            } else {
              toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 계정이거나 올바른 학교 계정(@kshcm.net)이 아닙니다.' });
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          } catch (e: any) {
            if (e.message === "unregistered_account") {
              toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 계정이거나 올바른 학교 계정(@kshcm.net)이 아닙니다.' });
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          }
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
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // 사용자가 팝업을 닫은 경우엔 조용히 처리
        return;
      }
      toast({ variant: 'destructive', title: '로그인 오류', description: error.message });
    }
  };

  const logout = async () => {
    isDevBypassRef.current = false; // bypass 플래그 초기화
    if (user?.email) {
      try {
        const mfaKey = `mfa_verified_${user.email.trim().toLowerCase()}`;
        sessionStorage.removeItem(mfaKey);
        localStorage.removeItem(mfaKey);
      } catch (e) {}
    }
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const isParent = profile?.role === '학부모';

  const bypassLogin = async (role: 'admin' | 'parent') => {
    if (process.env.NODE_ENV !== 'development') return;

    // 플래그를 먼저 세워서 onAuthStateChanged가 상태를 덮어쓰지 않게 방지
    isDevBypassRef.current = true;

    // 테스트용 기본 서명 캔버스 dataURL
    const dummySignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACAnNXFAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA0SURBVHhe7cExAQAAAMKg9U9tDC8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA3DVAAAYs42c0AAAAASUVORK5CYII=';

    if (role === 'admin') {
      const dummyUser = {
        uid: 'dev_bypass_admin_uid',
        email: 'beside1s@kshcm.net',
        displayName: '강지욱 (테스트)',
        emailVerified: true
      } as any;
      const existingProfile = await getUserProfileByEmail('beside1s@kshcm.net').catch(() => null);
      const dummyProfile: UserProfile = {
        email: 'beside1s@kshcm.net',
        role: '부장',
        name: '강지욱',
        uid: 'dev_bypass_admin_uid',
        isAdmin: true,
        signature: dummySignature,
        ...(existingProfile || {})
      };
      setUser(dummyUser);
      setProfile(dummyProfile);
      setLoading(false);
      setProfileLoading(false);
    } else {
      const dummyUser = {
        uid: 'dev_bypass_parent_uid',
        email: 'parent_test@kshcm.net',
        displayName: '학부모 (테스트)',
        emailVerified: true
      } as any;
      const existingProfile = await getUserProfileByEmail('parent_test@kshcm.net').catch(() => null);
      const dummyProfile: UserProfile = {
        email: 'parent_test@kshcm.net',
        role: '학부모',
        name: '김부모',
        parentName: '김부모',
        studentName: '김학생',
        studentGrade: '4',
        studentClass: '4',
        studentNumber: '2',
        parentPhone: '010-1234-5678',
        parentPinHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
        hashedPin: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
        uid: 'dev_bypass_parent_uid',
        isAdmin: false,
        signature: dummySignature,
        parentSignature: dummySignature,
        ...(existingProfile || {})
      };
      setUser(dummyUser);
      setProfile(dummyProfile);
      setLoading(false);
      setProfileLoading(false);
    }

    toast({
      title: "테스트 로그인 우회 적용",
      description: `${role === 'admin' ? '교직원(어드민)' : '학부모'} 계정으로 모의 로그인되었습니다.`
    });
  };

  const updateProfile = (updatedData: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...updatedData } : (updatedData as UserProfile));
  };

  const handleVerifyOtp = async () => {
    if (!pendingMfaUser?.email) return;

    setMfaError('');
    const isDevelopmentBypass = (process.env.NODE_ENV === 'development') && (mfaCode === '111111' || mfaCode === '000000');
    
    const secret = generateBase32Secret(pendingMfaUser.email);
    
    if (isDevelopmentBypass) {
      finalizeMfa();
      return;
    }

    const isValid = await verifyTOTP(mfaCode, secret);
    if (isValid) {
      finalizeMfa();
    } else {
      setMfaError("OTP 인증 번호가 올바르지 않습니다. 다시 입력해 주세요.");
    }
  };

  const finalizeMfa = () => {
    if (pendingMfaUser?.email) {
      try {
        const mfaKey = `mfa_verified_${pendingMfaUser.email.trim().toLowerCase()}`;
        sessionStorage.setItem(mfaKey, 'true');
        localStorage.setItem(mfaKey, Date.now().toString());
      } catch (e) {}
    }
    setUser(pendingMfaUser);
    setProfile(pendingMfaProfile);
    setPendingMfaUser(null);
    setPendingMfaProfile(null);
    setMfaCode('');
    toast({
      title: "2단계 보안 인증 성공",
      description: "교직원 보안 인증에 통과했습니다."
    });
  };

  const handleCancelMfa = async () => {
    await signOut(auth);
    setPendingMfaUser(null);
    setPendingMfaProfile(null);
    setMfaCode('');
    setMfaError('');
    setProfileLoading(false);
  };

  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile, updateProfile, isParent, bypassLogin };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isExemptMfaRoute = currentPath.startsWith('/teacher/bus') || currentPath.startsWith('/parents');

  return (
    <AuthContext.Provider value={value}>
      {children}

      <Dialog open={!!pendingMfaUser && !isExemptMfaRoute} onOpenChange={(open) => { if (!open) handleCancelMfa(); }}>
        <DialogContent className="max-w-md p-6 rounded-2xl border-amber-200 bg-white">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto bg-amber-100 text-amber-800 p-3 rounded-full w-fit">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-800">교직원 2단계 보안 인증 (구글 OTP)</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              안전한 교내 정보 보호를 위해 Google Authenticator 2차 인증을 진행합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="p-3 bg-slate-50 border rounded-xl text-xs space-y-1.5 text-slate-600">
              <p className="font-semibold text-slate-800">📱 최초 1회 Google OTP 앱 등록 방법:</p>
              
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex-1 space-y-1 text-[11px] text-left">
                  <p>1. 스마트폰에서 **Google Authenticator** 앱을 실행합니다.</p>
                  <p>2. 우측 하단 **[+]** 버튼 클릭 후 **[QR 코드 스캔]**을 터치하여 우측의 QR 코드를 비춰주세요.</p>
                  <p className="text-gray-400 mt-1">※ 카메라 고장 시 수동 키 등록 방법:</p>
                  <p className="pl-2 font-mono text-[9px]">· 계정: <code className="bg-slate-200 px-0.5 rounded">KIS_Afterschool ({pendingMfaUser?.email})</code></p>
                  <p className="pl-2 font-mono text-[9px]">· 키: <code className="bg-amber-100 border border-amber-300 text-amber-900 px-0.5 rounded font-bold">{pendingMfaUser ? generateBase32Secret(pendingMfaUser.email) : ''}</code></p>
                </div>
                
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-1 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
                    <img 
                      src={qrDataUrl}
                      alt="구글 OTP 등록용 QR 코드"
                      width={120}
                      height={120}
                      className="block"
                    />
                    <span className="text-[9px] text-slate-400 font-bold">QR 스캔 즉시 등록</span>
                  </div>
                )}
              </div>

              {process.env.NODE_ENV === 'development' && (
                <p className="text-amber-700 font-bold mt-1 text-[10px]">💡 개발 테스트 우회 코드: <code className="bg-amber-100 px-1 py-0.5 rounded">000000</code> 또는 <code className="bg-amber-100 px-1 py-0.5 rounded">111111</code></p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                인증번호 6자리 입력
              </label>
              <Input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono font-bold h-12 border-slate-300 rounded-xl"
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
              />
              {mfaError && <p className="text-xs font-semibold text-destructive text-center mt-1">{mfaError}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancelMfa} className="w-1/3 rounded-xl h-11 text-xs">
              취소
            </Button>
            <Button onClick={handleVerifyOtp} className="w-2/3 rounded-xl h-11 text-xs font-bold bg-primary hover:bg-primary/95 text-white">
              인증 완료
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}
