
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrainCircuit, FileText, Loader2, Sparkles, Printer, Copy, CheckCircle2, Save, Library, Trash2, Pencil, Send, History, ChevronRight, Youtube, PlusCircle } from "lucide-react";
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

interface TheoryExamManagementProps {
    allStudents?: Student[];
    sportsClubs?: SportsClub[];
}

export default function TheoryExamManagement({ allStudents = [], sportsClubs = [] }: TheoryExamManagementProps) {
    const { user } = useAuth(); const school = 'KISH';
    const { toast } = useToast();
    const [content, setContent] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [questionCount, setQuestionCount] = useState('5');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedQuiz, setGeneratedQuiz] = useState<QuizOutput | null>(null);
    const [showAnswers, setShowAnswers] = useState(false);
    const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([]);
    const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
    const [assignments, setAssignments] = useState<QuizAssignment[]>([]);
    const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
    const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
    
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
                toast({ title: '파일 로드 완료', description: '텍스트 파일의 내용이 입력창에 복사되었습니다.' });
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
        setGeneratedQuiz(null);
        setShowAnswers(false);

        try {
            const result = await generateQuiz({
                content: content.trim(),
                count: parseInt(questionCount)
            });
            setGeneratedQuiz(result);
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
        setShowAnswers(false);
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
        setGeneratedQuiz({
            quizTitle: quiz.title,
            questions: quiz.questions
        });
        setShowAnswers(false);
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
            case 'multiple-choice': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">4지선다</Badge>;
            case 'short-answer': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">단답형</Badge>;
            case 'ox': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">OX형</Badge>;
            case 'fill-in-the-blanks': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">빈칸채우기</Badge>;
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
    }

    const openDetail = (assignment: QuizAssignment) => {
        setSelectedDetailAssignment(assignment);
        setIsDetailDialogOpen(true);
    };

    return (
        <Card className="bg-transparent shadow-none border-none">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                            <BrainCircuit className="h-6 w-6 text-primary" />
                            AI 이론 평가 문제 생성기
                        </CardTitle>
                        <CardDescription>
                            체육 학습 자료를 입력하면 AI가 자동으로 퀴즈를 만들어줍니다. 생성 후 개별 문항을 수정할 수 있습니다.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleNewQuiz} className="font-bold">
                        <PlusCircle className="mr-2 h-4 w-4" /> 새 퀴즈 작성
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Section: Inputs & Library */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">출제 설정</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="content-input">학습 자료 내용</Label>
                                    <Textarea 
                                        id="content-input"
                                        placeholder="종목의 규칙, 역사, 기술 설명 등 문제를 만들 텍스트를 이곳에 붙여넣으세요..."
                                        className="min-h-[200px] resize-none"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="file-upload">파일에서 가져오기 (.txt)</Label>
                                    <Input 
                                        id="file-upload" 
                                        type="file" 
                                        accept=".txt"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="video-url" className="flex items-center gap-1">
                                        <Youtube className="h-4 w-4 text-red-600" /> 참고 영상 URL
                                    </Label>
                                    <Input 
                                        id="video-url"
                                        placeholder="학생들이 시청할 유튜브 링크 (선택)"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>출제 문항 수</Label>
                                    <Select value={questionCount} onValueChange={setQuestionCount}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5문항</SelectItem>
                                            <SelectItem value="10">10문항</SelectItem>
                                            <SelectItem value="15">15문항</SelectItem>
                                            <SelectItem value="20">20문항</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button 
                                    className="w-full py-6 text-lg font-bold" 
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 생성 중...</>
                                    ) : (
                                        <><Sparkles className="mr-2 h-5 w-5" /> AI 문제 생성하기</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Library className="h-5 w-5 text-primary" />
                                    저장된 문제지 목록
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[300px] overflow-y-auto pr-2">
                                {isLoadingQuizzes ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
                                ) : savedQuizzes.length > 0 ? (
                                    <div className="space-y-2">
                                        {savedQuizzes.map((quiz) => (
                                            <div key={quiz.id} className="flex items-center gap-2 group p-2 rounded-md hover:bg-secondary/50 border border-transparent hover:border-border transition-all">
                                                <Button 
                                                    variant="ghost" 
                                                    className="flex-1 justify-start text-left truncate"
                                                    onClick={() => loadSavedQuiz(quiz)}
                                                >
                                                    <FileText className="h-4 w-4 mr-2 shrink-0" />
                                                    <span className="truncate">{quiz.title}</span>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>문제지 삭제</AlertDialogTitle>
                                                            <AlertDialogDescription>이 문제지를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>취소</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteQuiz(quiz.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-muted-foreground py-8">저장된 문제지가 없습니다.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="h-5 w-5 text-green-600" />
                                    실시간 배포 현황
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[400px] overflow-y-auto pr-2">
                                {isLoadingAssignments ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
                                ) : assignments.length > 0 ? (
                                    <div className="space-y-3">
                                        {assignments.map((assignment) => {
                                            const { passCount, totalCount } = getAssignmentStats(assignment);
                                            const targetLabel = assignment.targetType === 'class' ? 
                                                `${assignment.targetGrade}학년 ${assignment.targetClassNum}반` : 
                                                assignment.targetType === 'grade' ? `${assignment.targetGrade}학년 전체` :
                                                assignment.targetType === 'school' ? '학교 전체' :
                                                `${assignment.targetClubName}`;

                                            return (
                                                <div key={assignment.id} className="p-3 rounded-lg border bg-background/50 space-y-2 relative group hover:border-primary/50 cursor-pointer transition-all" onClick={() => openDetail(assignment)}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="pr-8">
                                                            <h5 className="font-bold text-sm truncate">{assignment.quizTitle}</h5>
                                                            <p className="text-xs text-muted-foreground">
                                                                {targetLabel}
                                                            </p>
                                                        </div>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>배포 취소</AlertDialogTitle>
                                                                    <AlertDialogDescription>이 퀴즈의 배포를 취소하시겠습니까? 학생들의 화면에서 즉시 사라집니다.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleCancelAssignment(assignment.id)} className="bg-destructive text-destructive-foreground">배포 취소</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px] font-medium">
                                                            <span>평가 통과 현황</span>
                                                            <span className="text-primary">{passCount} / {totalCount} 통과</span>
                                                        </div>
                                                        <Progress value={totalCount > 0 ? (passCount / totalCount) * 100 : 0} className="h-1.5" />
                                                    </div>

                                                    <div className="text-[10px] text-muted-foreground pt-1 border-t flex justify-between">
                                                        <span>배포일: {assignment.createdAt?.toDate ? format(assignment.createdAt.toDate(), 'yy-MM-dd HH:mm') : '-'}</span>
                                                        <ChevronRight className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-muted-foreground py-8">현재 배포된 퀴즈가 없습니다.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Section: Result Display */}
                    <div className="lg:col-span-2">
                        {generatedQuiz ? (
                            <Card className="h-full border-2 border-primary/20">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl">{generatedQuiz.quizTitle}</CardTitle>
                                        <CardDescription>{generatedQuiz.questions.length}개의 문제가 출제되었습니다.</CardDescription>
                                    </div>
                                    <div className="flex gap-2 print:hidden flex-wrap justify-end">
                                        <DistributeQuizDialog 
                                            quiz={generatedQuiz}
                                            videoUrl={videoUrl}
                                            allStudents={allStudents}
                                            sportsClubs={sportsClubs}
                                            onDistributed={fetchAssignments}
                                            onSaveBeforeDistribute={() => handleSaveQuiz(true)}
                                            savedQuizzes={savedQuizzes}
                                        />
                                        <Button variant="outline" size="sm" onClick={() => handleSaveQuiz(false)} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                            저장
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setShowAnswers(!showAnswers)}>
                                            {showAnswers ? '정답 숨기기' : '정답 확인'}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleCopy}>
                                            <Copy className="h-4 w-4 mr-1" /> 복사
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                                            <Printer className="h-4 w-4 mr-1" /> 인쇄
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-8 max-h-[700px] overflow-y-auto pr-4">
                                    {generatedQuiz.questions.map((q, idx) => (
                                        <div key={idx} className="space-y-3 p-4 rounded-lg bg-secondary/20 relative group">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <h4 className="font-semibold text-lg">{q.question}</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getTypeBadge(q.type)}
                                                    <EditQuestionDialog 
                                                        question={q} 
                                                        onSave={(updated) => handleUpdateQuestion(idx, updated)} 
                                                    />
                                                </div>
                                            </div>

                                            {q.type === 'multiple-choice' && q.options && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                                                    {q.options.map((opt, oi) => (
                                                        <div key={oi} className="flex items-center gap-2 text-sm p-2 rounded border bg-background">
                                                            <span className="font-bold text-primary">{oi + 1}.</span> {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === 'fill-in-the-blanks' && q.options && (
                                                <div className="flex wrap gap-2 pl-8 items-center text-sm">
                                                    <span className="text-muted-foreground font-medium">[ 보기 ] : </span>
                                                    {q.options.map((opt, oi) => (
                                                        <Badge key={oi} variant="secondary">{opt}</Badge>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === 'ox' && (
                                                <div className="flex gap-4 pl-8">
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-primary/30 text-2xl font-bold text-primary opacity-50">O</div>
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-destructive/30 text-2xl font-bold text-destructive opacity-50">X</div>
                                                </div>
                                            )}

                                            {showAnswers && (
                                                <div className="mt-4 p-3 bg-primary/5 border-l-4 border-primary rounded animate-in fade-in slide-in-from-left-2">
                                                    <div className="flex items-center gap-2 text-primary font-bold mb-1">
                                                        <CheckCircle2 className="h-4 w-4" /> 정답: {q.answer}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </CardContent>

            {/* Assignment Detail Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{selectedDetailAssignment?.quizTitle} - 상세 현황</DialogTitle>
                        <DialogDescription>
                            {selectedDetailAssignment?.targetType === 'class' ? 
                                `${selectedDetailAssignment.targetGrade}학년 ${selectedDetailAssignment.targetClassNum}반` : 
                                selectedDetailAssignment?.targetType === 'grade' ? `${selectedDetailAssignment.targetGrade}학년 전체` :
                                selectedDetailAssignment?.targetType === 'school' ? '학교 전체' :
                                `${selectedDetailAssignment?.targetClubName}`}
                            의 평가 응시 및 통과 현황입니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 py-4">
                        {selectedDetailAssignment && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-primary/5">
                                        <CardContent className="p-4 text-center space-y-1">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">전체 인원</p>
                                            <p className="text-3xl font-bold">{getAssignmentStats(selectedDetailAssignment).totalCount}명</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-green-50">
                                        <CardContent className="p-4 text-center space-y-1">
                                            <p className="text-xs text-green-600 uppercase font-bold">통과 인원</p>
                                            <p className="text-3xl font-bold text-green-700">{getAssignmentStats(selectedDetailAssignment).passCount}명</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-orange-50">
                                        <CardContent className="p-4 text-center space-y-1">
                                            <p className="text-xs text-orange-600 uppercase font-bold">미응시/미통과</p>
                                            <p className="text-3xl font-bold text-orange-700">
                                                {getAssignmentStats(selectedDetailAssignment).totalCount - getAssignmentStats(selectedDetailAssignment).passCount}명
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>학년-반</TableHead>
                                                <TableHead>번호</TableHead>
                                                <TableHead>이름</TableHead>
                                                <TableHead>상태</TableHead>
                                                <TableHead>점수</TableHead>
                                                <TableHead>응시일</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const { results } = getAssignmentStats(selectedDetailAssignment);
                                                let targetStudentsList = [];
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
                                                        <TableRow key={student.id}>
                                                            <TableCell>{student.grade}-{student.classNum}</TableCell>
                                                            <TableCell>{student.studentNum}</TableCell>
                                                            <TableCell className="font-medium">{student.name}</TableCell>
                                                            <TableCell>
                                                                {result ? (
                                                                    result.passed ? 
                                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">통과</Badge> : 
                                                                        <Badge variant="destructive">미통과</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-muted-foreground">미응시</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {result ? `${result.score} / ${result.total}` : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {result?.createdAt?.toDate ? format(result.createdAt.toDate(), 'yy-MM-dd HH:mm') : '-'}
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @media print {
                    .print-hidden { display: none !important; }
                    header, footer, .sidebar, .tabs-list { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                    .max-h-[700px] { max-height: none !important; overflow: visible !important; }
                }
            `}</style>
        </Card>
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
                <Button variant="ghost" size="icon" className="h-8 w-8 print:hidden">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>문제 수정</DialogTitle>
                    <DialogDescription>문제 내용과 선택지, 정답을 수정합니다.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>질문</Label>
                        <Textarea 
                            value={edited.question} 
                            onChange={e => setEdited({...edited, question: e.target.value})}
                        />
                    </div>
                    
                    {edited.options && (
                        <div className="space-y-2">
                            <Label>선택지 / 보기</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {edited.options.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground w-4">{i+1}</span>
                                        <Input 
                                            value={opt} 
                                            onChange={e => {
                                                const newOpts = [...edited.options!];
                                                newOpts[i] = e.target.value;
                                                setEdited({...edited, options: newOpts});
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>정답</Label>
                            {edited.type === 'ox' ? (
                                <Select value={edited.answer} onValueChange={v => setEdited({...edited, answer: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="O">O</SelectItem>
                                        <SelectItem value="X">X</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input 
                                    value={edited.answer} 
                                    onChange={e => setEdited({...edited, answer: e.target.value})}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>유형</Label>
                            <Badge variant="secondary" className="h-10 w-full justify-center">
                                {edited.type === 'multiple-choice' ? '4지선다' : 
                                 edited.type === 'short-answer' ? '단답형' :
                                 edited.type === 'ox' ? 'OX형' : '빈칸채우기'}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>해설</Label>
                        <Textarea 
                            value={edited.explanation} 
                            onChange={e => setEdited({...edited, explanation: e.target.value})}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
                    <Button onClick={handleSave}>적용하기</Button>
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
    const { user } = useAuth(); const school = 'KISH';
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
            // 1. 배포 전 라이브러리에 저장되어 있는지 확인하고 없으면 자동 저장
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
                <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                    <Send className="h-4 w-4 mr-1" /> 배포
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>퀴즈 배포 설정</DialogTitle>
                    <DialogDescription>문제를 풀 대상을 선택해주세요. 배포 시 자동으로 라이브러리에 저장됩니다.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>배포 대상 유형</Label>
                        <Select value={targetType} onValueChange={(v) => setTargetType(v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="class">특정 학급 (학년/반)</SelectItem>
                                <SelectItem value="grade">학년 전체 (다중 선택)</SelectItem>
                                <SelectItem value="school">학교 전체</SelectItem>
                                <SelectItem value="club">스포츠 클럽</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {targetType === 'class' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>학년</Label>
                                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                    <SelectTrigger><SelectValue placeholder="학년 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>반</Label>
                                <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
                                    <SelectTrigger><SelectValue placeholder="반 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {targetType === 'grade' && (
                        <div className="space-y-2">
                            <Label>배포 학년 선택 (다중 선택 가능)</Label>
                            <div className="grid grid-cols-3 gap-2 p-2 border rounded-md">
                                {grades.map(g => (
                                    <div key={g} className="flex items-center gap-2">
                                        <Checkbox 
                                            id={`grade-${g}`} 
                                            checked={selectedGrades.includes(g)}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedGrades([...selectedGrades, g]);
                                                else setSelectedGrades(selectedGrades.filter(sg => sg !== g));
                                            }}
                                        />
                                        <Label htmlFor={`grade-${g}`} className="cursor-pointer">{g}학년</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {targetType === 'club' && (
                        <div className="space-y-2">
                            <Label>스포츠 클럽 선택</Label>
                            <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                                <SelectTrigger><SelectValue placeholder="클럽 선택" /></SelectTrigger>
                                <SelectContent>
                                    {sportsClubs.map(club => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {targetType === 'school' && (
                        <div className="p-4 bg-primary/5 border rounded-md text-sm text-primary font-medium text-center">
                            우리 학교 전체 학생에게 퀴즈가 배포됩니다.
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
                    <Button onClick={handleDistribute} disabled={isSubmitting || !quiz}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                        지금 배포하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
