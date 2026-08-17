'use client';
import React, { useState, useEffect } from 'react';
import { getStudents, getDestinations, addStudent, addSuggestedDestination, updateStudent } from '@/lib/kisbus';
import { Destination, NewStudent, Student } from '@/lib/kisbus/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Bus, Clock, Plus, Trash2, Users, ArrowLeft, Home, Sparkles, Search, Check, Info, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { useTranslation } from '@/hooks/use-translation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';

interface SiblingEntry {
    nameKo: string;
    nameEn: string;
    grade: string;
    studentClass: string;
    gender: 'Male' | 'Female';
    schoolName?: string;
    isExternal?: boolean;
}

export default function ApplyPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { profile } = useAuth();

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    
    // Main student state (auto-populated from profile)
    const [nameKo, setNameKo] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    const [contact, setContact] = useState('');
    
    // Sibling state
    const [hasSiblings, setHasSiblings] = useState(false);
    const [siblings, setSiblings] = useState<SiblingEntry[]>([]);
    const [siblingSearchQuery, setSiblingSearchQuery] = useState('');

    // Destination States
    const [primaryDestinationId, setPrimaryDestinationId] = useState<string | null>(null);
    const [hasDifferentReturnDest, setHasDifferentReturnDest] = useState(false);

    const [morningDestinationId, setMorningDestinationId] = useState<string | null>(null);
    const [useCustomMorningDest, setUseCustomMorningDest] = useState(false);
    const [customMorningDestName, setCustomMorningDestName] = useState('');

    const [afternoonDestinationId, setAfternoonDestinationId] = useState<string | null>(null);
    const [useCustomAfternoonDest, setUseCustomAfternoonDest] = useState(false);
    const [customAfternoonDestName, setCustomAfternoonDestName] = useState('');

    const { toast } = useToast();

    // 1. 학부모 로그인 프로필 데이터 자동 채움 (한글/영문 성명, 학년, 반, 연락처, 거주 정류장, 연동 형제 목록)
    useEffect(() => {
        if (profile) {
            if (profile.studentName) setNameKo(profile.studentName);
            if (profile.studentNameEn || profile.studentName) setNameEn(profile.studentNameEn || profile.studentName || '');
            if (profile.studentGrade) setGrade(String(profile.studentGrade));
            if (profile.studentClass) setStudentClass(String(profile.studentClass));
            if (profile.parentPhone) setContact(profile.parentPhone);

            // 거주지 정류장 프로필 자동 적용
            if (profile.residenceDestinationId) {
                setPrimaryDestinationId(profile.residenceDestinationId);
                setMorningDestinationId(profile.residenceDestinationId);
                setAfternoonDestinationId(profile.residenceDestinationId);
            }
            if (profile.customResidenceDestination) {
                setUseCustomMorningDest(true);
                setCustomMorningDestName(profile.customResidenceDestination);
                setUseCustomAfternoonDest(true);
                setCustomAfternoonDestName(profile.customResidenceDestination);
            }

            if (profile.linkedStudents && profile.linkedStudents.length > 0) {
                setHasSiblings(true);
                setSiblings(profile.linkedStudents.map(s => ({
                    nameKo: s.nameKo,
                    nameEn: s.nameEn || s.nameKo,
                    grade: s.grade,
                    studentClass: s.studentClass || '1',
                    gender: s.gender || 'Male',
                    schoolName: '초등학교',
                    isExternal: false
                })));
            }
        }
    }, [profile]);

    useEffect(() => {
        const fetchData = async () => {
            const [destinationsData, studentsData] = await Promise.all([
                getDestinations(),
                getStudents()
            ]);
            destinationsData.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setDestinations(destinationsData);
            setAllStudents(studentsData);
        };
        fetchData();
    }, []);

    const destinationOptions = destinations.map(d => ({ value: d.id, label: d.name }));

    // 대표 거주지 목적지 선택 시 등/하교 목적지 일괄 세팅
    const handleSelectPrimaryDestination = (destId: string | null) => {
        setPrimaryDestinationId(destId);
        setMorningDestinationId(destId);
        if (!hasDifferentReturnDest) {
            setAfternoonDestinationId(destId);
        }
    };

    // 동일 연락처/프로필 기반 연동 추천 자녀 목록
    const suggestedSiblings = allStudents.filter(s => {
        if (!contact) return false;
        const cleanContact = contact.replace(/\D/g, '');
        const sContact = (s.contact || '').replace(/\D/g, '');
        const isSamePhone = cleanContact.length > 5 && sContact.length > 5 && cleanContact === sContact;
        const isDifferentStudent = s.nameKo !== nameKo && s.name !== nameEn;
        return isSamePhone && isDifferentStudent;
    });

    // 시스템 등록 학생 검색 필터
    const searchFilteredStudents = siblingSearchQuery.trim().length >= 1
        ? allStudents.filter(s => 
            (s.nameKo?.includes(siblingSearchQuery.trim()) || s.name?.toLowerCase().includes(siblingSearchQuery.trim().toLowerCase())) &&
            s.nameKo !== nameKo
        ).slice(0, 5)
        : [];

    const handleAddSuggestedSibling = (student: Student) => {
        const exists = siblings.some(sib => sib.nameKo === student.nameKo || sib.nameEn === student.name);
        if (exists) {
            toast({ title: '안내', description: '이미 추가된 형제/자매 학생입니다.' });
            return;
        }
        setSiblings([...siblings, {
            nameKo: student.nameKo || student.name,
            nameEn: student.nameEn || student.name,
            grade: student.grade || '1',
            studentClass: student.class || '1',
            gender: (student.gender as 'Male' | 'Female') || 'Male',
            schoolName: '초등학교',
            isExternal: false
        }]);
    };

    const handleAddManualSibling = () => {
        setSiblings([...siblings, { 
            nameKo: '', 
            nameEn: '', 
            grade: '', 
            studentClass: '', 
            gender: 'Male',
            schoolName: '초등학교',
            isExternal: false
        }]);
    };

    const handleRemoveSibling = (index: number) => {
        setSiblings(siblings.filter((_, i) => i !== index));
    };

    const updateSibling = (index: number, field: keyof SiblingEntry, value: any) => {
        const newSiblings = [...siblings];
        newSiblings[index] = { ...newSiblings[index], [field]: value } as SiblingEntry;
        setSiblings(newSiblings);
    };

    const validateAllStudents = () => {
        if (!nameKo.trim() || !nameEn.trim() || !grade.trim() || !studentClass.trim() || !gender) {
            toast({ title: t('error'), description: '학생 기본 정보(한글/영문 성명, 학년, 반, 성별)를 모두 채워주세요.', variant: "destructive" });
            return false;
        }
        
        if (hasSiblings) {
            for (let i = 0; i < siblings.length; i++) {
                const s = siblings[i];
                if (!s.nameKo.trim() || !s.grade.trim() || !s.gender) {
                    toast({ title: t('error'), description: `형제/자매 #${i + 1}의 필수 정보(성명, 학년, 성별)를 입력해주세요.`, variant: "destructive" });
                    return false;
                }
            }
        }
        return true;
    };

    const findStudentInList = (sNameKo: string, sNameEn: string, sGrade: string, sClass: string): Student | undefined => {
        return allStudents.find(s => 
            (s.nameKo === sNameKo.trim() || s.nameEn === sNameEn.trim() || s.name === sNameEn.trim()) && 
            s.grade === sGrade.trim() && 
            s.class === sClass.trim()
        );
    };
    
    const processStudentApplication = async (studentData: {nameKo: string, nameEn: string, grade: string, studentClass: string, gender: 'Male'|'Female', contact: string, siblingGroupId?: string | null}, appData: Partial<Student>) => {
        const existingStudent = findStudentInList(studentData.nameKo, studentData.nameEn, studentData.grade, studentData.studentClass);
        
        if (existingStudent) {
            const updatePayload = {
                ...appData,
                name: studentData.nameEn.trim() || studentData.nameKo.trim(),
                nameKo: studentData.nameKo.trim(),
                nameEn: studentData.nameEn.trim() || studentData.nameKo.trim(),
                grade: studentData.grade.trim(),
                class: studentData.studentClass.trim(),
                gender: studentData.gender,
                contact: studentData.contact.trim(),
                applicationStatus: 'pending' as const,
                siblingGroupId: studentData.siblingGroupId || existingStudent.siblingGroupId
            };
            await updateStudent(existingStudent.id, updatePayload);
            return existingStudent.id;
        } else {
            const newStudentPayload: NewStudent = {
                name: studentData.nameEn.trim() || studentData.nameKo.trim(),
                nameKo: studentData.nameKo.trim(),
                nameEn: studentData.nameEn.trim() || studentData.nameKo.trim(),
                grade: studentData.grade.trim(),
                class: studentData.studentClass.trim(),
                gender: studentData.gender,
                contact: studentData.contact.trim(),
                morningDestinationId: appData.morningDestinationId || null,
                afternoonDestinationId: appData.afternoonDestinationId || null,
                afterSchoolDestinations: appData.afterSchoolDestinations || {},
                satMorningDestinationId: appData.satMorningDestinationId || null,
                satAfternoonDestinationId: appData.satAfternoonDestinationId || null,
                suggestedMorningDestination: appData.suggestedMorningDestination || null,
                suggestedAfternoonDestination: appData.suggestedAfternoonDestination || null,
                suggestedSatMorningDestination: appData.suggestedSatMorningDestination || null,
                suggestedSatAfternoonDestination: appData.suggestedSatAfternoonDestination || null,
                applicationStatus: 'pending',
                siblingGroupId: studentData.siblingGroupId || null
            };
            const added = await addStudent(newStudentPayload);
            return added.id;
        }
    };

    const handleMainSubmit = async () => {
        if (!validateAllStudents()) return;
        
        const hasMorningSelection = !useCustomMorningDest && (morningDestinationId || primaryDestinationId);
        const hasCustomMorning = useCustomMorningDest && customMorningDestName.trim();
        const effectiveMorningId = useCustomMorningDest ? null : (morningDestinationId || primaryDestinationId);

        const hasAfternoonSelection = !useCustomAfternoonDest && (afternoonDestinationId || primaryDestinationId);
        const hasCustomAfternoon = useCustomAfternoonDest && customAfternoonDestName.trim();
        const effectiveAfternoonId = useCustomAfternoonDest ? null : (afternoonDestinationId || primaryDestinationId);

        if (!hasMorningSelection && !hasCustomMorning && !hasAfternoonSelection && !hasCustomAfternoon) {
            toast({ title: t('error'), description: '거주 목적지(정류장)를 선택하거나 신규 목적지를 입력해주세요.', variant: "destructive" });
            return;
        }

        let baseAppData: Partial<Student> = {
            morningDestinationId: effectiveMorningId,
            suggestedMorningDestination: useCustomMorningDest ? customMorningDestName.trim() : null,
            afternoonDestinationId: effectiveAfternoonId,
            suggestedAfternoonDestination: useCustomAfternoonDest ? customAfternoonDestName.trim() : null,
        };

        const siblingGroupId = hasSiblings ? `group_${Date.now()}` : null;

        try {
            if (useCustomMorningDest && customMorningDestName.trim()) {
                await addSuggestedDestination({ name: customMorningDestName.trim() });
            }
            if (useCustomAfternoonDest && customAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customAfternoonDestName.trim() });
            }

            await processStudentApplication({ nameKo, nameEn, grade, studentClass, gender, contact, siblingGroupId }, baseAppData);

            if (hasSiblings) {
                for (const sib of siblings) {
                    await processStudentApplication({ 
                        nameKo: sib.nameKo, 
                        nameEn: sib.nameEn || sib.nameKo, 
                        grade: sib.grade, 
                        studentClass: sib.studentClass || '1', 
                        gender: sib.gender, 
                        contact: contact, 
                        siblingGroupId 
                    }, baseAppData);
                }
            }

            toast({ 
                title: '스쿨버스 탑승 신청 완료! 🎉', 
                description: hasSiblings 
                    ? `[${nameKo}] 학생 및 형제/자매 (${siblings.length}명)의 탑승 신청이 접수되었습니다.` 
                    : `[${nameKo}] 학생의 스쿨버스 탑승 신청이 성공적으로 접수되었습니다.` 
            });

            setPrimaryDestinationId(null);
            setMorningDestinationId(null);
            setCustomMorningDestName('');
            setUseCustomMorningDest(false);
            setAfternoonDestinationId(null);
            setCustomAfternoonDestName('');
            setUseCustomAfternoonDest(false);
            
            const freshStudents = await getStudents();
            setAllStudents(freshStudents);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
            {/* 통일된 상단 네비게이션 헤더 */}
            <div className="flex items-center justify-between print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="bg-white hover:bg-slate-50 text-slate-700 shadow-2xs font-bold rounded-xl" onClick={() => router.back()}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        뒤로가기
                    </Button>
                    <Button variant="outline" size="sm" className="bg-white hover:bg-slate-50 text-slate-700 shadow-2xs font-bold rounded-xl" onClick={() => router.push('/parents')}>
                        <Home className="mr-1.5 h-4 w-4" />
                        홈
                    </Button>
                </div>
                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>학부모 스쿨버스 간소화 신청 포털</span>
                </div>
            </div>

            <div className="flex flex-col items-center gap-6 w-full">
                {/* 1. 학생 기본 정보 카드 */}
                <Card className="w-full shadow-sm rounded-2xl border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <UserPlus className="text-indigo-600 w-5 h-5" />
                                {t('apply.base_info.title')}
                            </CardTitle>
                            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-md">
                                프로필 정보 자동 연결됨
                            </span>
                        </div>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                            학부모 계정에 등록된 자녀 기본 정보가 자동으로 채워졌습니다. 필요한 경우 자유롭게 수정하실 수 있습니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/80">
                            <div className="space-y-1.5">
                                <Label htmlFor="nameKo" className="text-xs font-bold text-slate-700">{t('student.name_ko', '성명(한글)')}</Label>
                                <Input id="nameKo" placeholder="홍길동" required value={nameKo} onChange={e => setNameKo(e.target.value)} className="bg-white text-xs font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="nameEn" className="text-xs font-bold text-slate-700">{t('student.name_en', '성명(영문)')}</Label>
                                <Input id="nameEn" placeholder="Hong Gildong" required value={nameEn} onChange={e => setNameEn(e.target.value)} className="bg-white text-xs" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="contact" className="text-xs font-bold text-slate-700">{t('student.contact', '학부모 연락처')}</Label>
                                <Input id="contact" placeholder="01012345678" value={contact} onChange={e => setContact(e.target.value)} className="bg-white text-xs font-mono" />
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:col-span-1">
                                <div className="space-y-1.5">
                                    <Label htmlFor="grade" className="text-xs font-bold text-slate-700">{t('student.grade', '학년')}</Label>
                                    <Input id="grade" placeholder="1" required value={grade} onChange={e => setGrade(e.target.value)} className="bg-white text-xs font-bold text-center" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="class" className="text-xs font-bold text-slate-700">{t('student.class', '반')}</Label>
                                    <Input id="class" placeholder="1" required value={studentClass} onChange={e => setStudentClass(e.target.value)} className="bg-white text-xs font-bold text-center" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="gender" className="text-xs font-bold text-slate-700">{t('student.gender', '성별')}</Label>
                                    <Select required value={gender} onValueChange={(v) => setGender(v as 'Male' | 'Female')}>
                                        <SelectTrigger id="gender" className="bg-white text-xs">
                                            <SelectValue placeholder="선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Male">남자</SelectItem>
                                            <SelectItem value="Female">여자</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* 2. 형제/자매 탑승 신청 및 할인 선택 (선택 체크박스) */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="has-siblings" 
                                    checked={hasSiblings} 
                                    onCheckedChange={(checked) => {
                                        setHasSiblings(checked as boolean);
                                        if (!checked) setSiblings([]);
                                    }} 
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <Label htmlFor="has-siblings" className="text-sm font-bold text-slate-900 cursor-pointer flex items-center gap-1.5">
                                    <span>형제/자매가 스쿨버스에 함께 탑승하나요? (형제할인 혜택 적용)</span>
                                    <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                                        💡 동시 탑승 할인
                                    </span>
                                </Label>
                            </div>
                            <p className="text-xs text-slate-500 pl-6">
                                ※ 형제/자매이더라도 탑승하지 않는 자녀(도보/자전거/별도등교)가 있을 수 있으므로 <strong>실제 탑승하는 형제만 체크</strong>해주세요.
                            </p>

                            {hasSiblings && (
                                <div className="space-y-4 pt-3 border-t border-slate-200 animate-in fade-in duration-300">
                                    {/* 1단계: 자동 추천 자녀 (연락처 연동) */}
                                    {suggestedSiblings.length > 0 && (
                                        <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>💡 등록된 형제/자매 자녀 감지 (클릭 시 자동 추가):</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestedSiblings.map(student => (
                                                    <button
                                                        key={student.id}
                                                        type="button"
                                                        onClick={() => handleAddSuggestedSibling(student)}
                                                        className="bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                                        <span>{student.grade}학년 {student.class}반 {student.nameKo || student.name} ({student.gender === 'Male' ? '남' : '여'})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2단계: 시스템 등록 학생 검색 */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                <Search className="w-3.5 h-3.5 text-slate-500" />
                                                <span>등록 학생 검색하여 형제 추가</span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={handleAddManualSibling}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>중/고등학생 등 직접 입력</span>
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                placeholder="학생 성명(한글 또는 영문) 검색..."
                                                value={siblingSearchQuery}
                                                onChange={e => setSiblingSearchQuery(e.target.value)}
                                                className="bg-white text-xs pr-8"
                                            />
                                            {siblingSearchQuery && (
                                                <button
                                                    onClick={() => setSiblingSearchQuery('')}
                                                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        {searchFilteredStudents.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-xl shadow-md p-2 space-y-1">
                                                {searchFilteredStudents.map(st => (
                                                    <div
                                                        key={st.id}
                                                        onClick={() => {
                                                            handleAddSuggestedSibling(st);
                                                            setSiblingSearchQuery('');
                                                        }}
                                                        className="p-2 hover:bg-indigo-50 rounded-lg cursor-pointer flex justify-between items-center text-xs"
                                                    >
                                                        <span className="font-bold text-slate-800">{st.grade}학년 {st.class}반 {st.nameKo || st.name}</span>
                                                        <span className="text-indigo-600 font-semibold text-[11px]">+ 추가</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 3단계: 추가된 형제/자매 목록 */}
                                    {siblings.length > 0 ? (
                                        <div className="space-y-3 pt-2">
                                            {siblings.map((sib, index) => (
                                                <div key={index} className="relative bg-white p-4 rounded-xl border border-indigo-200 space-y-3 shadow-2xs">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="absolute top-3 right-3 h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleRemoveSibling(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-4 w-4 text-indigo-600" />
                                                        <span className="text-xs font-bold text-indigo-900">함께 탑승하는 형제/자매 #{index + 1}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-bold text-slate-600">성명(한글)</Label>
                                                            <Input value={sib.nameKo} onChange={e => updateSibling(index, 'nameKo', e.target.value)} placeholder="홍길순" className="text-xs h-9" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-bold text-slate-600">성명(영문)</Label>
                                                            <Input value={sib.nameEn} onChange={e => updateSibling(index, 'nameEn', e.target.value)} placeholder="Hong Gilsoon" className="text-xs h-9" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-bold text-slate-600">학년</Label>
                                                            <Input value={sib.grade} onChange={e => updateSibling(index, 'grade', e.target.value)} placeholder="3" className="text-xs h-9 text-center font-bold" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-bold text-slate-600">반</Label>
                                                            <Input value={sib.studentClass} onChange={e => updateSibling(index, 'studentClass', e.target.value)} placeholder="2" className="text-xs h-9 text-center font-bold" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-bold text-slate-600">성별</Label>
                                                            <Select value={sib.gender} onValueChange={(v) => updateSibling(index, 'gender', v)}>
                                                                <SelectTrigger className="text-xs h-9">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Male">남자</SelectItem>
                                                                    <SelectItem value="Female">여자</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic text-center p-3 bg-white rounded-xl border border-dashed border-slate-200">
                                            추가된 함께 탑승할 형제/자매가 없습니다. 위의 추천 버튼이나 검색을 이용해 등록하세요.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. 학생 거주 주소 & 버스 목적지 (Stops) 선택 카드 */}
                <Card className="w-full shadow-sm rounded-2xl border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                            <MapPin className="text-indigo-600 w-5 h-5" />
                            📍 거주 주소 및 스쿨버스 정류장 선택
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                            세부 동/호수를 입력할 필요 없이 <strong>버스 관리자가 등록한 목적지 정류장</strong>을 선택해주시면 주소 및 등/하교 정류장이 통합 설정됩니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        {/* 대표 정류장 선택 */}
                        <div className="space-y-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                            <Label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                <span>1. 거주 아파트 / 스쿨버스 정류장 (관리자 등록 공식 정류장)</span>
                            </Label>
                            <Combobox 
                                options={destinationOptions}
                                value={primaryDestinationId}
                                onSelect={handleSelectPrimaryDestination}
                                placeholder="정류장 및 목적지 선택 (예: 푸미흥 1차 아파트, 스카이 가든 3차...)"
                                disabled={useCustomMorningDest}
                            />
                        </div>

                        {/* 신규/미등록 목적지 수동 신청 */}
                        <div className="flex items-center space-x-2 py-1">
                            <Checkbox 
                                id="useCustomMorningDest" 
                                checked={useCustomMorningDest} 
                                onCheckedChange={(checked) => setUseCustomMorningDest(checked as boolean)} 
                            />
                            <label htmlFor="useCustomMorningDest" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                ➕ 정류지 목록에 거주지가 없는 경우 직접 신규 목적지 입력/신청
                            </label>
                        </div>
                        {useCustomMorningDest && (
                            <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 animate-in fade-in duration-300">
                                <Label htmlFor="customMorningDestName" className="text-xs font-bold text-slate-800">신규 신청할 목적지/정류장 명칭</Label>
                                <Input 
                                    id="customMorningDestName" 
                                    value={customMorningDestName} 
                                    onChange={e => setCustomMorningDestName(e.target.value)} 
                                    placeholder="예: 7군 신규 아파트 2차 정문 앞" 
                                    className="bg-white text-xs"
                                />
                                <p className="text-[11px] text-slate-500">
                                    입력하신 신규 목적지는 버스 관리자 승인 후 공식 노선 정류장으로 등록됩니다.
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* 하교 목적지 다름 옵션 */}
                        <div className="flex items-center space-x-2 py-1">
                            <Checkbox 
                                id="hasDifferentReturnDest" 
                                checked={hasDifferentReturnDest} 
                                onCheckedChange={(checked) => {
                                    setHasDifferentReturnDest(checked as boolean);
                                    if (!checked) setAfternoonDestinationId(primaryDestinationId);
                                }} 
                            />
                            <label htmlFor="hasDifferentReturnDest" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                🔄 하교 목적지(정류장)가 등교와 다릅니다
                            </label>
                        </div>

                        {hasDifferentReturnDest && (
                            <div className="space-y-2 bg-amber-50/60 p-4 rounded-xl border border-amber-200 animate-in fade-in duration-300">
                                <Label htmlFor="afternoonDestinationId" className="text-xs font-bold text-amber-900">하교 전용 정류장 선택</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={afternoonDestinationId}
                                    onSelect={setAfternoonDestinationId}
                                    placeholder="하교 목적지 선택..."
                                    disabled={useCustomAfternoonDest}
                                />
                            </div>
                        )}

                        <Button 
                            onClick={handleMainSubmit} 
                            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-xl shadow-sm cursor-pointer"
                        >
                            🚀 {hasSiblings ? `스쿨버스 탑승 신청서 제출 (${siblings.length + 1}명 자녀 동시 신청)` : '스쿨버스 탑승 신청서 제출'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
