'use client';

import { bulkRegisterUsers, getUsersDirectory, saveUserProfile, deleteUser } from '@/lib/services/userService';
import { getDocConfig, saveDocConfig, getOrgStructure, saveOrgStructure, getDelegationRules, saveDelegationRules } from '@/lib/services/settingsService';
import { getAuditLogs } from '@/lib/services/documentService';
import { DocConfig, UserProfile, OrgStructure, DelegationRule } from '@/lib/types';
import { compressImage } from '@/lib/utils';
import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Image as ImageIcon, Users, Settings as SettingsIcon, FileUp, Download, PlusCircle, Save, XCircle, Trash2, Network, FileText } from 'lucide-react';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import * as xlsx from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from '@/hooks/use-auth';

const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];

export function SettingsModal() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const [config, setConfig] = useState<DocConfig>({});
  const [headerPreview, setHeaderPreview] = useState<string>('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHomeroomFile, setSelectedHomeroomFile] = useState<File | null>(null);
  const [selectedDeptFile, setSelectedDeptFile] = useState<File | null>(null);
  const [org, setOrg] = useState<OrgStructure>({ principal: '', vicePrincipal: '', gradeHeads: {}, homerooms: {}, departments: [] });
  const [newHomeroom, setNewHomeroom] = useState({ grade: '1', class: '1', email: '', isGradeHead: false });
  const [newDeptName, setNewDeptName] = useState('');
  // 동명이인 처리용: { grade, class, isHead, candidates: UserProfile[] }
  const [duplicatePendingRows, setDuplicatePendingRows] = useState<{ grade: string; class: string; isHead: boolean; candidates: UserProfile[] }[]>([]);
  const [duplicateResolvedEmails, setDuplicateResolvedEmails] = useState<{ [key: string]: string }>({});
  
  const [delegationRules, setDelegationRules] = useState<DelegationRule[]>([]);
  const [selectedDelegationFile, setSelectedDelegationFile] = useState<File | null>(null);

  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [lastVisibleLog, setLastVisibleLog] = useState<any>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');

  const fetchAuditLogs = async (reset: boolean = true) => {
    if (reset) {
      setLoadingLogs(true);
      const result = await getAuditLogs(50, undefined, logDateFrom || undefined, logDateTo || undefined);
      setAuditLogs(result.logs);
      setLastVisibleLog(result.lastVisible);
      setHasMoreLogs(result.hasMore);
      setLoadingLogs(false);
    } else {
      if (!lastVisibleLog || loadingMoreLogs) return;
      setLoadingMoreLogs(true);
      const result = await getAuditLogs(50, lastVisibleLog, logDateFrom || undefined, logDateTo || undefined);
      setAuditLogs(prev => [...prev, ...result.logs]);
      setLastVisibleLog(result.lastVisible);
      setHasMoreLogs(result.hasMore);
      setLoadingMoreLogs(false);
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      toast({ title: '감사 로그 추출 중...', description: '최대 1만 건의 감사 데이터를 엑셀 파일로 다운로드합니다.' });
      const result = await getAuditLogs(10000, undefined, logDateFrom || undefined, logDateTo || undefined);
      if (result.logs.length === 0) {
        toast({ variant: 'destructive', title: '추출 실패', description: '해당 기간의 감사 로그가 없습니다.' });
        return;
      }
      
      const exportData = result.logs.map(log => ({
        '작업시간': log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '-',
        '구분': log.action === 'create' ? '문서상신' :
               log.action === 'approve' ? '결재승인' :
               log.action === 'reject' ? '결재반려' :
               log.action === 'recall' ? '기안회수' :
               log.action === 'delete' ? '기안삭제' : log.action,
        '행위자 이름': log.actorName,
        '행위자 이메일': log.actorEmail,
        '행위자 직책': log.actorRole,
        '문서번호': log.docNo,
        '문서 제목': log.title,
        '상세내용/코멘트': log.comment || '-'
      }));
      
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, '감사 로그 이력');
      
      const filename = `audit_logs_${logDateFrom || 'all'}_to_${logDateTo || 'all'}.xlsx`;
      xlsx.writeFile(workbook, filename);
      toast({ title: '추출 완료', description: '감사 로그 엑셀 파일이 다운로드되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '추출 오류', description: err.message });
    }
  };
  const [newUser, setNewUser] = useState({ email: '', name: '', role: '교사' });
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const fetchUsers = async () => {
    const data = await getUsersDirectory();
    // 이메일 기준으로 중복 제거 (Map 사용)
    const uniqueUsers = Array.from(new Map(data.map(user => [user.email, user])).values());
    setUsers(uniqueUsers.sort((a,b) => a.name.localeCompare(b.name)));
  };

  useEffect(() => {
    if (isOpen) {
      getDocConfig().then(data => {
        setConfig(data);
        setHeaderPreview(data.headerImage || '');
      });
      getOrgStructure().then(data => {
        setOrg({
          principal: data.principal || '',
          vicePrincipal: data.vicePrincipal || '',
          gradeHeads: data.gradeHeads || {},
          homerooms: data.homerooms || {},
          departments: data.departments || []
        });
      });
      getDelegationRules().then(data => {
        setDelegationRules(data || []);
      });
      fetchUsers();
      fetchAuditLogs();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: name === 'nextNumber' ? parseInt(value) : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setHeaderPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = () => {
    startSaving(async () => {
      let finalConfig = { ...config };
      if (headerPreview && headerPreview !== config.headerImage) {
        finalConfig.headerImage = await compressImage(headerPreview, 600);
      }

      const result = await saveDocConfig(finalConfig);
      if (result.success) {
        toast({ title: '설정 저장됨' });
        setIsOpen(false);
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const handleOrgSave = () => {
    startSaving(async () => {
      const result = await saveOrgStructure(org);
      if (result.success) {
        toast({ title: '조직도 저장됨' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const addDepartment = () => {
    if (!newDeptName.trim()) return;
    const newDept = { id: Date.now().toString(), name: newDeptName.trim(), headEmail: null, memberEmails: [] };
    setOrg(prev => ({ ...prev, departments: [...(prev.departments || []), newDept] }));
    setNewDeptName('');
  };

  const deleteDepartment = (id: string) => {
    setOrg(prev => ({ ...prev, departments: (prev.departments || []).filter(d => d.id !== id) }));
  };

  const updateDeptHead = (deptId: string, email: string) => {
    setOrg(prev => ({ ...prev, departments: (prev.departments || []).map(d => d.id === deptId ? { ...d, headEmail: email } : d) }));
  };

  const addDeptMember = (deptId: string, email: string) => {
    if (!email) return;
    setOrg(prev => ({
      ...prev,
      departments: (prev.departments || []).map(d => {
        if (d.id === deptId && !d.memberEmails.includes(email)) {
          return { ...d, memberEmails: [...d.memberEmails, email] };
        }
        return d;
      })
    }));
  };

  const removeDeptMember = (deptId: string, email: string) => {
    setOrg(prev => ({
      ...prev,
      departments: (prev.departments || []).map(d => d.id === deptId ? { ...d, memberEmails: d.memberEmails.filter(e => e !== email) } : d)
    }));
  };
  
  const handleUserUpdate = async (uid: string, email: string, field: 'role' | 'isAdmin' | 'annualLeaveLimit', value: string | boolean | number) => {
    const result = await saveUserProfile(uid, email, { [field]: value });
    if (result.success) {
      toast({ title: '사용자 정보 업데이트됨' });
      setUsers(prev => prev.map(u => u.email === email ? { ...u, [field]: value } as UserProfile : u));
    } else {
      toast({ variant: 'destructive', title: '업데이트 실패', description: result.error });
    }
  };

  const handleAddNewUser = async () => {
      if (!newUser.email || !newUser.name || !newUser.role) {
          toast({ variant: 'destructive', title: '입력 오류', description: '이메일, 이름, 직책을 모두 입력해야 합니다.' });
          return;
      }
      const result = await saveUserProfile('', newUser.email, newUser as any);
      if (result.success) {
          toast({ title: '사용자 추가됨' });
          fetchUsers(); // Refresh the list
          setIsAddingNewUser(false);
          setNewUser({ email: '', name: '', role: '교사' });
      } else {
          toast({ variant: 'destructive', title: '추가 실패', description: result.error });
      }
  };

  const handleBulkUpload = () => {
    if (!selectedFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.'});
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = async (e) => {
            const fileData = e.target?.result as string;
            const result = await bulkRegisterUsers(fileData);
            if (result.success) {
                toast({ title: '사용자 일괄 등록 성공', description: result.summary });
                fetchUsers();
            } else {
                toast({ variant: 'destructive', title: '일괄 등록 실패', description: result.error, duration: 8000 });
            }
        };
        reader.onerror = (error) => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        }
    });
  }

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
    }
  };
  
  const handleDownloadTemplate = () => {
    const templateData = [
      { email: 'user1@example.com', name: '홍길동', role: '교사' },
      { email: 'user2@example.com', name: '김철수', role: '부장' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '사용자 목록');
    xlsx.writeFile(workbook, 'user_template.xlsx');
  };

  const handleHomeroomFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedHomeroomFile(e.target.files[0]);
    }
  };

  const handleDownloadHomeroomTemplate = () => {
    const templateData = [
      { 학년: 1, 반: 1, 교사이름: '홍길동', 학년부장여부: 'N' },
      { 학년: 1, 반: 2, 교사이름: '김철수', 학년부장여부: 'Y' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '담임 배정');
    xlsx.writeFile(workbook, 'homeroom_template.xlsx');
  };

  const handleHomeroomUpload = () => {
    if (!selectedHomeroomFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.' });
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = xlsx.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet);

                const newHomerooms: { [key: string]: string } = {};
                const newGradeHeads: { [key: string]: string } = { ...org.gradeHeads };
                const duplicates: { grade: string; class: string; isHead: boolean; candidates: UserProfile[] }[] = [];

                json.forEach((row) => {
                    const grade = String(row['학년'] || '').trim();
                    const clazz = String(row['반'] || '').trim();
                    // 이름 기반 매칭: 이름, 교사이름, name 컬럼 지원
                    const teacherName = (row['교사이름'] || row['이름'] || row['name'] || '').trim();
                    // 레거시 이메일 컬럼도 여전히 지원 (이름이 없을 때 폴백)
                    const directEmail = (row['교사이메일'] || row['이메일'] || '').trim().toLowerCase();
                    const isHead = (row['학년부장여부'] || row['부장여부'] || '').trim().toUpperCase() === 'Y';

                    if (!grade || !clazz) return;

                    if (teacherName) {
                        // 이름으로 사용자 목록에서 매칭
                        const matched = users.filter(u => u.name === teacherName);
                        if (matched.length === 1) {
                            const key = `${grade}-${clazz}`;
                            newHomerooms[key] = matched[0].email;
                            if (isHead) newGradeHeads[grade] = matched[0].email;
                        } else if (matched.length > 1) {
                            // 동명이인 → 나중에 수동 선택 필요
                            duplicates.push({ grade, class: clazz, isHead, candidates: matched });
                        } else {
                            toast({ variant: 'destructive', title: `"${teacherName}" 교사를 찾을 수 없음`, description: `${grade}학년 ${clazz}반에 배정된 "${teacherName}"(이)라는 이름의 교사를 찾을 수 없습니다. 사용자 목록을 확인해주세요.` });
                        }
                    } else if (directEmail) {
                        // 레거시: 이메일 직접 지정
                        const key = `${grade}-${clazz}`;
                        newHomerooms[key] = directEmail;
                        if (isHead) newGradeHeads[grade] = directEmail;
                    }
                });

                setOrg(prev => ({
                    ...prev,
                    homerooms: { ...prev.homerooms, ...newHomerooms },
                    gradeHeads: newGradeHeads
                }));

                if (duplicates.length > 0) {
                    setDuplicatePendingRows(duplicates);
                    setDuplicateResolvedEmails({});
                    toast({ title: `동명이인 ${duplicates.length}건 발생`, description: '아래 목록에서 해당 교사를 선택해 주세요.' });
                } else {
                    toast({ title: '담임 배정 일괄 등록 성공', description: `${Object.keys(newHomerooms).length}개의 학급 배정이 설정되었습니다.` });
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
            }
        };
        reader.onerror = () => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        };
        reader.readAsArrayBuffer(selectedHomeroomFile);
    });
  };

  const handleResolveDuplicates = () => {
    const newHomerooms = { ...org.homerooms };
    const newGradeHeads = { ...org.gradeHeads };
    let resolvedCount = 0;
    let missingCount = 0;
    duplicatePendingRows.forEach(row => {
      const key = `${row.grade}-${row.class}`;
      const selectedEmail = duplicateResolvedEmails[key];
      if (selectedEmail) {
        newHomerooms[key] = selectedEmail;
        if (row.isHead) newGradeHeads[row.grade] = selectedEmail;
        resolvedCount++;
      } else {
        missingCount++;
      }
    });
    if (missingCount > 0) {
      toast({ variant: 'destructive', title: '선택 누락', description: `${missingCount}개 반의 교사를 아직 선택하지 않았습니다.` });
      return;
    }
    setOrg(prev => ({ ...prev, homerooms: newHomerooms, gradeHeads: newGradeHeads }));
    setDuplicatePendingRows([]);
    setDuplicateResolvedEmails({});
    toast({ title: '동명이인 처리 완료', description: `${resolvedCount}개 반의 담임 배정이 완료되었습니다.` });
  };

  // 부서 일괄 등록
  const handleDeptFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setSelectedDeptFile(e.target.files[0]);
  };

  const handleDownloadDeptTemplate = () => {
    const templateData = [
      { '부서명': '문예방과후부', '이름': '홍길동', '직책': '부장' },
      { '부서명': '문예방과후부', '이름': '김철수', '직책': '부원' },
      { '부서명': '문예방과후부', '이름': '이영희', '직책': '부원' },
      { '부서명': '체육방과후부', '이름': '이영철', '직책': '부장' },
      { '부서명': '체육방과후부', '이름': '최수진', '직책': '부원' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '부서 목록');
    xlsx.writeFile(workbook, 'department_template.xlsx');
  };

  const handleDeptUpload = () => {
    if (!selectedDeptFile) {
      toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.' });
      return;
    }
    startUploading(async () => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = xlsx.utils.sheet_to_json(worksheet);

          const resolveEmail = (name: string): string | null => {
            if (!name) return null;
            const matched = users.filter(u => u.name === name.trim());
            if (matched.length === 1) return matched[0].email;
            if (matched.length > 1) {
              toast({ variant: 'destructive', title: `"${name}" 동명이인`, description: `"${name}"(이)라는 이름의 사용자가 여러 명입니다. 직접 등록 방식으로 배정하세요.` });
            } else {
              toast({ variant: 'destructive', title: `"${name}" 사용자 없음`, description: `"${name}"(이)라는 이름의 사용자를 찾을 수 없습니다.` });
            }
            return null;
          };

          // 부서명 기준으로 행을 그룹핑 (순서 유지를 위해 Map 사용)
          const deptMap = new Map<string, { headEmail: string | null; memberEmails: string[] }>();
          json.forEach((row) => {
            const deptName = (row['부서명'] || '').trim();
            const name = (row['이름'] || row['name'] || '').trim();
            const role = (row['직책'] || row['역할'] || '').trim();
            if (!deptName || !name) return;

            if (!deptMap.has(deptName)) {
              deptMap.set(deptName, { headEmail: null, memberEmails: [] });
            }
            const entry = deptMap.get(deptName)!;
            const email = resolveEmail(name);
            if (!email) return;

            if (role === '부장') {
              entry.headEmail = email;
            } else {
              // '부원' 또는 그 외 직첩은 모두 부원으로 처리
              if (!entry.memberEmails.includes(email)) {
                entry.memberEmails.push(email);
              }
            }
          });

          const newDepts = Array.from(deptMap.entries()).map(([deptName, entry], i) => ({
            id: Date.now().toString() + i,
            name: deptName,
            headEmail: entry.headEmail,
            memberEmails: entry.memberEmails,
          }));

          setOrg(prev => ({ ...prev, departments: [...(prev.departments || []), ...newDepts] }));
          toast({ title: '부서 일괄 등록 성공', description: `${newDepts.length}개의 부서가 추가되었습니다.` });
        } catch (err: any) {
          toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
        }
      };
      reader.onerror = () => toast({ variant: 'destructive', title: '파일 읽기 오류' });
      reader.readAsArrayBuffer(selectedDeptFile);
    });
  };

  const handleDelegationFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedDelegationFile(e.target.files[0]);
    }
  };

  const handleDownloadDelegationTemplate = () => {
    const templateData = [
      { 대분류: '휴가', 중분류: '연가', 소분류: '연가', 최종결재자: 'PRINCIPAL' },
      { 대분류: '휴가', 중분류: '연가', 소분류: '조퇴', 최종결재자: 'VP' },
      { 대분류: '휴가', 중분류: '연가', 소분류: '지참', 최종결재자: 'VP' },
      { 대분류: '출장', 중분류: '관내', 소분류: '', 최종결재자: 'VP' },
      { 대분류: '출장', 중분류: '관외', 소분류: '', 최종결재자: 'PRINCIPAL' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '위임전결규정');
    xlsx.writeFile(workbook, 'delegation_template.xlsx');
  };

  const handleDelegationUpload = () => {
    if (!selectedDelegationFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.'});
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = xlsx.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet);

                const newRules: DelegationRule[] = json.map((row, index) => ({
                    id: Date.now().toString() + index,
                    mainType: row['대분류'] || '',
                    subType: row['중분류'] || '',
                    detailType: row['소분류'] || '',
                    finalApprover: row['최종결재자'] === 'VP' ? 'VP' : 'PRINCIPAL',
                }));

                const result = await saveDelegationRules(newRules);
                if (result.success) {
                    toast({ title: '전결규정 등록 성공', description: `${newRules.length}개의 규정이 등록되었습니다.` });
                    setDelegationRules(newRules);
                } else {
                    toast({ variant: 'destructive', title: '등록 실패', description: result.error });
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
            }
        };
        reader.onerror = () => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        }
        reader.readAsArrayBuffer(selectedDelegationFile);
    });
  };

  const handleDelegationUpdate = (index: number, field: keyof DelegationRule, value: string) => {
    const newRules = [...delegationRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setDelegationRules(newRules);
  };

  const addDelegationRule = () => {
    setDelegationRules([
      ...delegationRules, 
      { id: Date.now().toString(), mainType: '휴가', subType: '', detailType: '', finalApprover: 'PRINCIPAL' }
    ]);
  };

  const deleteDelegationRule = (index: number) => {
    setDelegationRules(delegationRules.filter((_, i) => i !== index));
  };

  const handleDelegationSave = () => {
    startSaving(async () => {
      const result = await saveDelegationRules(delegationRules);
      if (result.success) {
        toast({ title: '전결규정 저장됨' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const confirmDeleteUser = (user: UserProfile) => {
    if (user.email === profile?.email) {
      toast({ variant: 'destructive', title: '삭제 불가', description: '자기 자신을 삭제할 수 없습니다.' });
      return;
    }
    setUserToDelete(user);
  };

  const executeDelete = async () => {
    if (!userToDelete) return;

    const result = await deleteUser(userToDelete.email);
    if (result.success) {
      toast({ title: '사용자 삭제됨', description: `${userToDelete.name} (${userToDelete.email}) 사용자가 삭제되었습니다.`});
      fetchUsers();
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
    }
    setUserToDelete(null);
  }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
           <Button variant="ghost" size="icon">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b">
          <DialogTitle>시스템 설정</DialogTitle>
          <DialogDescription>
            문서 템플릿, 번호 체계, 사용자 권한을 관리합니다.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="users" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-5 shrink-0 rounded-none border-b bg-muted/30 h-11">
            <TabsTrigger value="general" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><SettingsIcon className="mr-2 h-4 w-4 hidden md:block"/>일반</TabsTrigger>
            <TabsTrigger value="org" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Network className="mr-2 h-4 w-4 hidden md:block"/>조직도</TabsTrigger>
            <TabsTrigger value="delegation" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>전결규정</TabsTrigger>
            <TabsTrigger value="users" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Users className="mr-2 h-4 w-4 hidden md:block"/>사용자</TabsTrigger>
            <TabsTrigger value="audit" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>감사 로그</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="nextNumber">다음 문서 번호</Label>
                  <Input id="nextNumber" name="nextNumber" type="number" value={config.nextNumber || 1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slogan">상단 문구 (슬로건)</Label>
                  <Input id="slogan" name="slogan" value={config.slogan || ''} onChange={handleChange} placeholder="예: 글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교" />
                </div>
                <div className="space-y-2">
                  <Label>헤더 이미지</Label>
                  <div className="p-4 border-2 border-dashed rounded-lg text-center relative group">
                    <Input id="header-up" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <Label htmlFor="header-up" className="cursor-pointer block">
                      {headerPreview ? (
                        <div className="relative h-16 w-full">
                          <NextImage src={headerPreview} alt="헤더 미리보기" layout="fill" objectFit="contain" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white rounded-md">변경</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                          <ImageIcon className="text-muted-foreground" size={24} />
                          <span className="text-sm font-medium text-muted-foreground">헤더 이미지 업로드</span>
                        </div>
                      )}
                    </Label>
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">바닥글 정보</h4>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input id="address" name="address" value={config.address || ''} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">전화번호</Label>
                        <Input id="phone" name="phone" value={config.phone || ''} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fax">팩스</Label>
                        <Input id="fax" name="fax" value={config.fax || ''} onChange={handleChange} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="email">이메일</Label>
                      <Input id="email" name="email" type="email" value={config.email || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="homepage">홈페이지</Label>
                      <Input id="homepage" name="homepage" value={config.homepage || ''} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                일반 설정 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="org" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">학교 리더십</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>학교장 (교장)</Label>
                      <Select value={org.principal} onValueChange={(val) => setOrg({ ...org, principal: val })}>
                        <SelectTrigger><SelectValue placeholder="선택 안됨" /></SelectTrigger>
                        <SelectContent>
                          {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>교감</Label>
                      <Select value={org.vicePrincipal} onValueChange={(val) => setOrg({ ...org, vicePrincipal: val })}>
                        <SelectTrigger><SelectValue placeholder="선택 안됨" /></SelectTrigger>
                        <SelectContent>
                          {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">학급 담임 배정</h4>
                  
                  {/* 담임 배정 일괄 등록 카드 */}
                  <Card className="border shadow-sm bg-muted/20">
                      <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold">담임 배정 일괄 등록</CardTitle>
                          <CardDescription className="text-xs">
                              엑셀 파일(.xlsx)로 여러 반의 담임 및 학년부장 여부를 일괄 등록합니다.
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                          <Input type="file" accept=".xlsx, .xls" onChange={handleHomeroomFileSelect} className="h-9 flex-grow text-xs bg-white"/>
                          <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                              <Button onClick={handleDownloadHomeroomTemplate} variant="outline" size="sm" className="h-9 text-xs">
                                  <Download className="mr-1.5 h-3.5 w-3.5"/>
                                  양식
                              </Button>
                              <Button onClick={handleHomeroomUpload} disabled={isUploading || !selectedHomeroomFile} size="sm" className="h-9 text-xs">
                                  {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                                  업로드
                              </Button>
                          </div>
                      </CardContent>
                  </Card>
                  
                  <div className="flex flex-col md:flex-row gap-3 items-end bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3 md:space-y-0">
                    <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                      <div className="space-y-1.5">
                        <Label className="text-xs">학년</Label>
                        <Input type="number" min="1" max="6" value={newHomeroom.grade} onChange={e => setNewHomeroom({...newHomeroom, grade: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">반</Label>
                        <Input type="number" min="1" max="20" value={newHomeroom.class} onChange={e => setNewHomeroom({...newHomeroom, class: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1.5 flex items-center justify-center pt-5">
                        <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                          <Switch 
                            checked={newHomeroom.isGradeHead}
                            onCheckedChange={(checked) => setNewHomeroom({ ...newHomeroom, isGradeHead: checked })}
                          />
                          <span className="font-semibold text-xs">학년부장</span>
                        </Label>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 flex-1 w-full">
                      <Label className="text-xs">담당 교사</Label>
                      <Select value={newHomeroom.email} onValueChange={(val) => setNewHomeroom({ ...newHomeroom, email: val })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="교사 선택" /></SelectTrigger>
                        <SelectContent>
                          {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => {
                      if (!newHomeroom.email) return toast({ variant: 'destructive', description: '교사를 선택해주세요.'});
                      const key = `${newHomeroom.grade}-${newHomeroom.class}`;
                      const newHomerooms = { ...org.homerooms, [key]: newHomeroom.email };
                      const newGradeHeads = { ...org.gradeHeads };
                      if (newHomeroom.isGradeHead) {
                        newGradeHeads[newHomeroom.grade] = newHomeroom.email;
                      }
                      setOrg({ ...org, homerooms: newHomerooms, gradeHeads: newGradeHeads });
                      setNewHomeroom({ grade: '1', class: '1', email: '', isGradeHead: false });
                    }} className="h-9 w-full md:w-auto font-bold bg-primary hover:bg-primary/90 text-white">추가/변경</Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                    {Object.entries(org.homerooms || {})
                      .sort(([a], [b]) => {
                        const [gA, cA] = a.split('-').map(Number);
                        const [gB, cB] = b.split('-').map(Number);
                        return gA === gB ? cA - cB : gA - gB;
                      })
                      .map(([gradeClass, email]) => {
                        const user = users.find(u => u.email === email);
                        const [grade, clazz] = gradeClass.split('-');
                        const isGradeHead = org.gradeHeads[grade] === email;

                        return (
                          <div key={gradeClass} className="flex flex-col bg-card border p-3 rounded-lg shadow-sm space-y-3 justify-between">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-sm text-gray-900">{grade}학년 {clazz}반</span>
                                <span className="text-xs text-muted-foreground truncate">{user ? user.name : email}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0 hover:bg-red-50 hover:text-red-600 rounded" onClick={() => {
                                const newHomerooms = { ...org.homerooms };
                                delete newHomerooms[gradeClass];
                                const newGradeHeads = { ...org.gradeHeads };
                                if (newGradeHeads[grade] === email) {
                                  delete newGradeHeads[grade];
                                }
                                setOrg({ ...org, homerooms: newHomerooms, gradeHeads: newGradeHeads });
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2 mt-1">
                              <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                                <Switch 
                                  checked={isGradeHead}
                                  onCheckedChange={(checked) => {
                                    const newGradeHeads = { ...org.gradeHeads };
                                    if (checked) {
                                      newGradeHeads[grade] = email;
                                    } else if (newGradeHeads[grade] === email) {
                                      delete newGradeHeads[grade];
                                    }
                                    setOrg({ ...org, gradeHeads: newGradeHeads });
                                  }}
                                />
                                <span className={`text-[11px] font-bold transition-colors ${isGradeHead ? 'text-primary' : 'text-muted-foreground'}`}>학년부장</span>
                              </Label>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>

                {/* 동명이인 처리 UI */}
                {duplicatePendingRows.length > 0 && (
                  <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-amber-800 text-sm">⚠️ 동명이인 발생 — 교사 선택 필요</h5>
                      <span className="text-xs text-amber-600">{duplicatePendingRows.length}건</span>
                    </div>
                    <p className="text-xs text-amber-700">아래 반에 배정하려는 이름의 교사가 여러 명입니다. 정확한 교사를 직접 선택해 주세요.</p>
                    <div className="space-y-2">
                      {duplicatePendingRows.map(row => {
                        const key = `${row.grade}-${row.class}`;
                        return (
                          <div key={key} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2">
                            <span className="text-sm font-bold text-gray-900 shrink-0 w-20">{row.grade}학년 {row.class}반</span>
                            <Select
                              value={duplicateResolvedEmails[key] || ''}
                              onValueChange={(val) => setDuplicateResolvedEmails(prev => ({ ...prev, [key]: val }))}
                            >
                              <SelectTrigger className="h-8 flex-1 text-xs">
                                <SelectValue placeholder="교사를 선택해 주세요" />
                              </SelectTrigger>
                              <SelectContent>
                                {row.candidates.map(c => (
                                  <SelectItem key={c.email} value={c.email}>
                                    {c.name} ({c.email}) — {c.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {row.isHead && (
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">학년부장</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button variant="outline" size="sm" onClick={() => { setDuplicatePendingRows([]); setDuplicateResolvedEmails({}); }}>
                        취소
                      </Button>
                      <Button size="sm" onClick={handleResolveDuplicates} className="bg-amber-600 hover:bg-amber-700 text-white">
                        선택 완료 ({Object.keys(duplicateResolvedEmails).length}/{duplicatePendingRows.length}건)
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">부서 관리</h4>
                  
                  {/* 부서 일괄 등록 카드 */}
                  <Card className="border shadow-sm bg-muted/20">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold">부서 일괄 등록</CardTitle>
                      <CardDescription className="text-xs">
                        엑셀 파일로 부서를 일괄 등록합니다. 한 행에 한 명씩 (부서명 / 이름 / 직책) 입력하세요. 같은 부서명끼리 자동 그룹핑됩니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                      <Input type="file" accept=".xlsx, .xls" onChange={handleDeptFileSelect} className="h-9 flex-grow text-xs bg-white"/>
                      <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                        <Button onClick={handleDownloadDeptTemplate} variant="outline" size="sm" className="h-9 text-xs">
                          <Download className="mr-1.5 h-3.5 w-3.5"/>
                          양식
                        </Button>
                        <Button onClick={handleDeptUpload} disabled={isUploading || !selectedDeptFile} size="sm" className="h-9 text-xs">
                          {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                          업로드
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-2 items-center mb-4">
                    <Input 
                      placeholder="새 부서명 (예: 문예방과후부)" 
                      value={newDeptName} 
                      onChange={e => setNewDeptName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addDepartment()}
                      className="max-w-[300px]"
                    />
                    <Button onClick={addDepartment} variant="secondary">부서 추가</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(org.departments || []).map(dept => (
                      <Card key={dept.id} className="border shadow-sm">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                          <CardTitle className="text-base font-bold">{dept.name}</CardTitle>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteDepartment(dept.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">부장 교사</Label>
                            <Select value={dept.headEmail || ''} onValueChange={(val) => updateDeptHead(dept.id, val)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="부장 선택" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">선택 안됨</SelectItem>
                                {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">부원 배정 (다중 추가 가능)</Label>
                            <div className="flex gap-2">
                              <Select onValueChange={(val) => addDeptMember(dept.id, val)} value="">
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue placeholder="부원 추가..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {dept.memberEmails.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {dept.memberEmails.map(email => {
                                  const u = users.find(user => user.email === email);
                                  return (
                                    <div key={email} className="flex items-center gap-1 bg-secondary/50 text-secondary-foreground text-xs px-2 py-1 rounded-full">
                                      <span className="truncate max-w-[120px]">{u ? u.name : email}</span>
                                      <button onClick={() => removeDeptMember(dept.id, email)} className="text-muted-foreground hover:text-destructive">
                                        <XCircle className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end">
              <Button onClick={handleOrgSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                조직도 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="delegation" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">위임전결규정 일괄 등록</CardTitle>
                    <CardDescription>
                        엑셀 파일로 결재선(전결규정)을 등록합니다. (VP: 교감, PRINCIPAL: 교장)
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleDelegationFileSelect} className="flex-grow"/>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleDownloadDelegationTemplate} variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4"/>
                            양식
                        </Button>
                        <Button onClick={handleDelegationUpload} disabled={isUploading || !selectedDelegationFile} size="sm">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4"/>}
                            업로드
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-semibold">전결규정 목록 ({delegationRules.length})</h3>
                <Button variant="outline" size="sm" onClick={addDelegationRule}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    추가
                </Button>
            </div>

            <div className="border rounded-md flex-1 overflow-y-auto">
              <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                      <TableHead>대분류</TableHead>
                      <TableHead>중분류</TableHead>
                      <TableHead>소분류</TableHead>
                      <TableHead>최종결재</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {delegationRules.map((rule, index) => (
                  <TableRow key={rule.id}>
                      <TableCell>
                        <Input value={rule.mainType} onChange={e => handleDelegationUpdate(index, 'mainType', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input value={rule.subType} onChange={e => handleDelegationUpdate(index, 'subType', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input value={rule.detailType} onChange={e => handleDelegationUpdate(index, 'detailType', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Select value={rule.finalApprover} onValueChange={(val) => handleDelegationUpdate(index, 'finalApprover', val)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VP">교감 (전결)</SelectItem>
                                <SelectItem value="PRINCIPAL">교장 (결재)</SelectItem>
                            </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => deleteDelegationRule(index)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </TableCell>
                  </TableRow>
                  ))}
                  </TableBody>
              </Table>
            </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end">
              <Button onClick={handleDelegationSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                전결규정 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="users" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              <Card>
                  <CardHeader className="pb-3">
                      <CardTitle className="text-lg">사용자 일괄 등록</CardTitle>
                      <CardDescription>
                         엑셀 파일로 사용자를 추가하거나 업데이트합니다.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                      <Input type="file" accept=".xlsx, .xls" onChange={onFileSelect} className="flex-grow"/>
                      <div className="flex gap-2 w-full sm:w-auto">
                          <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                              <Download className="mr-2 h-4 w-4"/>
                              양식
                          </Button>
                          <Button onClick={handleBulkUpload} disabled={isUploading || !selectedFile} size="sm">
                              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4"/>}
                              업로드
                          </Button>
                      </div>
                  </CardContent>
              </Card>

              <div className="flex justify-between items-center px-1">
                  <h3 className="text-lg font-semibold">사용자 목록 ({users.length})</h3>
                  {!isAddingNewUser && (
                      <Button variant="outline" size="sm" onClick={() => setIsAddingNewUser(true)}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          추가
                      </Button>
                  )}
              </div>

              <div className="border rounded-md flex-1 overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead>사용자</TableHead>
                        <TableHead className="w-[130px]">직책</TableHead>
                        <TableHead className="w-[90px] text-center">연가(일)</TableHead>
                        <TableHead className="w-[100px]">관리자</TableHead>
                        <TableHead className="w-[70px] text-right">관리</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isAddingNewUser && (
                        <TableRow className="bg-muted/50">
                            <TableCell className="flex flex-col gap-2">
                            <Input 
                                placeholder="이름" 
                                value={newUser.name}
                                onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
                                className="h-8"
                            />
                            <Input 
                                placeholder="이메일" 
                                value={newUser.email} 
                                onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
                                className="h-8"
                            />
                            </TableCell>
                            <TableCell className="align-top pt-3">
                                <Select value={newUser.role} onValueChange={(r) => setNewUser(p => ({ ...p, role: r }))}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell className="align-top pt-3"></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right align-top pt-3">
                                <div className="flex justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddNewUser}><Save className="h-4 w-4 text-primary"/></Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsAddingNewUser(false)}><XCircle className="h-4 w-4 text-muted-foreground"/></Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                    {users.map(user => (
                    <TableRow key={user.email}>
                        <TableCell>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                        <Select 
                            value={user.role} 
                            onValueChange={(newRole) => handleUserUpdate(user.uid, user.email, 'role', newRole)}
                            >
                            <SelectTrigger className="h-8">
                                <SelectValue placeholder="직책" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="text-center">
                            <Input
                                type="number"
                                min={1}
                                max={30}
                                className="h-8 w-16 text-center mx-auto"
                                value={user.annualLeaveLimit ?? 21}
                                onChange={async (e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val > 0) {
                                        await handleUserUpdate(user.uid, user.email, 'annualLeaveLimit', val);
                                    }
                                }}
                            />
                        </TableCell>
                        <TableCell>
                            <Switch 
                                id={`admin-${user.email}`} 
                                checked={user.isAdmin}
                                onCheckedChange={(checked) => handleUserUpdate(user.uid, user.email, 'isAdmin', checked)}
                                disabled={user.email === 'beside1s@kshcm.net'} // 슈퍼 관리자 보호
                            />
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => confirmDeleteUser(user)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                    </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <div>
                <h3 className="text-lg font-semibold">시스템 감사 로그 (최근 100건)</h3>
                <p className="text-xs text-muted-foreground">누가, 언제, 어떤 문서에 대해 결재 관련 작업을 처리했는지 상세 이력을 조회합니다.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchAuditLogs()} disabled={loadingLogs}>
                {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                새로고침
              </Button>
            </div>

            <div className="border rounded-md flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[120px]">시간</TableHead>
                    <TableHead className="w-[80px]">액션</TableHead>
                    <TableHead>행위자</TableHead>
                    <TableHead className="w-[120px]">문서번호</TableHead>
                    <TableHead>문서 제목</TableHead>
                    <TableHead>상세/코멘트</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        감사 로그를 로딩 중입니다...
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        기록된 감사 로그가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => {
                      const getActionBadge = (act: string) => {
                        switch (act) {
                          case 'create': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">문서상신</span>;
                          case 'approve': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">결재승인</span>;
                          case 'reject': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">결재반려</span>;
                          case 'recall': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">기안회수</span>;
                          case 'delete': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800">기안삭제</span>;
                          default: return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">{act}</span>;
                        }
                      };

                      const formatDate = (isoStr: string) => {
                        if (!isoStr) return '-';
                        try {
                          const d = new Date(isoStr);
                          return `${d.getFullYear().toString().substring(2)}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        } catch {
                          return isoStr;
                        }
                      };

                      return (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="font-mono text-muted-foreground">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{log.actorName}</div>
                            <div className="text-[10px] text-muted-foreground">{log.actorEmail}</div>
                          </TableCell>
                          <TableCell className="font-mono">{log.docNo || '-'}</TableCell>
                          <TableCell className="max-w-[180px] truncate" title={log.title}>{log.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground" title={log.comment}>{log.comment || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {hasMoreLogs && !loadingLogs && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(false)} disabled={loadingMoreLogs} className="px-8 h-8 text-xs">
                  {loadingMoreLogs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  감사 로그 더 보기 (50건씩)
                </Button>
              </div>
            )}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    <span className="font-bold text-foreground">{userToDelete?.name}</span> ({userToDelete?.email}) 사용자를 삭제합니다.<br/>
                    이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUserToDelete(null)}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
