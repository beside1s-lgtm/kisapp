'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eraser, Save, Upload, Pencil } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { saveUserProfile } from '@/lib/services/userService';

async function hashPIN(pin: string) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('crypto.subtle.digest failed, using fallback', e);
    }
  }
  // Fallback for non-secure contexts (HTTP)
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export default function ParentsSetupPage() {
  const { user, profile, fetchProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string | null>(null);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const TARGET_WIDTH = 600;
        const TARGET_HEIGHT = 300;
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (TARGET_WIDTH - drawWidth) / 2;
        const y = (TARGET_HEIGHT - drawHeight) / 2;
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);

        const imageData = ctx.getImageData(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; 
          }
        }
        ctx.putImageData(imageData, 0, 0);

        setUploadedSignatureUrl(canvas.toDataURL('image/png'));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    
    if (!phone || phone.length < 10) {
      toast({ variant: 'destructive', title: '입력 오류', description: '올바른 연락처를 입력해주세요.' });
      return;
    }

    if (!parentName.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '학부모 성명을 입력해주세요.' });
      return;
    }

    if (!studentGrade || !studentClass || !studentNumber) {
      toast({ variant: 'destructive', title: '입력 오류', description: '자녀의 학년, 반, 번호를 모두 입력해주세요.' });
      return;
    }
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast({ variant: 'destructive', title: '입력 오류', description: 'PIN은 숫자 4자리여야 합니다.' });
      return;
    }
    
    if (pin !== confirmPin) {
      toast({ variant: 'destructive', title: '입력 오류', description: 'PIN 번호가 일치하지 않습니다.' });
      return;
    }

    if (signatureMode === 'draw' && sigCanvas.current?.isEmpty()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '서명을 입력해주세요.' });
      return;
    }
    
    if (signatureMode === 'upload' && !uploadedSignatureUrl) {
      toast({ variant: 'destructive', title: '입력 오류', description: '서명 이미지를 업로드해주세요.' });
      return;
    }

    setIsSaving(true);
    try {
      // 1. PIN 해싱
      const hashedPin = await hashPIN(pin);
      
      // 2. 서명 업로드 (Firebase Storage 대신 Base64로 직접 Firestore에 저장)
      const signatureDataUrl = signatureMode === 'draw' 
        ? sigCanvas.current!.getTrimmedCanvas().toDataURL('image/png')
        : uploadedSignatureUrl!;

      // 기존 Storage 업로드 로직 우회
      // const sigRef = ref(storage, `profile_signatures/${user.uid}.png`);
      // await uploadString(sigRef, signatureDataUrl, 'data_url');
      // const signatureUrl = await getDownloadURL(sigRef);
      
      const signatureUrl = signatureDataUrl;
      
      // 3. 프로필 저장
      const res = await saveUserProfile(user.uid, user.email!, {
        parentPhone: phone,
        hashedPin,
        parentSignature: signatureUrl,
        parentName: parentName.trim(),
        studentName: studentName.trim(),
        studentGrade,
        studentClass,
        studentNumber,
      });

      if (res.success) {
        toast({ title: '등록 완료', description: '인증 정보가 성공적으로 등록되었습니다.' });
        await fetchProfile(user);
        router.push('/parents/apply');
      } else {
        throw new Error(res.error);
      }
    } catch (error: any) {
      console.error('Setup failed:', error);
      toast({ variant: 'destructive', title: '등록 실패', description: error.message || '인증 정보 등록 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="bg-card rounded-xl shadow-sm border p-6 md:p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold font-headline">학부모 최초 정보 등록</h1>
          <p className="text-muted-foreground text-sm">
            전자서명과 제출 확인을 위해 필요한 정보를 등록해주세요. 이 정보는 문서 제출 시 법적 효력을 확인하는 데 사용됩니다.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">학부모 성명 (서명란에 표시됨)</Label>
              <Input 
                id="parentName" 
                placeholder="예: 홍길동" 
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentName">학생 이름</Label>
              <Input 
                id="studentName" 
                placeholder="예: 홍길동" 
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="studentGrade">학년</Label>
              <Input 
                id="studentGrade" 
                type="number"
                placeholder="예: 5" 
                value={studentGrade}
                onChange={(e) => setStudentGrade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentClass">반</Label>
              <Input 
                id="studentClass" 
                type="number"
                placeholder="예: 1" 
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentNumber">번호</Label>
              <Input 
                id="studentNumber" 
                type="number"
                placeholder="예: 15" 
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">학부모 연락처 (휴대폰)</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="010-0000-0000" 
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">서명 인증 PIN (숫자 4자리)</Label>
            <Input 
              id="pin" 
              type="password" 
              maxLength={4} 
              placeholder="****" 
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">PIN 확인</Label>
            <Input 
              id="confirmPin" 
              type="password" 
              maxLength={4} 
              placeholder="****" 
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end mb-2">
              <Label>디지털 서명</Label>
              <div className="flex bg-muted p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center transition-colors ${signatureMode === 'draw' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  직접 그리기
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center transition-colors ${signatureMode === 'upload' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  이미지 업로드
                </button>
              </div>
            </div>

            {signatureMode === 'draw' ? (
              <>
                <div className="flex justify-end mb-2">
                  <Button variant="ghost" size="sm" onClick={clearSignature} className="h-8 px-2 text-muted-foreground">
                    <Eraser className="h-4 w-4 mr-1" /> 다시 쓰기
                  </Button>
                </div>
                <div className="border-2 border-dashed rounded-lg bg-white overflow-hidden touch-none relative" style={{ height: '200px' }}>
                  <SignatureCanvas 
                    ref={sigCanvas}
                    canvasProps={{ className: 'w-full h-full' }}
                    penColor="black"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  영역 안에 마우스나 터치로 서명해주세요.
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed rounded-lg bg-muted/30 overflow-hidden relative flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" 
                  style={{ height: '200px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadedSignatureUrl ? (
                    <img src={uploadedSignatureUrl} alt="서명 미리보기" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-center p-6 flex flex-col items-center text-muted-foreground">
                      <Upload className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">클릭하여 서명 이미지 업로드</p>
                      <p className="text-xs opacity-70 mt-1">종이에 한 서명 사진을 올려주세요. (배경 자동 제거)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                </div>
                {uploadedSignatureUrl && (
                  <div className="flex justify-center mt-2">
                    <Button variant="outline" size="sm" onClick={() => setUploadedSignatureUrl(null)}>
                      <Eraser className="h-4 w-4 mr-1" /> 서명 다시 올리기
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  자동으로 600x300 크기로 변환되며, 흰색 배경이 투명하게 처리됩니다.
                </p>
              </div>
            )}
          </div>
        </div>

        <Button 
          className="w-full h-12 text-lg" 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 등록 중...</>
          ) : (
            <><Save className="mr-2 h-5 w-5" /> 등록 완료</>
          )}
        </Button>
      </div>
    </div>
  );
}
