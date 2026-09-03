import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { DepartmentTask, TaskSubmission } from '@/lib/types';

function getTasksCol() {
  return collection(getDb(), 'department_tasks');
}

function cleanUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc: any, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value);
      }
      return acc;
    }, {});
  }
  return obj;
}

/**
 * 실시간 전체 부서 업무 구독
 */
export function onDepartmentTasksUpdate(callback: (tasks: DepartmentTask[]) => void): () => void {
  const q = query(getTasksCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback([]);
      return;
    }
    const list = snap.docs.map(d => ({
      id: d.id,
      submissions: {},
      targetEmails: [],
      ...(d.data() as any)
    } as DepartmentTask));
    callback(list);
  }, (err) => {
    console.warn('[DepartmentTaskService] onDepartmentTasksUpdate error:', err);
    callback([]);
  });
}

/**
 * 새 부서/학년/그룹 업무 생성
 */
export async function createDepartmentTask(
  payload: Omit<DepartmentTask, 'id' | 'createdAt' | 'updatedAt' | 'submissions'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const taskId = `dept_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(getTasksCol(), taskId);
    const now = new Date().toISOString();

    const taskData: DepartmentTask = {
      ...payload,
      id: taskId,
      submissions: {},
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, cleanUndefined(taskData));
    return { success: true, id: taskId };
  } catch (error: any) {
    console.error('[DepartmentTaskService] createDepartmentTask error:', error);
    return { success: false, error: error.message || '업무 생성에 실패했습니다.' };
  }
}

/**
 * 업무 파일 업로드 (Firebase Storage)
 */
export async function uploadTaskSubmissionFile(
  taskId: string, 
  email: string, 
  file: File
): Promise<{ success: boolean; fileUrl?: string; fileName?: string; error?: string }> {
  try {
    const storage = getStorage(getDb().app, 'gs://studio-9153973571-7837c.firebasestorage.app');
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const fileRef = ref(storage, `department_tasks/${taskId}/${safeEmail}_${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(fileRef);
    return {
      success: true,
      fileUrl: downloadUrl,
      fileName: file.name
    };
  } catch (error: any) {
    console.error('[DepartmentTaskService] uploadTaskSubmissionFile error:', error);
    return { success: false, error: error.message || '파일 업로드에 실패했습니다.' };
  }
}

/**
 * 업무 제출 (부서원/수신자 액션)
 */
export async function submitDepartmentTaskResponse(
  taskId: string,
  submission: TaskSubmission
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: '존재하지 않는 업무입니다.' };
    }
    const data = snap.data() as DepartmentTask;
    const emailKey = submission.submitterEmail.toLowerCase();
    // 학년이 지정된 경우 학년별 키로도 고유 저장 지원
    const submissionKey = submission.grade ? `${emailKey}_${submission.grade}` : emailKey;

    const updatedSubmissions = {
      ...(data.submissions || {}),
      [submissionKey]: submission,
      // 하위 호환성을 위해 기본 이메일 키도 유지
      [emailKey]: submission,
    };

    await setDoc(docRef, cleanUndefined({
      submissions: updatedSubmissions,
      updatedAt: new Date().toISOString()
    }), { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('[DepartmentTaskService] submitDepartmentTaskResponse error:', error);
    return { success: false, error: error.message || '제출 처리에 실패했습니다.' };
  }
}

/**
 * 개별 제출 내역 삭제/초기화 (중복이나 잘못된 제출 취소)
 */
export async function deleteDepartmentTaskSubmission(
  taskId: string,
  submissionKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: '존재하지 않는 업무입니다.' };
    }
    const data = snap.data() as DepartmentTask;
    const updatedSubmissions = { ...(data.submissions || {}) };
    const lowerKey = submissionKey.toLowerCase().trim();

    // 1. 키 직접 매칭 삭제
    delete updatedSubmissions[lowerKey];

    // 2. 이메일 및 학년 연관 키 모두 탐색하여 삭제
    Object.keys(updatedSubmissions).forEach(k => {
      const sub = updatedSubmissions[k];
      if (
        k.toLowerCase() === lowerKey ||
        k.toLowerCase().startsWith(`${lowerKey}_`) ||
        k.toLowerCase().endsWith(`_${lowerKey}`) ||
        (sub && sub.submitterEmail?.toLowerCase() === lowerKey) ||
        (sub && String(sub.grade) === lowerKey)
      ) {
        delete updatedSubmissions[k];
      }
    });

    await setDoc(docRef, cleanUndefined({
      submissions: updatedSubmissions,
      updatedAt: new Date().toISOString()
    }), { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('[DepartmentTaskService] deleteDepartmentTaskSubmission error:', error);
    return { success: false, error: error.message || '제출 내역 삭제에 실패했습니다.' };
  }
}

/**
 * 개별 제출 내역 수정 (관리자 / 작성자 수정)
 */
export async function updateDepartmentTaskSubmission(
  taskId: string,
  submissionKey: string,
  updatedData: Partial<TaskSubmission>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: '존재하지 않는 업무입니다.' };
    }
    const data = snap.data() as DepartmentTask;
    const updatedSubmissions = { ...(data.submissions || {}) };
    const lowerKey = submissionKey.toLowerCase().trim();

    const existing = updatedSubmissions[lowerKey] || Object.values(updatedSubmissions).find(
      s => s.submitterEmail?.toLowerCase() === lowerKey || String(s.grade) === lowerKey
    ) || {
      submitterEmail: lowerKey,
      submitterName: '교직원',
      submittedAt: new Date().toISOString(),
      status: 'submitted'
    };

    const mergedSubmission: TaskSubmission = {
      ...existing,
      ...updatedData,
      submittedAt: new Date().toISOString(),
    };

    updatedSubmissions[lowerKey] = mergedSubmission;
    if (mergedSubmission.grade) {
      const emailOnly = mergedSubmission.submitterEmail.toLowerCase();
      updatedSubmissions[`${emailOnly}_${mergedSubmission.grade}`] = mergedSubmission;
      updatedSubmissions[emailOnly] = mergedSubmission;
    }

    await setDoc(docRef, cleanUndefined({
      submissions: updatedSubmissions,
      updatedAt: new Date().toISOString()
    }), { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('[DepartmentTaskService] updateDepartmentTaskSubmission error:', error);
    return { success: false, error: error.message || '제출 내역 수정에 실패했습니다.' };
  }
}

/**
 * 업무 위임 / 다른 교사에게 넘기기 (재할당)
 */
export async function delegateDepartmentTask(
  taskId: string,
  fromEmail: string,
  toEmail: string,
  toName: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: '존재하지 않는 업무입니다.' };
    }
    const data = snap.data() as DepartmentTask;
    const lowerFrom = fromEmail.toLowerCase();
    const lowerTo = toEmail.toLowerCase();

    // 대상자 목록에서 이전 교사를 새 교사로 교체하거나 추가
    let newTargetEmails = (data.targetEmails || []).map(e => e.toLowerCase() === lowerFrom ? lowerTo : e);
    if (!newTargetEmails.includes(lowerTo)) {
      newTargetEmails.push(lowerTo);
    }
    // 중복 제거
    newTargetEmails = [...new Set(newTargetEmails)];

    const newTargetNames = { ...(data.targetNames || {}) };
    newTargetNames[lowerTo] = toName;

    const newHistory = [
      ...(data.delegatedHistory || []),
      {
        fromEmail: lowerFrom,
        toEmail: lowerTo,
        at: new Date().toISOString(),
        reason: reason || '담당 업무 이관 및 위임',
      }
    ];

    await setDoc(docRef, cleanUndefined({
      targetEmails: newTargetEmails,
      targetNames: newTargetNames,
      delegatedHistory: newHistory,
      updatedAt: new Date().toISOString()
    }), { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('[DepartmentTaskService] delegateDepartmentTask error:', error);
    return { success: false, error: error.message || '업무 위임 처리에 실패했습니다.' };
  }
}

/**
 * 업무 삭제
 */
export async function deleteDepartmentTask(taskId: string): Promise<void> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('[DepartmentTaskService] deleteDepartmentTask error:', error);
    throw error;
  }
}

/**
 * 업무 상태 변경 (마감/완료/재활성화)
 */
export async function updateDepartmentTaskStatus(
  taskId: string, 
  status: 'active' | 'completed' | 'closed'
): Promise<void> {
  try {
    const docRef = doc(getTasksCol(), taskId);
    await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error('[DepartmentTaskService] updateDepartmentTaskStatus error:', error);
    throw error;
  }
}
