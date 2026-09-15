'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    BrainCircuit, 
    FileText, 
    Loader2, 
    Sparkles, 
    Printer, 
    Copy, 
    CheckCircle2, 
    Save, 
    Library, 
    Trash2, 
    Pencil, 
    Send, 
    History, 
    ChevronRight, 
    Youtube, 
    PlusCircle,
    Upload,
    Check,
    Eye,
    EyeOff,
    FileCheck,
    Share2,
    Layers,
    ListFilter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateQuiz, QuizOutput } from "@/ai/flows/quiz-generation-flow";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { saveQuiz as saveQuizToDb, getQuizzes, deleteQuiz, distributeQuiz, getQuizAssignments, deleteQuizAssignment, getQuizResultsBySchool } from '@/lib/services/peService';
import { Quiz, QuizQuestion, Student, SportsClub, QuizAssignment, QuizResult } from '@/lib/pe/types';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TheoryExamManagementProps {
    allStudents?: Student[];
    sportsClubs?: SportsClub[];
}

export default function TheoryExamManagement({ allStudents = [], sportsClubs = [] }: TheoryExamManagementProps) {
    const { user } = useAuth();
    const school = 'KISH';
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 출제 상태
    const [content, setContent] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [questionCount, setQuestionCount] = useState('5');
    const [fileName, setFileName] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 퀴즈 결과 및 관리 상태
    const [generatedQuiz, setGeneratedQuiz] = useState<QuizOutput | null>(null);
    const [showAnswers, setShowAnswers] = useState(false);
    const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([]);
    const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
    const [assignments, setAssignments] = useState<QuizAssignment[]>([]);
    const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
    const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
    
    // 모바일 뷰 전환 탭: 'create' (문제 출제), 'quiz' (문제지 확인/편집), 'library' (보관함 및 배포 현황)
    const [mobileTab, setMobileTab] = useState<'create' | 'quiz' | 'library'>('create');
    // 보관함 서브 탭: 'saved' | 'assignments'
    const [librarySubTab, setLibrarySubTab] = useState<'saved' | 'assignments'>('saved');

    // 상세 결과 모달
    const [selectedDetailAssignment, setSelectedDetailAssignment] = useState<QuizAssignment | null>(null);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

    useEffect(() => {
        if (school) {
            fetchSavedQuizzes();
            fetchAssignments();
            fetchResults();
        }
    }, [school]);

    const fetchSavedQuizzes = async () => {
        if (!school) return;
        setIsLoadingQuizzes(true);
        try {
            const data = await getQuizzes(school);
            setSavedQuizzes(data);
        } catch (error) {
            console.error("Failed to fetch quizzes:", error);
        } finally {
            setIsLoadingQuizzes(false);
        }
    };

    const fetchAssignments = async () => {
        if (!school) return;
        setIsLoadingAssignments(true);
        try {
            const data = await getQuizAssignments(school);
            setAssignments(data);
        } catch (error) {
            console.error("Failed to fetch assignments:", error);
        } finally {
            setIsLoadingAssignments(false);
        }
    };

    const fetchResults = async () => {
        if (!school) return;
        try {
            const results = await getQuizResultsBySchool(school);
            setQuizResults(results);
        } catch (error) {
            console.error("Failed to fetch results:", error);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'text/plain') {
                toast({ variant: 'destructive', title: '파일 형식 오류', description: '.txt 형식의 텍스트 파일만 지원합니다.' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                setContent(text);
                setFileName(file.name);
                toast({ title: '파일 로드 완료', description: `'${file.name}' 내용이 입력창에 복사되었습니다.` });
            };
            reader.readAsText(file);
        }
    };

    const handleGenerate = async () => {
        if (!content.trim()) {
            toast({ variant: 'destructive', title: '입력 부족', description: '문제를 생성할 기반 텍스트를 입력해주세요.' });
            return;
        }

        setIsGenerating(true);
        setShowAnswers(false);

        try {
            const result = await generateQuiz({
                content: content.trim(),
                count: parseInt(questionCount)
            });
            setGeneratedQuiz(result);
            // 모바일에서 생성 완료 시 자동으로 문제지 확인 탭으로 전환
            setMobileTab('quiz');
            toast({ title: '퀴즈 생성 완료', description: `${result.questions.length}개의 문제가 생성되었습니다.` });
        } catch (error) {
            console.error("Quiz generation failed:", error);
            toast({ variant: 'destructive', title: '생성 실패', description: 'AI 문제 생성 중 오류가 발생했습니다. 나중에 다시 시도해주세요.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdateQuestion = (index: number, updatedQuestion: QuizQuestion) => {
        if (!generatedQuiz) return;
        const newQuestions = [...generatedQuiz.questions];
        newQuestions[index] = updatedQuestion;
        setGeneratedQuiz({
            ...generatedQuiz,
            questions: newQuestions
        });
    };

    const handleSaveQuiz = async (silent = false) => {
        if (!school || !generatedQuiz) return;
        
        setIsSaving(true);
        try {
            const saved = await saveQuizToDb(school, {
                school,
                title: generatedQuiz.quizTitle,
                content: content,
                questions: generatedQuiz.questions,
                videoUrl: videoUrl.trim()
            });
            if (!silent) {
                toast({ title: '저장 완료', description: '문제지가 라이브러리에 저장되었습니다.' });
            }
            fetchSavedQuizzes();
            return saved;
        } catch (error) {
            console.error("Failed to save quiz:", error);
            if (!silent) toast({ variant: 'destructive', title: '저장 실패' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNewQuiz = () => {
        setGeneratedQuiz(null);
        setContent('');
        setVideoUrl('');
        setFileName(null);
        setShowAnswers(false);
        setMobileTab('create');
    };

    const handleDeleteQuiz = async (id: string) => {
        if (!school) return;
        try {
            await deleteQuiz(school, id);
            toast({ title: '삭제 완료' });
            fetchSavedQuizzes();
        } catch (error) {
            console.error("Failed to delete quiz:", error);
            toast({ variant: 'destructive', title: '삭제 실패' });
        }
    };

    const handleCancelAssignment = async (id: string) => {
        if (!school) return;
        try {
            await deleteQuizAssignment(school, id);
            toast({ title: '배포 취소 완료', description: '해당 배포 내역이 삭제되었습니다.' });
            fetchAssignments();
        } catch (error) {
            console.error("Failed to cancel assignment:", error);
            toast({ variant: 'destructive', title: '배포 취소 실패' });
        }
    };

    const loadSavedQuiz = (quiz: Quiz) => {
        setContent(quiz.content);
        setVideoUrl(quiz.videoUrl || '');
        setFileName(null);
        setGeneratedQuiz({
            quizTitle: quiz.title,
            questions: quiz.questions
        });
        setShowAnswers(false);
        // 불러온 즉시 문제지 확인 탭으로 전환
        setMobileTab('quiz');
        toast({ title: '불러오기 완료', description: `'${quiz.title}' 문제지를 불러왔습니다.` });
    };

    const handleCopy = () => {
        if (!generatedQuiz) return;
        const text = generatedQuiz.questions.map((q, i) => {
            let qText = `${i + 1}. ${q.question}\n`;
            if (q.options && q.options.length > 0) {
                qText += q.options.map((opt, oi) => `   ${oi + 1}) ${opt}`).join('\n') + '\n';
            }
            return qText;
        }).join('\n');
        
        navigator.clipboard.writeText(text);
        toast({ title: '복사 완료', description: '문제 내용이 클립보드에 복사되었습니다.' });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'multiple-choice': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 h-5">4지선다</Badge>;
            case 'short-answer': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5">단답형</Badge>;
            case 'ox': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 h-5">OX</Badge>;
            case 'fill-in-the-blanks': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1.5 py-0 h-5">빈칸</Badge>;
            default: return null;
        }
    };

    const getAssignmentStats = (assignment: QuizAssignment) => {
        const results = quizResults.filter(r => r.assignmentId === assignment.id);
        const uniquePassedIds = new Set(results.filter(r => r.passed).map(r => r.studentId));
        const passCount = uniquePassedIds.size;
        
        let totalCount = 0;
        if (assignment.targetType === 'class') {
            totalCount = allStudents.filter(s => s.grade === assignment.targetGrade && s.classNum === assignment.targetClassNum).length;
        } else if (assignment.targetType === 'grade') {
            totalCount = allStudents.filter(s => s.grade === assignment.targetGrade).length;
        } else if (assignment.targetType === 'school') {
            totalCount = allStudents.length;
        } else {
            const club = sportsClubs.find(c => c.id === assignment.targetClubId);
            totalCount = club?.memberIds.length || 0;
        }
        
        return { passCount, totalCount, results };
    };

    const openDetail = (assignment: QuizAssignment) => {
        setSelectedDetailAssignment(assignment);
        setIsDetailDialogOpen(true);
    };

    // ==========================================
    // 렌더링 세부 뷰 컴포넌트들
    // ==========================================

    // 1. [문제 출제 뷰]
    const renderCreateView = () => (
        <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 space-y-2">
            {/* 상단 라벨 & 파일 첨부 인라인 */}
            <div className="flex items-center justify-between gap-2 shrink-0">
                <Label htmlFor="content-input" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    출제 학습 자료 내용
                </Label>
                
                {/* 텍스트 파일 불러오기 버튼 */}
                <input 
                    ref={fileInputRef}
                    id="file-upload" 
                    type="file" 
                    accept=".txt" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                />
                <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 px-2 text-[11px] font-bold text-slate-600 border-slate-200 hover:bg-slate-50 shrink-0 flex items-center gap-1"
                >
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>{fileName ? '파일 변경' : '.txt 파일'}</span>
                </Button>
            </div>

            {/* 파일 선택 시 컴팩트 알림 배지 */}
            {fileName && (
                <div className="shrink-0 flex items-center justify-between text-[11px] bg-indigo-50/80 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                    <span className="truncate font-medium">선택된 파일: {fileName}</span>
                    <button 
                        onClick={() => { setFileName(null); setContent(''); }}
                        className="text-indigo-500 hover:text-indigo-800 font-bold ml-1 text-xs"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* 메인 텍스트 영역 (남은 공간을 유연하게 채움) */}
            <div className="flex-1 min-h-[120px] sm:min-h-[140px] flex flex-col">
                <Textarea 
                    id="content-input"
                    placeholder="종목의 규칙, 역사, 기술 설명 등 문제를 만들 텍스트를 입력하거나 붙여넣으세요..."
                    className="flex-1 w-full min-h-0 text-xs sm:text-sm resize-none rounded-lg border-slate-200 focus-visible:ring-1 p-2.5 leading-relaxed bg-slate-50/40"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </div>

            {/* 유튜브 URL 인라인 입력 */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                <Youtube className="w-4 h-4 text-red-600 shrink-0 ml-0.5" />
                <Input 
                    id="video-url"
                    placeholder="참고 유튜브 영상 링크 (선택 사항)"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="h-7 text-[11px] sm:text-xs bg-white border-slate-200 flex-1 min-w-0"
                />
            </div>

            {/* 하단 출제 옵션 및 생성 액션 바 (1줄 컴팩트 배치) */}
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
                <div className="w-[85px] sm:w-[100px] shrink-0">
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                        <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5" className="text-xs font-bold">5문항</SelectItem>
                            <SelectItem value="10" className="text-xs font-bold">10문항</SelectItem>
                            <SelectItem value="15" className="text-xs font-bold">15문항</SelectItem>
                            <SelectItem value="20" className="text-xs font-bold">20문항</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button 
                    className="flex-1 h-8 text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-xs rounded-lg flex items-center justify-center gap-1.5"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>AI 문제 생성 중...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>AI 문제 생성하기</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );

    // 2. [문제지 확인 / 편집 뷰]
    const renderQuizView = () => {
        if (!generatedQuiz) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[240px] p-6 text-center bg-white rounded-xl border border-dashed border-slate-300 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">출제된 문제지가 없습니다</h4>
                        <p className="text-xs text-slate-500 max-w-xs">
                            [문제 출제] 탭에서 AI로 새 문제를 생성하거나 [보관함]에서 기존 문제지를 불러오세요.
                        </p>
                    </div>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setMobileTab('create')} 
                        className="h-8 text-xs font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                    >
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        새 문제 출제하기
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                {/* 퀴즈 헤더 & 컴팩트 액션 툴바 (1줄 고정) */}
                <div className="p-2 sm:p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 text-[10px] font-bold px-1.5 h-5 shrink-0">
                            {generatedQuiz.questions.length}문항
                        </Badge>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate" title={generatedQuiz.quizTitle}>
                            {generatedQuiz.quizTitle}
                        </h3>
                    </div>

                    {/* 액션 버튼 그룹 */}
                    <div className="flex items-center gap-1 shrink-0">
                        <DistributeQuizDialog 
                            quiz={generatedQuiz}
                            videoUrl={videoUrl}
                            allStudents={allStudents}
                            sportsClubs={sportsClubs}
                            onDistributed={fetchAssignments}
                            onSaveBeforeDistribute={() => handleSaveQuiz(true)}
                            savedQuizzes={savedQuizzes}
                        />

                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSaveQuiz(false)} 
                            disabled={isSaving}
                            className="h-7 px-2 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 shrink-0"
                            title="문제지 보관함에 저장"
                        >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 sm:mr-1" />}
                            <span className="hidden sm:inline">저장</span>
                        </Button>

                        <Button 
                            variant={showAnswers ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setShowAnswers(!showAnswers)}
                            className={cn(
                                "h-7 px-2 text-xs font-bold shrink-0",
                                showAnswers ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-700 border-slate-200 hover:bg-slate-100"
                            )}
                            title={showAnswers ? "정답 및 해설 숨기기" : "정답 및 해설 확인"}
                        >
                            {showAnswers ? <EyeOff className="h-3.5 w-3.5 sm:mr-1" /> : <Eye className="h-3.5 w-3.5 sm:mr-1" />}
                            <span className="hidden sm:inline">{showAnswers ? '정답숨김' : '정답확인'}</span>
                        </Button>

                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCopy}
                            className="h-7 px-2 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 shrink-0"
                            title="텍스트 클립보드 복사"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>

                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.print()}
                            className="h-7 px-2 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 shrink-0"
                            title="문제지 인쇄"
                        >
                            <Printer className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* 문제 목록 컨테이너 (내부만 매끄럽게 스크롤) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-2.5 overscroll-contain">
                    {generatedQuiz.questions.map((q, idx) => (
                        <div key={idx} className="p-2.5 sm:p-3 rounded-lg border border-slate-200/80 bg-white hover:border-indigo-200 transition-colors space-y-2 shadow-2xs">
                            {/* 질문 헤더 (번호 + 질문 내용 + 유형 배지 + 수정 버튼) */}
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <h4 className="font-bold text-xs sm:text-sm text-slate-800 leading-snug break-normal">
                                        {q.question}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {getTypeBadge(q.type)}
                                    <EditQuestionDialog 
                                        question={q} 
                                        onSave={(updated) => handleUpdateQuestion(idx, updated)} 
                                    />
                                </div>
                            </div>

                            {/* 4지선다 옵션 그리드 */}
                            {q.type === 'multiple-choice' && q.options && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6 sm:pl-7">
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-1.5 text-xs p-1.5 rounded-md border border-slate-100 bg-slate-50/60">
                                            <span className="font-black text-indigo-600 w-3.5 text-[11px]">{oi + 1}.</span>
                                            <span className="text-slate-700 break-normal flex-1">{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 빈칸 채우기 보기 */}
                            {q.type === 'fill-in-the-blanks' && q.options && (
                                <div className="flex flex-wrap gap-1.5 pl-6 sm:pl-7 items-center text-xs">
                                    <span className="text-slate-500 font-bold text-[11px]">[ 보기 ] :</span>
                                    {q.options.map((opt, oi) => (
                                        <Badge key={oi} variant="secondary" className="text-[11px] py-0 font-medium bg-slate-100 text-slate-800 border-slate-200">
                                            {opt}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* OX 선택 버튼 */}
                            {q.type === 'ox' && (
                                <div className="flex gap-2.5 pl-6 sm:pl-7">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-indigo-200 text-sm font-black text-indigo-500 bg-indigo-50/30">O</div>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-rose-200 text-sm font-black text-rose-500 bg-rose-50/30">X</div>
                                </div>
                            )}

                            {/* 정답 및 해설 */}
                            {showAnswers && (
                                <div className="mt-2 p-2 bg-indigo-50/80 border border-indigo-200 rounded-md text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>정답: {q.answer}</span>
                                    </div>
                                    {q.explanation && (
                                        <p className="text-slate-600 text-[11px] leading-relaxed pl-5">
                                            {q.explanation}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // 3. [보관함 & 실시간 배포 현황 뷰]
    const renderLibraryView = () => (
        <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* 세그먼트 탭 헤더 */}
            <div className="p-1 bg-slate-100/80 border-b border-slate-200 shrink-0 flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setLibrarySubTab('saved')}
                    className={cn(
                        "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                        librarySubTab === 'saved'
                            ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/80"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    )}
                >
                    <Library className="w-3.5 h-3.5" />
                    <span>저장된 문제지 ({savedQuizzes.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setLibrarySubTab('assignments')}
                    className={cn(
                        "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                        librarySubTab === 'assignments'
                            ? "bg-white text-emerald-700 shadow-2xs border border-slate-200/80"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    )}
                >
                    <History className="w-3.5 h-3.5" />
                    <span>배포 현황 ({assignments.length})</span>
                </button>
            </div>

            {/* 목록 컨테이너 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
                {librarySubTab === 'saved' ? (
                    isLoadingQuizzes ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
                    ) : savedQuizzes.length > 0 ? (
                        savedQuizzes.map((quiz) => (
                            <div 
                                key={quiz.id} 
                                className="flex items-center justify-between gap-1.5 p-2 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all bg-white group"
                            >
                                <button 
                                    type="button"
                                    onClick={() => loadSavedQuiz(quiz)}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                >
                                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-slate-800 truncate">{quiz.title}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {quiz.questions?.length || 0}문항 • {quiz.createdAt?.toDate ? format(quiz.createdAt.toDate(), 'yy.MM.dd') : '저장됨'}
                                        </div>
                                    </div>
                                </button>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => loadSavedQuiz(quiz)}
                                        className="h-6 px-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                                    >
                                        불러오기
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-destructive hover:bg-rose-50">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-base">문제지 삭제</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs">
                                                    '{quiz.title}' 문제지를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="h-8 text-xs">취소</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteQuiz(quiz.id)} className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    삭제
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-xs text-slate-400 py-10">저장된 문제지가 없습니다.</div>
                    )
                ) : (
                    isLoadingAssignments ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
                    ) : assignments.length > 0 ? (
                        assignments.map((assignment) => {
                            const { passCount, totalCount } = getAssignmentStats(assignment);
                            const targetLabel = assignment.targetType === 'class' ? 
                                `${assignment.targetGrade}학년 ${assignment.targetClassNum}반` : 
                                assignment.targetType === 'grade' ? `${assignment.targetGrade}학년 전체` :
                                assignment.targetType === 'school' ? '학교 전체' :
                                `${assignment.targetClubName}`;

                            return (
                                <div 
                                    key={assignment.id} 
                                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-2xs transition-all space-y-1.5 cursor-pointer"
                                    onClick={() => openDetail(assignment)}
                                >
                                    <div className="flex justify-between items-start gap-1.5">
                                        <div className="min-w-0 flex-1">
                                            <h5 className="font-bold text-xs text-slate-800 truncate">{assignment.quizTitle}</h5>
                                            <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 mt-0.5 px-1 py-0">
                                                {targetLabel}
                                            </Badge>
                                        </div>
                                        
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-slate-400 hover:text-destructive hover:bg-rose-50 shrink-0" 
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-base">배포 취소</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs">
                                                        이 퀴즈의 배포를 취소하시겠습니까? 학생들의 화면에서 즉시 사라집니다.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="h-8 text-xs">취소</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleCancelAssignment(assignment.id)} className="h-8 text-xs bg-destructive text-destructive-foreground">
                                                        배포 취소
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    
                                    <div className="space-y-1 pt-1">
                                        <div className="flex justify-between text-[10px] font-medium text-slate-500">
                                            <span>통과 현황</span>
                                            <span className="font-bold text-emerald-600">{passCount} / {totalCount}명 ({totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0}%)</span>
                                        </div>
                                        <Progress value={totalCount > 0 ? (passCount / totalCount) * 100 : 0} className="h-1 bg-slate-100" />
                                    </div>

                                    <div className="text-[10px] text-slate-400 pt-1 flex justify-between items-center">
                                        <span>배포: {assignment.createdAt?.toDate ? format(assignment.createdAt.toDate(), 'yy.MM.dd HH:mm') : '-'}</span>
                                        <span className="text-indigo-600 font-bold flex items-center text-[10px]">
                                            상세보기 <ChevronRight className="h-3 w-3 inline" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-xs text-slate-400 py-10">현재 배포된 퀴즈가 없습니다.</div>
                    )
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col min-h-0 overflow-hidden space-y-1 sm:space-y-1.5">
            {/* 1. 최상단 컴팩트 툴바 (제목 + 새 퀴즈 버튼 + 모바일 세그먼트 탭) */}
            <div className="bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 shrink-0">
                {/* 제목 및 새 퀴즈 버튼 */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-2xs shrink-0">
                            <BrainCircuit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                        <span className="font-black text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                            AI 이론 평가 문제 생성기
                        </span>
                        <span className="hidden md:inline text-[11px] text-slate-500 font-normal">
                            (체육 학습 자료를 입력하면 AI가 맞춤형 퀴즈를 자동 출제합니다)
                        </span>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNewQuiz} 
                        className="h-6 sm:h-7 px-2 text-xs font-bold text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 shrink-0"
                    >
                        <PlusCircle className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-600" /> 
                        <span>새 퀴즈</span>
                    </Button>
                </div>

                {/* 모바일 세그먼트 탭 바 (lg 미만 화면 전용 - 스크롤 없이 원터치 화면 전환) */}
                <div className="flex lg:hidden items-center bg-slate-100 p-0.5 rounded-lg shrink-0 text-xs">
                    <button
                        type="button"
                        onClick={() => setMobileTab('create')}
                        className={cn(
                            "flex-1 py-1 text-center font-bold rounded-md transition-all flex items-center justify-center gap-1 text-[11px]",
                            mobileTab === 'create' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                        )}
                    >
                        <Sparkles className="w-3 h-3" />
                        <span>문제 출제</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('quiz')}
                        className={cn(
                            "flex-1 py-1 text-center font-bold rounded-md transition-all flex items-center justify-center gap-1 text-[11px]",
                            mobileTab === 'quiz' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                        )}
                    >
                        <FileText className="w-3 h-3" />
                        <span>문제지 확인</span>
                        {generatedQuiz && (
                            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center ml-0.5 font-bold">
                                {generatedQuiz.questions.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('library')}
                        className={cn(
                            "flex-1 py-1 text-center font-bold rounded-md transition-all flex items-center justify-center gap-1 text-[11px]",
                            mobileTab === 'library' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                        )}
                    >
                        <Library className="w-3 h-3" />
                        <span>보관함/현황</span>
                    </button>
                </div>
            </div>

            {/* 2. 메인 바디 영역 */}
            {/* 모바일 화면 (lg:hidden): 선택된 단일 탭만 100% 수납하여 Zero-Scroll 실현 */}
            <div className="flex-1 min-h-0 flex flex-col lg:hidden overflow-hidden">
                {mobileTab === 'create' && renderCreateView()}
                {mobileTab === 'quiz' && renderQuizView()}
                {mobileTab === 'library' && renderLibraryView()}
            </div>

            {/* 데스크톱 화면 (lg:flex): 2패널 (좌: 출제 및 보관함 서브탭 / 우: 생성 문제지 뷰어) */}
            <div className="hidden lg:flex flex-1 min-h-0 gap-2.5 overflow-hidden">
                {/* 좌측 패널 (출제 & 보관함) */}
                <div className="w-[380px] xl:w-[420px] shrink-0 flex flex-col h-full min-h-0 space-y-1.5">
                    {/* 데스크톱 좌측 패널 탭 */}
                    <div className="bg-slate-100 p-0.5 rounded-xl flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setMobileTab('create')}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                                mobileTab === 'create' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>문제 출제</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('library')}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                                mobileTab === 'library' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <Library className="w-3.5 h-3.5" />
                            <span>보관함 및 배포 ({savedQuizzes.length + assignments.length})</span>
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden">
                        {mobileTab === 'create' ? renderCreateView() : renderLibraryView()}
                    </div>
                </div>

                {/* 우측 패널 (문제지 확인 & 편집) */}
                <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
                    {renderQuizView()}
                </div>
            </div>

            {/* 배포 현황 상세 모달 Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-base sm:text-lg">
                            {selectedDetailAssignment?.quizTitle} - 상세 현황
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selectedDetailAssignment?.targetType === 'class' ? 
                                `${selectedDetailAssignment.targetGrade}학년 ${selectedDetailAssignment.targetClassNum}반` : 
                                selectedDetailAssignment?.targetType === 'grade' ? `${selectedDetailAssignment.targetGrade}학년 전체` :
                                selectedDetailAssignment?.targetType === 'school' ? '학교 전체' :
                                `${selectedDetailAssignment?.targetClubName}`}
                            의 평가 응시 및 통과 현황입니다.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-2 space-y-4 overscroll-contain">
                        {selectedDetailAssignment && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                    <Card className="bg-slate-50 border-slate-200">
                                        <CardContent className="p-3 text-center space-y-0.5">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">전체 인원</p>
                                            <p className="text-xl sm:text-2xl font-bold text-slate-800">{getAssignmentStats(selectedDetailAssignment).totalCount}명</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-emerald-50 border-emerald-200">
                                        <CardContent className="p-3 text-center space-y-0.5">
                                            <p className="text-[10px] text-emerald-600 uppercase font-bold">통과 인원</p>
                                            <p className="text-xl sm:text-2xl font-bold text-emerald-700">{getAssignmentStats(selectedDetailAssignment).passCount}명</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-amber-50 border-amber-200">
                                        <CardContent className="p-3 text-center space-y-0.5">
                                            <p className="text-[10px] text-amber-600 uppercase font-bold">미응시/미통과</p>
                                            <p className="text-xl sm:text-2xl font-bold text-amber-700">
                                                {getAssignmentStats(selectedDetailAssignment).totalCount - getAssignmentStats(selectedDetailAssignment).passCount}명
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="text-xs h-8">학년-반</TableHead>
                                                <TableHead className="text-xs h-8">번호</TableHead>
                                                <TableHead className="text-xs h-8">이름</TableHead>
                                                <TableHead className="text-xs h-8">상태</TableHead>
                                                <TableHead className="text-xs h-8">점수</TableHead>
                                                <TableHead className="text-xs h-8">응시일</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const { results } = getAssignmentStats(selectedDetailAssignment);
                                                let targetStudentsList: Student[] = [];
                                                if (selectedDetailAssignment.targetType === 'class') {
                                                    targetStudentsList = allStudents.filter(s => s.grade === selectedDetailAssignment.targetGrade && s.classNum === selectedDetailAssignment.targetClassNum);
                                                } else if (selectedDetailAssignment.targetType === 'grade') {
                                                    targetStudentsList = allStudents.filter(s => s.grade === selectedDetailAssignment.targetGrade);
                                                } else if (selectedDetailAssignment.targetType === 'school') {
                                                    targetStudentsList = allStudents;
                                                } else {
                                                    targetStudentsList = allStudents.filter(s => sportsClubs.find(c => c.id === selectedDetailAssignment.targetClubId)?.memberIds.includes(s.id));
                                                }
                                                
                                                return targetStudentsList.sort((a, b) => {
                                                    if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
                                                    if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
                                                    return parseInt(a.studentNum) - parseInt(b.studentNum);
                                                }).map(student => {
                                                    const result = results.find(r => r.studentId === student.id);
                                                    return (
                                                        <TableRow key={student.id} className="text-xs">
                                                            <TableCell className="py-2">{student.grade}-{student.classNum}</TableCell>
                                                            <TableCell className="py-2">{student.studentNum}</TableCell>
                                                            <TableCell className="py-2 font-medium">{student.name}</TableCell>
                                                            <TableCell className="py-2">
                                                                {result ? (
                                                                    result.passed ? 
                                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] py-0">통과</Badge> : 
                                                                        <Badge variant="destructive" className="text-[10px] py-0">미통과</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-slate-400 text-[10px] py-0">미응시</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                {result ? `${result.score} / ${result.total}` : '-'}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-[10px] text-slate-400">
                                                                {result?.createdAt?.toDate ? format(result.createdAt.toDate(), 'yy.MM.dd HH:mm') : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                });
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter className="shrink-0 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setIsDetailDialogOpen(false)} className="h-8 text-xs font-bold">
                            닫기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @media print {
                    .print-hidden { display: none !important; }
                    header, footer, .sidebar, .tabs-list { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}

function EditQuestionDialog({ question, onSave }: { question: QuizQuestion, onSave: (updated: QuizQuestion) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [edited, setEdited] = useState<QuizQuestion>({ ...question });

    useEffect(() => {
        if (isOpen) setEdited({ ...question });
    }, [isOpen, question]);

    const handleSave = () => {
        onSave(edited);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 print:hidden">
                    <Pencil className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader className="shrink-0 pb-2">
                    <DialogTitle className="text-base">문제 수정</DialogTitle>
                    <DialogDescription className="text-xs">문제 내용과 선택지, 정답을 수정합니다.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 py-2 text-xs overscroll-contain">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">질문</Label>
                        <Textarea 
                            value={edited.question} 
                            onChange={e => setEdited({...edited, question: e.target.value})}
                            className="text-xs resize-none min-h-[60px]"
                        />
                    </div>
                    
                    {edited.options && (
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">선택지 / 보기</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {edited.options.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-400 w-3">{i+1}</span>
                                        <Input 
                                            value={opt} 
                                            onChange={e => {
                                                const newOpts = [...edited.options!];
                                                newOpts[i] = e.target.value;
                                                setEdited({...edited, options: newOpts});
                                            }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">정답</Label>
                            {edited.type === 'ox' ? (
                                <Select value={edited.answer} onValueChange={v => setEdited({...edited, answer: v})}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="O" className="text-xs font-bold">O</SelectItem>
                                        <SelectItem value="X" className="text-xs font-bold">X</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input 
                                    value={edited.answer} 
                                    onChange={e => setEdited({...edited, answer: e.target.value})}
                                    className="h-7 text-xs"
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">유형</Label>
                            <Badge variant="secondary" className="h-7 w-full justify-center text-xs font-bold">
                                {edited.type === 'multiple-choice' ? '4지선다' : 
                                 edited.type === 'short-answer' ? '단답형' :
                                 edited.type === 'ox' ? 'OX' : '빈칸채우기'}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-bold">해설</Label>
                        <Textarea 
                            value={edited.explanation} 
                            onChange={e => setEdited({...edited, explanation: e.target.value})}
                            className="text-xs resize-none min-h-[60px]"
                        />
                    </div>
                </div>
                <DialogFooter className="shrink-0 pt-2 flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" size="sm" className="h-8 text-xs font-bold">취소</Button></DialogClose>
                    <Button onClick={handleSave} size="sm" className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">적용하기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DistributeQuizDialog({ 
    quiz, 
    videoUrl, 
    allStudents, 
    sportsClubs, 
    onDistributed, 
    onSaveBeforeDistribute,
    savedQuizzes 
}: { 
    quiz: QuizOutput, 
    videoUrl: string, 
    allStudents: Student[], 
    sportsClubs: SportsClub[], 
    onDistributed: () => void, 
    onSaveBeforeDistribute: () => Promise<any>,
    savedQuizzes: Quiz[]
}) {
    const { user } = useAuth();
    const school = 'KISH';
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [targetType, setTargetType] = useState<'class' | 'grade' | 'school' | 'club'>('class');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedClassNum, setSelectedClassNum] = useState('');
    const [selectedGrades, setSelectedGrades] = useState<string[]>([]); 
    const [selectedClubId, setSelectedClubId] = useState('');

    const { grades, classNumsByGrade } = useMemo(() => {
        const grades = [...new Set(allStudents.map(s => String(s.grade || '')).filter(Boolean))].sort((a,b) => parseInt(a) - parseInt(b));
        const classNumsByGrade: Record<string, string[]> = {};
        grades.forEach(grade => {
            classNumsByGrade[grade] = [...new Set(allStudents.filter(s => s.grade === grade).map(s => String(s.classNum || '')).filter(Boolean))].sort((a,b) => parseInt(a) - parseInt(b));
        });
        return { grades, classNumsByGrade };
    }, [allStudents]);

    const handleDistribute = async () => {
        if (!school || !quiz) return;
        
        setIsSubmitting(true);
        try {
            // 배포 전 라이브러리에 저장 확인 및 자동 저장
            const isAlreadySaved = savedQuizzes.some(q => q.title === quiz.quizTitle);
            let quizIdToUse = 'temp-' + uuidv4();
            
            if (!isAlreadySaved) {
                const saved = await onSaveBeforeDistribute();
                if (saved && saved.id) quizIdToUse = saved.id;
            }

            const baseAssignment: any = {
                quizId: quizIdToUse, 
                quizTitle: quiz.quizTitle,
                questions: quiz.questions,
                videoUrl: videoUrl.trim(),
                school,
                targetType,
            };

            if (targetType === 'class') {
                if (!selectedGrade || !selectedClassNum) {
                    toast({ variant: 'destructive', title: '대상 미선택', description: '배포할 학년과 반을 선택해주세요.' });
                    setIsSubmitting(false);
                    return;
                }
                await distributeQuiz(school, { ...baseAssignment, targetGrade: selectedGrade, targetClassNum: selectedClassNum });
            } else if (targetType === 'grade') {
                if (selectedGrades.length === 0) {
                    toast({ variant: 'destructive', title: '대상 미선택', description: '배포할 학년을 선택해주세요.' });
                    setIsSubmitting(false);
                    return;
                }
                for (const grade of selectedGrades) {
                    await distributeQuiz(school, { ...baseAssignment, targetGrade: grade });
                }
            } else if (targetType === 'school') {
                await distributeQuiz(school, baseAssignment);
            } else if (targetType === 'club') {
                if (!selectedClubId) {
                    toast({ variant: 'destructive', title: '대상 미선택', description: '배포할 스포츠 클럽을 선택해주세요.' });
                    setIsSubmitting(false);
                    return;
                }
                const club = sportsClubs.find(c => c.id === selectedClubId);
                await distributeQuiz(school, { ...baseAssignment, targetClubId: selectedClubId, targetClubName: club?.name || '알 수 없는 클럽' });
            }

            toast({ title: '배포 및 저장 완료', description: '학생들에게 퀴즈가 전달되었으며, 라이브러리에 자동 저장되었습니다.' });
            onDistributed();
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to distribute quiz:", error);
            toast({ variant: 'destructive', title: '배포 실패' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="h-7 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <Send className="h-3.5 w-3.5 sm:mr-1" />
                    <span>배포</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader className="shrink-0 pb-2">
                    <DialogTitle className="text-base">퀴즈 배포 설정</DialogTitle>
                    <DialogDescription className="text-xs">문제를 풀 대상을 선택해주세요. 배포 시 라이브러리에 자동 저장됩니다.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2 text-xs overscroll-contain">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">배포 대상 유형</Label>
                        <Select value={targetType} onValueChange={(v) => setTargetType(v as any)}>
                            <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="class" className="text-xs font-bold">특정 학급 (학년/반)</SelectItem>
                                <SelectItem value="grade" className="text-xs font-bold">학년 전체 (다중 선택)</SelectItem>
                                <SelectItem value="school" className="text-xs font-bold">학교 전체</SelectItem>
                                <SelectItem value="club" className="text-xs font-bold">스포츠 클럽</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {targetType === 'class' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">학년</Label>
                                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                    <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="학년 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {grades.map(g => <SelectItem key={g} value={g} className="text-xs font-bold">{g}학년</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">반</Label>
                                <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
                                    <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="반 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c} className="text-xs font-bold">{c}반</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {targetType === 'grade' && (
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">배포 학년 선택 (다중 선택)</Label>
                            <div className="grid grid-cols-3 gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                                {grades.map(g => (
                                    <div key={g} className="flex items-center gap-1.5">
                                        <Checkbox 
                                            id={`grade-${g}`} 
                                            checked={selectedGrades.includes(g)}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedGrades([...selectedGrades, g]);
                                                else setSelectedGrades(selectedGrades.filter(sg => sg !== g));
                                            }}
                                        />
                                        <Label htmlFor={`grade-${g}`} className="text-xs cursor-pointer font-bold">{g}학년</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {targetType === 'club' && (
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">스포츠 클럽 선택</Label>
                            <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                                <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="클럽 선택" /></SelectTrigger>
                                <SelectContent>
                                    {sportsClubs.map(club => <SelectItem key={club.id} value={club.id} className="text-xs font-bold">{club.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {targetType === 'school' && (
                        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-bold text-center">
                            우리 학교 전체 학생에게 퀴즈가 배포됩니다.
                        </div>
                    )}
                </div>
                <DialogFooter className="shrink-0 pt-2 flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" size="sm" className="h-8 text-xs font-bold">취소</Button></DialogClose>
                    <Button onClick={handleDistribute} disabled={isSubmitting || !quiz} size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                        지금 배포하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
