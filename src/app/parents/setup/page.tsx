'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eraser, Save, Upload, Pencil, MapPin } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { saveUserProfile } from '@/lib/services/userService';
import { getDestinations } from '@/lib/kisbus';
import type { Destination } from '@/lib/kisbus/types';
import { Combobox } from '@/components/ui/combobox';
import { onDocConfigUpdate } from '@/lib/services/settingsService';
import type { DocConfig } from '@/lib/types';

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
  const [parentRelation, setParentRelation] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [address, setAddress] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig | null>(null);

  useEffect(() => {
    const unsub = onDocConfigUpdate((cfg) => {
      setDocConfig(cfg as DocConfig);
    });
    return () => unsub();
  }, []);

  const requirePin = docConfig ? docConfig.requireParentPin !== false : true;

  useEffect(() => {
    getDestinations().then(data => {
      const sorted = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      setDestinations(sorted);
    }).catch(console.error);
  }, []);

  const destinationOptions = useMemo(() => {
    return destinations.map(d => ({
      value: d.name,
      label: d.name
    }));
  }, [destinations]);
  
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
    
    if (requirePin) {
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        toast({ variant: 'destructive', title: '입력 오류', description: 'PIN은 숫자 4자리여야 합니다.' });
        return;
      }
      
      if (pin !== confirmPin) {
        toast({ variant: 'destructive', title: '입력 오류', description: 'PIN 번호가 일치하지 않습니다.' });
        return;
      }
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
      // 1. PIN 해싱 (requirePin이 false이면 null)
      const hashedPin = requirePin ? await hashPIN(pin) : null;
      
      // 2. 서명 업로드 (Firebase Storage 대신 Base64로 직접 Firestore에 저장)
      const signatureDataUrl = signatureMode === 'draw' 
        ? sigCanvas.current!.getTrimmedCanvas().toDataURL('image/png')
        : uploadedSignatureUrl!;
      
      const signatureUrl = signatureDataUrl;
      
      // 3. 프로필 저장
      const res = await saveUserProfile(user.uid, user.email!, {
        parentPhone: phone,
        hashedPin,
        parentSignature: signatureUrl,
        parentName: parentName.trim(),
        parentRelation: parentRelation.trim(),
        studentName: studentName.trim(),
        studentGrade,
        studentClass,
        studentNumber,
        address: address.trim(),
        residenceDestinationId: address.trim(),
      });

      if (res.success) {
        toast({ title: '등록 완료', description: '인증 정보가 성공적으로 등록되었습니다.' });
        await fetchProfile(user);
        router.push('/parents');
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
    <div className="max-w-xl mx-auto py-4 px-3 sm:py-8 sm:px-4">
      <div className="bg-card rounded-xl shadow-sm border p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-8">
        <div className="text-center space-y-1 sm:space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold font-headline">학부모 최초 정보 등록</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            전자서명과 제출 확인을 위해 필요한 정보를 등록해주세요.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {/* 학부모 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="parentName" className="text-xs sm:text-sm font-bold">학부모 성명 <span className="text-red-500">*</span></Label>
              <Input 
                id="parentName" 
                placeholder="예: 홍길동" 
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentRelation" className="text-xs sm:text-sm font-bold">학생과의 관계 <span className="text-red-500">*</span></Label>
              <select
                id="parentRelation"
                value={parentRelation}
                onChange={(e) => setParentRelation(e.target.value)}
                className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">관계 선택</option>
                <option value="부">부 (아버지)</option>
                <option value="모">모 (어머니)</option>
                <option value="조부">조부 (할아버지)</option>
                <option value="조모">조모 (할머니)</option>
                <option value="기타">기타 보호자</option>
              </select>
            </div>
          </div>

          {/* 학생 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="studentName" className="text-xs sm:text-sm font-bold">학생 이름 <span className="text-red-500">*</span></Label>
              <Input 
                id="studentName" 
                placeholder="예: 홍길동" 
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs sm:text-sm font-bold">학부모 연락처 <span className="text-red-500">*</span></Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="010-0000-0000" 
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="studentGrade" className="text-xs sm:text-sm font-bold">학년</Label>
              <Input 
                id="studentGrade" 
                type="number"
                placeholder="5" 
                value={studentGrade}
                onChange={(e) => setStudentGrade(e.target.value)}
                className="h-9 sm:h-10 text-sm text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentClass" className="text-xs sm:text-sm font-bold">반</Label>
              <Input 
                id="studentClass" 
                type="number"
                placeholder="1" 
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="h-9 sm:h-10 text-sm text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentNumber" className="text-xs sm:text-sm font-bold">번호</Label>
              <Input 
                id="studentNumber" 
                type="number"
                placeholder="15" 
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="h-9 sm:h-10 text-sm text-center"
              />
            </div>
          </div>

          {/* 등하교 목적지 및 스쿨버스 정류장 */}
          <div className="space-y-1.5 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs sm:text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>등하교 목적지 (스쿨버스 정류장)</span>
              </Label>
              <span className="text-[11px] text-indigo-700 font-medium">정류장 검색 선택</span>
            </div>
            <Combobox 
              options={destinationOptions}
              value={address || null}
              onSelect={(val) => setAddress(val || '')}
              placeholder="스쿨버스 정류장 및 목적지 검색 (예: Hung Vuong KFC, Sky 1,2...)"
            />
            <p className="text-[11px] text-slate-500">
              세부 동/호수를 입력할 필요 없이 등록된 정류장을 선택하시면 등하교 목적지와 스쿨버스가 통합 연동됩니다.
            </p>
          </div>

          {/* PIN (PIN 인증이 활성화된 경우에만 표시) */}
          {requirePin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pin" className="text-xs sm:text-sm font-bold">서명 인증 PIN (숫자 4자리)</Label>
                <Input 
                  id="pin" 
                  type="password" 
                  maxLength={4} 
                  placeholder="****" 
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPin" className="text-xs sm:text-sm font-bold">PIN 확인</Label>
                <Input 
                  id="confirmPin" 
                  type="password" 
                  maxLength={4} 
                  placeholder="****" 
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>
            </div>
          )}

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
