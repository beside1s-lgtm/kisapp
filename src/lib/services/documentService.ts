import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
  or,
  and,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
} from '@/lib/types';
import { getUserProfileByEmail, saveUserProfile } from '@/lib/services/userService';

const getApprovalsCol = () => collection(db, 'approvals');
const getSettingsCol = () => collection(db, 'settings');

// ─────────────────────────────────────────────────────────────
// kisbus 스쿨버스 연동: 결석/체험학습 승인 시 notBoarding 처리
// ─────────────────────────────────────────────────────────────

/**
 * YYYY-MM-DD 형식의 날짜 범위(startDate ~ endDate) 내 모든 평일(월~금) 날짜 배열을 반환합니다.
 */
function getWeekdayDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // 0=일, 6=토 제외
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * kisbus Cloud Function을 호출하여 해당 학생의 지정 날짜들에 notBoarding 처리합니다.
 * 실패해도 예외를 던지지 않고 로그만 남깁니다 (메인 승인 흐름에 영향 없음).
 */
async function notifyKisbusAbsence(studentName: string, gradeClassNumber: string, dates: string[]): Promise<void> {
  const KISBUS_API_URL = process.env.KISBUS_API_URL || 'https://us-central1-studio-8176556433-7698a.cloudfunctions.net/markStudentAbsence';
  const KISBUS_API_KEY = process.env.KISBUS_API_KEY || 'kisbus-kisapp-secret-2026';

  if (dates.length === 0) {
    console.log('[kisbus] 처리할 날짜 없음, 스킵.');
    return;
  }

  try {
    const response = await fetch(KISBUS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, gradeClassNumber, dates, apiKey: KISBUS_API_KEY }),
    });
    const result = await response.json();
    if (result.success) {
      console.log(`[kisbus] notBoarding 처리 성공: 학생=${studentName}, 노선=${result.updatedRoutes}개, 날짜=${result.updatedDates}일`);
    } else {
      console.warn(`[kisbus] notBoarding 처리 실패 (비치명적): ${result.error}`);
    }
  } catch (err) {
    console.error('[kisbus] Cloud Function 호출 오류 (비치명적):', err);
  }
}

// 이메일 알림 발송 헬퍼 함수 (Trigger Email Extension 연동)
async function sendMailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string,
  isInboxNotification: boolean = false
) {
  try {
    const normalizedEmail = toEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    // 결재자 대상 결재 대기 알림(Inbox 알림)인 경우, 첫 1회 발송 제한 적용
    if (isInboxNotification) {
      const recipientProfile = await getUserProfileByEmail(normalizedEmail);
      const hasUnread = recipientProfile?.hasUnreadInboxNotification === true;
      if (hasUnread) {
        console.log(`[MailNotification] Skiped sending to ${normalizedEmail} - already has unread inbox notification.`);
        return;
      }
      // 읽지 않은 메일 상태를 true로 설정
      await saveUserProfile('', normalizedEmail, { hasUnreadInboxNotification: true });
    }

    const mailCol = collection(db, 'mail');
    await setDoc(doc(mailCol), {
      to: normalizedEmail,
      message: {
        subject,
        html: htmlContent,
      },
    });
    console.log(`[MailNotification] Mail queued to ${normalizedEmail}. Subject: ${subject}`);
  } catch (error) {
    console.error("[MailNotification] Error queueing mail:", error);
  }
}

// 감사 로그 생성 헬퍼 함수 (audit_logs 컬렉션 연동)
async function createAuditLog(
  docId: string,
  docNo: string,
  title: string,
  action: 'create' | 'approve' | 'reject' | 'recall' | 'delete',
  actorProfile: { uid: string; name: string; email: string; role: string },
  comment?: string
) {
  try {
    const logRef = doc(collection(db, 'audit_logs'));
    await setDoc(logRef, {
      docId,
      docNo,
      title,
      action,
      actorId: actorProfile.uid || '',
      actorName: actorProfile.name || '',
      actorEmail: actorProfile.email || '',
      actorRole: actorProfile.role || '',
      timestamp: serverTimestamp(),
      comment: comment || '',
    });
    console.log(`[AuditLog] Logged '${action}' for doc ${docNo} by ${actorProfile.email}`);
  } catch (error) {
    console.error("[AuditLog] Error creating audit log:", error);
  }
}

// 내부 헬퍼 함수
function serializeDocs(docs: any[], sortBy: 'createdAt' | 'completedAt' = 'createdAt'): any[] {
  if (!docs) return [];
  const serialized = docs.map(d => {
    const data = d.data();
    if (!data) return { id: d.id };
    
    const safeToISOString = (timestamp: any) => {
      if (!timestamp) return null;
      if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
      if (typeof timestamp === 'string' && !isNaN(Date.parse(timestamp))) return timestamp;
      if (timestamp?.toDate) return timestamp.toDate().toISOString();
      try { return new Date(timestamp).toISOString(); } catch { return null; }
    };

    return {
      ...data,
      id: d.id,
      createdAt: safeToISOString(data.createdAt),
      completedAt: safeToISOString(data.completedAt),
      approvers: data.approvers?.map((approver: any) => ({
        ...approver,
        approvedAt: safeToISOString(approver.approvedAt),
      })) || [],
    };
  });

  return serialized.sort((a, b) => {
    const dateA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
    const dateB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
    return dateB - dateA;
  });
}

export async function getInboxDocuments(userEmail: string) {
  if (!userEmail) return [];
  const q = query(getApprovalsCol(), where('status', '==', 'pending'));
  try {
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs, 'createdAt');
    return allPending.filter(doc => {
      if (doc.currentStep >= 0 && doc.currentStep < doc.approvers.length) {
        const currentApprover = doc.approvers[doc.currentStep];
        return currentApprover?.email?.toLowerCase() === userEmail?.toLowerCase();
      }
      return false;
    });
  } catch (error) {
    console.error("[DocService] getInboxDocuments Error:", error);
    return [];
  }
}

export async function getSentDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const q = query(getApprovalsCol(), or(
    where('requesterId', '==', userId),
    where('requesterEmail', '==', userEmail.toLowerCase())
  ));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getSentDocuments Error:", error);
    return [];
  }
}

export async function getPendingDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const q = query(getApprovalsCol(), and(
    or(where('requesterId', '==', userId), where('requesterEmail', '==', userEmail.toLowerCase())),
    where('status', '==', 'pending')
  ));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getPendingDocuments Error:", error);
    return [];
  }
}

const REGISTRY_PAGE_SIZE = 30;

export async function getRegistryDocuments(lastDoc?: DocumentSnapshot) {
  const constraints: any[] = [
    where('status', '==', 'approved'),
    orderBy('completedAt', 'desc'),
    limit(REGISTRY_PAGE_SIZE),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const q = query(getApprovalsCol(), ...constraints);
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs, 'completedAt');
    const filtered = docs.filter((d: ApprovalDoc) => d.docType !== 'parent');
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === REGISTRY_PAGE_SIZE;
    return { docs: filtered, lastVisible, hasMore };
  } catch (error) {
    console.error('[DocService] getRegistryDocuments Error:', error);
    return { docs: [], lastVisible: null, hasMore: false };
  }
}

export async function getAttendanceDocuments(userEmail: string, isAdmin: boolean) {
  if (!userEmail) return [];
  
  try {
    if (isAdmin) {
      const q = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', '==', 'parent')
      );
      const snapshot = await getDocs(q);
      return serializeDocs(snapshot.docs, 'completedAt');
    } else {
      const normalizedEmail = userEmail.toLowerCase();
      
      // 1. 기안자 쿼리
      const q1 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', '==', 'parent'),
        where('requesterEmail', '==', normalizedEmail)
      );
      
      // 2. 결재자 쿼리
      const q2 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', '==', 'parent'),
        where('approverEmails', 'array-contains', normalizedEmail)
      );
      
      const [snap1, snap2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      const docMap = new Map<string, any>();
      
      const addDocsToMap = (docs: any[]) => {
        docs.forEach(doc => {
          docMap.set(doc.id, doc);
        });
      };
      
      addDocsToMap(serializeDocs(snap1.docs, 'completedAt'));
      addDocsToMap(serializeDocs(snap2.docs, 'completedAt'));
      
      return Array.from(docMap.values()).sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });
    }
  } catch (error) {
    console.error("[DocService] getAttendanceDocuments Error:", error);
    return [];
  }
}

export async function getRecalledDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const q = query(getApprovalsCol(), and(
    or(where('requesterId', '==', userId), where('requesterEmail', '==', userEmail.toLowerCase())),
    where('status', '==', 'recalled')
  ));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getRecalledDocuments Error:", error);
    return [];
  }
}

export async function getTeacherRegistryDocuments(userEmail: string, isAdmin: boolean) {
  if (!userEmail) return [];
  
  try {
    if (isAdmin) {
      const q = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime'])
      );
      const snapshot = await getDocs(q);
      return serializeDocs(snapshot.docs, 'completedAt');
    } else {
      const normalizedEmail = userEmail.toLowerCase();
      
      // 1. 기안자 쿼리
      const q1 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime']),
        where('requesterEmail', '==', normalizedEmail)
      );
      
      // 2. 결재자 쿼리
      const q2 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime']),
        where('approverEmails', 'array-contains', normalizedEmail)
      );
      
      // 3. 참조자 쿼리
      const q3 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime']),
        where('circularEmails', 'array-contains', normalizedEmail)
      );
      
      const [snap1, snap2, snap3] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
        getDocs(q3)
      ]);
      
      const docMap = new Map<string, any>();
      
      const addDocsToMap = (docs: any[]) => {
        docs.forEach(doc => {
          docMap.set(doc.id, doc);
        });
      };
      
      addDocsToMap(serializeDocs(snap1.docs, 'completedAt'));
      addDocsToMap(serializeDocs(snap2.docs, 'completedAt'));
      addDocsToMap(serializeDocs(snap3.docs, 'completedAt'));
      
      return Array.from(docMap.values()).sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });
    }
  } catch (error) {
    console.error("[DocService] getTeacherRegistryDocuments Error:", error);
    return [];
  }
}

export async function getDocumentById(docId: string) {
  try {
    const snapshot = await getDoc(doc(getApprovalsCol(), docId));
    if (!snapshot.exists()) return null;
    return serializeDocs([snapshot])[0];
  } catch (error) {
    console.error("[DocService] getDocumentById Error:", error);
    return null;
  }
}

export async function createDocument(payload: ApprovalDocPayload, userId: string, userProfile: UserProfile) {
  const newDocRef = doc(getApprovalsCol());
  const settingsRef = doc(getSettingsCol(), 'docConfig');
  try {
    const finalDocNoStr = await runTransaction(db, async (transaction: any) => {
      const settingsSnap = await transaction.get(settingsRef);
      let nextNum = 1;
      const isFamily = payload.category === 'family'; 
      const isTeacherDuty = payload.docType === 'teacher-duty';
      const isParentAbsence = payload.docType === 'parent' && payload.parentFormData?.type === 'absence';
      const isParentFieldTrip = payload.docType === 'parent' && payload.parentFormData?.type === 'field-trip';
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const schoolYear = (currentMonth === 1 || currentMonth === 2) ? currentYear - 1 : currentYear;

      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as any;
        const savedYear = data.currentSchoolYear || 0;
        
        if (savedYear !== schoolYear) {
          nextNum = 1;
          transaction.update(settingsRef, {
            nextNumber: isTeacherDuty ? 1 : 2,
            nextFamilyNumber: 1,
            nextTeacherDutyNumber: isTeacherDuty ? 2 : 1,
            nextAbsenceNumber: isParentAbsence ? 2 : 1,
            nextFieldTripNumber: isParentFieldTrip ? 2 : 1,
            currentSchoolYear: schoolYear
          });
        } else {
          if (isTeacherDuty) {
            nextNum = data.nextTeacherDutyNumber || 1;
            transaction.update(settingsRef, { nextTeacherDutyNumber: nextNum + 1 });
          } else if (isParentAbsence) {
            nextNum = data.nextAbsenceNumber || 1;
            transaction.update(settingsRef, { nextAbsenceNumber: nextNum + 1 });
          } else if (isParentFieldTrip) {
            nextNum = data.nextFieldTripNumber || 1;
            transaction.update(settingsRef, { nextFieldTripNumber: nextNum + 1 });
          } else {
            nextNum = isFamily ? (data.nextFamilyNumber || 1) : (data.nextNumber || 1);
            transaction.update(settingsRef, isFamily ? { nextFamilyNumber: nextNum + 1 } : { nextNumber: nextNum + 1 });
          }
        }
      } else {
        const initialData = { 
          nextNumber: isTeacherDuty ? 1 : 2, 
          nextFamilyNumber: 1, 
          nextTeacherDutyNumber: isTeacherDuty ? 2 : 1,
          nextAbsenceNumber: isParentAbsence ? 2 : 1,
          nextFieldTripNumber: isParentFieldTrip ? 2 : 1,
          currentSchoolYear: schoolYear
        };
        transaction.set(settingsRef, initialData);
      }
      
      if (isTeacherDuty) return `Kish-${schoolYear}-복무-${nextNum}`;
      if (isParentAbsence) return `Kish-${schoolYear}-결석-${nextNum}`;
      if (isParentFieldTrip) return `Kish-${schoolYear}-체험-${nextNum}`;
      return isFamily ? `Kish-${schoolYear}-가통-${nextNum}` : `Kish-${schoolYear}-초등-${nextNum}`;
    });


    const hasApprovers = payload.approvers && payload.approvers.length > 0;
    const newDocData: any = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userProfile.uid,
      requesterName: payload.docType === 'parent' ? (userProfile.parentName || userProfile.name) : userProfile.name,
      requesterEmail: userProfile.email,
      requesterRole: userProfile.role,
      requesterSignature: userProfile.parentSignature || userProfile.signature || '',
      currentStep: 0,
      status: hasApprovers ? 'pending' : 'approved',
      createdAt: serverTimestamp(),
      completedAt: hasApprovers ? null : serverTimestamp(),
      approverEmails: payload.approvers?.map(a => a.email.toLowerCase()) || [],
      circularEmails: payload.circulars?.map(c => c.email.toLowerCase()) || [],
    };
    await setDoc(newDocRef, newDocData);

    // 감사 로그 기록
    createAuditLog(
      newDocRef.id,
      finalDocNoStr,
      payload.title,
      'create',
      {
        uid: userProfile.uid,
        name: newDocData.requesterName,
        email: userProfile.email,
        role: userProfile.role,
      }
    );

    // 결재 문서 상신 후 첫 번째 결재자에게 알림 메일 발송 (비동기)
    if (hasApprovers) {
      const firstApprover = payload.approvers[0];
      if (firstApprover && firstApprover.email) {
        const mailSubject = `[Kish 결재 시스템] 새 결재 문서가 상신되었습니다.`;
        const mailContent = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
            <h2 style="color: #6366f1; margin-top: 0;">새 결재 대기 알림</h2>
            <p><strong>기안자:</strong> ${newDocData.requesterName} (${newDocData.requesterEmail})</p>
            <p><strong>문서번호:</strong> ${finalDocNoStr}</p>
            <p><strong>제목:</strong> ${payload.title}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p>결재 대기 중인 새 기안문이 있습니다. 결재 시스템 대시보드에 접속하여 확인해 주세요.</p>
            <a href="https://studio-9153973571-7837c.firebaseapp.com/inbox" 
               style="display: inline-block; background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
               대시보드로 이동
            </a>
          </div>
        `;
        sendMailNotification(firstApprover.email, mailSubject, mailContent, true);
      }
    }

    return { success: true, docId: newDocRef.id, docNo: finalDocNoStr };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateDocument(docId: string, payload: ApprovalDocPayload, userId: string, userEmail: string) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("문서를 찾을 수 없습니다.");
    const docData = docSnap.data() as ApprovalDoc;
    const normalizedUserEmail = userEmail?.trim().toLowerCase();
    
    const isOwnerAndRecalled = docData.requesterId === userId && docData.status === 'recalled';
    const currentApprover = docData.approvers[docData.currentStep];
    const isCurrentApproverAndPending = docData.status === 'pending' && currentApprover?.email?.toLowerCase() === normalizedUserEmail;

    if (!isOwnerAndRecalled && !isCurrentApproverAndPending) throw new Error("문서를 수정할 권한이 없습니다.");

    const hasApprovers = payload.approvers && payload.approvers.length > 0;
    let mergedApprovers = payload.approvers;
    
    if (isCurrentApproverAndPending && docData.approvers) {
      mergedApprovers = payload.approvers.map((newAp, idx) => {
        const oldAp = docData.approvers[idx];
        if (oldAp && oldAp.email === newAp.email && oldAp.status === 'approved') return { ...newAp, ...oldAp };
        return { ...newAp, status: 'pending' };
      });
    } else {
      mergedApprovers = payload.approvers.map(approver => ({ ...approver, status: 'pending', signature: '', approvedAt: undefined, comment: '' }));
    }

    const updatedData: any = {
      ...payload,
      status: hasApprovers ? 'pending' : 'approved',
      currentStep: isCurrentApproverAndPending ? docData.currentStep : 0, 
      approvers: mergedApprovers,
      completedAt: hasApprovers ? null : serverTimestamp(),
      updatedAt: serverTimestamp(),
      comment: '',
      approverEmails: mergedApprovers?.map(a => a.email.toLowerCase()) || [],
      circularEmails: payload.circulars?.map(c => c.email.toLowerCase()) || [],
    };
    await firestoreUpdateDoc(docRef, updatedData);
    return { success: true, docId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveDocument(docId: string, userProfile: UserProfile, updatedParentData?: any) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    let emailInfo: {
      isFinal: boolean;
      requesterEmail: string;
      requesterName: string;
      title: string;
      docNo: string;
      nextApproverEmail?: string;
    } | null = null;

    await runTransaction(db, async (transaction: any) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("문서가 없습니다.");
      const data = docSnap.data() as ApprovalDoc;
      const step = data.currentStep;
      
      if (data.approvers[step]?.email?.toLowerCase() !== userProfile.email?.toLowerCase()) throw new Error("권한이 없습니다.");

      const updatedApprovers = [...data.approvers];
      updatedApprovers[step] = {
        ...updatedApprovers[step],
        status: 'approved',
        signature: userProfile.signature || '',
        approvedAt: new Date().toISOString(),
        approverName: userProfile.name,
      };

      if (updatedApprovers[step].role === '부장') {
        updatedApprovers[step].type = 'final';
      }

      const isFinal = updatedApprovers[step].type === 'final' || step === updatedApprovers.length - 1;
      
      const updates: any = {
        approvers: updatedApprovers,
        currentStep: isFinal ? step : step + 1,
        status: isFinal ? 'approved' : 'pending',
        completedAt: isFinal ? serverTimestamp() : null,
      };

      if (updatedParentData && data.parentFormData) {
        updates.parentFormData = {
          ...data.parentFormData,
          ...updatedParentData
        };
      }

      transaction.update(docRef, updates);

      emailInfo = {
        isFinal,
        requesterEmail: data.requesterEmail,
        requesterName: data.requesterName,
        title: data.title,
        docNo: data.docNo || '',
        nextApproverEmail: isFinal ? undefined : updatedApprovers[step + 1]?.email,
      };
    });

    if (emailInfo) {
      const { isFinal, requesterEmail, requesterName, title, docNo, nextApproverEmail } = emailInfo;

      // 승인 감사 로그 기록
      createAuditLog(
        docId,
        docNo,
        title,
        'approve',
        {
          uid: userProfile.uid,
          name: userProfile.name,
          email: userProfile.email,
          role: userProfile.role,
        }
      );

      if (isFinal) {
        // 기안자에게 완료 메일 알림 (쿨다운 없음)
        const subject = `[Kish 결재 시스템] 기안하신 문서가 최종 승인되었습니다.`;
        const content = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
            <h2 style="color: #10b981; margin-top: 0;">결재 완료 알림</h2>
            <p>귀하가 기안하신 다음 문서가 최종 승인(결재 완료)되었습니다.</p>
            <p><strong>문서번호:</strong> ${docNo}</p>
            <p><strong>제목:</strong> ${title}</p>
            <p><strong>최종 승인자:</strong> ${userProfile.name}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <a href="https://studio-9153973571-7837c.firebaseapp.com/documents/${docId}" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
               문서 상세 보기
            </a>
          </div>
        `;
        sendMailNotification(requesterEmail, subject, content, false);

        // ── kisbus 스쿨버스 연동: 학부모 결석계/체험학습 승인 시 notBoarding 자동 처리 ──
        // emailInfo는 transaction 내에서 설정되므로 여기서 docId로 원본 데이터를 재조회합니다
        try {
          const finalDocSnap = await getDoc(docRef);
          if (finalDocSnap.exists()) {
            const finalData = finalDocSnap.data() as ApprovalDoc;
            if (finalData.docType === 'parent' && finalData.parentFormData) {
              const pf = finalData.parentFormData;
              const studentName = pf.studentName;
              const gradeClassNumber = pf.gradeClassNumber; // 예: "5-2-15"

              let absenceDates: string[] = [];
              if (pf.type === 'absence' && pf.absencePeriod?.startDate && pf.absencePeriod?.endDate) {
                absenceDates = getWeekdayDatesInRange(pf.absencePeriod.startDate, pf.absencePeriod.endDate);
              } else if (pf.type === 'field-trip' && pf.tripPeriod?.startDate && pf.tripPeriod?.endDate) {
                absenceDates = getWeekdayDatesInRange(pf.tripPeriod.startDate, pf.tripPeriod.endDate);
              }

              if (studentName && gradeClassNumber && absenceDates.length > 0) {
                // 비동기로 호출 (메인 흐름 블로킹하지 않음)
                notifyKisbusAbsence(studentName, gradeClassNumber, absenceDates);
              }
            }
          }
        } catch (kisbusErr) {
          // kisbus 연동 실패는 승인 결과에 영향 없음
          console.error('[kisbus] 연동 처리 중 오류 (비치명적):', kisbusErr);
        }
        // ───────────────────────────────────────────────────────────────────────
      } else if (nextApproverEmail) {
        // 다음 결재자에게 결재 대기 메일 알림 (첫 1회 발송 제한 적용)
        const subject = `[Kish 결재 시스템] 새 결재 대기 문서가 도착했습니다.`;
        const content = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
            <h2 style="color: #6366f1; margin-top: 0;">결재 대기 알림</h2>
            <p>귀하의 결재를 대기 중인 새 문서가 있습니다.</p>
            <p><strong>기안자:</strong> ${requesterName} (${requesterEmail})</p>
            <p><strong>문서번호:</strong> ${docNo}</p>
            <p><strong>제목:</strong> ${title}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p>대시보드에서 결재 처리를 진행해 주세요.</p>
            <a href="https://studio-9153973571-7837c.firebaseapp.com/inbox" 
               style="display: inline-block; background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
               대시보드로 이동
            </a>
          </div>
        `;
        sendMailNotification(nextApproverEmail, subject, content, true);
      }
    }

    return { success: true, docId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectDocument(docId: string, userProfile: UserProfile, reason: string) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    let emailInfo: {
      requesterEmail: string;
      title: string;
      docNo: string;
    } | null = null;

    await runTransaction(db, async (transaction: any) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("문서가 없습니다.");
      const data = docSnap.data() as ApprovalDoc;
      const step = data.currentStep;

      if (data.approvers[step]?.email?.toLowerCase() !== userProfile.email?.toLowerCase()) throw new Error("권한이 없습니다.");

      const updatedApprovers = [...data.approvers];
      updatedApprovers[step] = {
        ...updatedApprovers[step],
        status: 'rejected',
        signature: userProfile.signature || '',
        approvedAt: new Date().toISOString(),
        comment: reason,
      };
      
      transaction.update(docRef, {
        approvers: updatedApprovers,
        status: 'rejected',
        completedAt: serverTimestamp(),
        comment: reason,
      });

      emailInfo = {
        requesterEmail: data.requesterEmail,
        title: data.title,
        docNo: data.docNo || '',
      };
    });

    if (emailInfo) {
      const { requesterEmail, title, docNo } = emailInfo;

      // 반려 감사 로그 기록
      createAuditLog(
        docId,
        docNo,
        title,
        'reject',
        {
          uid: userProfile.uid,
          name: userProfile.name,
          email: userProfile.email,
          role: userProfile.role,
        },
        reason
      );

      const subject = `[Kish 결재 시스템] 기안하신 문서가 반려되었습니다.`;
      const content = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #ef4444; margin-top: 0;">결재 반려 알림</h2>
          <p>귀하가 기안하신 다음 문서가 반려 처리되었습니다.</p>
          <p><strong>문서번호:</strong> ${docNo}</p>
          <p><strong>제목:</strong> ${title}</p>
          <p><strong>반려자:</strong> ${userProfile.name}</p>
          <p style="margin-bottom: 5px;"><strong>반려 사유:</strong></p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; color: #ef4444; font-weight: bold; margin-bottom: 20px;">
            ${reason}
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <a href="https://studio-9153973571-7837c.firebaseapp.com/documents/${docId}" 
             style="display: inline-block; background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
             문서 확인 및 수정
          </a>
        </div>
      `;
      sendMailNotification(requesterEmail, subject, content, false);
    }

    return { success: true, docId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recallDocument(docId: string, userId: string) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return { success: false, error: "문서 없음" };
    const docData = docSnap.data() as ApprovalDoc;
    if (docData.requesterId !== userId || docData.status !== 'pending') return { success: false, error: "회수 불가" };
    await firestoreUpdateDoc(docRef, { status: 'recalled' });

    // 회수 감사 로그 기록
    createAuditLog(
      docId,
      docData.docNo || '',
      docData.title,
      'recall',
      {
        uid: docData.requesterId,
        name: docData.requesterName,
        email: docData.requesterEmail,
        role: docData.requesterRole,
      }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteDocument(docId: string, userId: string) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    const docSnap = await getDoc(docRef);
    const docData = docSnap.data() as ApprovalDoc;
    if (docData.requesterId !== userId || docData.status !== 'recalled') return { success: false, error: "삭제 불가" };
    await firestoreDeleteDoc(docRef);

    // 삭제 감사 로그 기록
    createAuditLog(
      docId,
      docData.docNo || '',
      docData.title,
      'delete',
      {
        uid: docData.requesterId,
        name: docData.requesterName,
        email: docData.requesterEmail,
        role: docData.requesterRole,
      }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getParentDocuments(category: 'absence' | 'field-trip') {
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent'),
    where('parentFormData.type', '==', category)
  );
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getParentDocuments Error:", error);
    return [];
  }
}

export async function getMyParentDocuments(email: string) {
  if (!email) return [];
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent'),
    where('requesterEmail', '==', email.toLowerCase())
  );
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getMyParentDocuments Error:", error);
    return [];
  }
}

/** 연간 월별 초과근무 통계 — { month: 'M월', hours: number }[] 형태로 반환 */
export async function getOvertimeStatsByYear(userEmail: string, year: string): Promise<{ month: string; hours: number }[]> {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}월`, hours: 0 }));
  if (!userEmail || !year) return months;
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'teacher-overtime'),
    where('requesterEmail', '==', userEmail.toLowerCase())
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    docs.forEach((doc: any) => {
      if (doc.status === 'rejected' || doc.status === 'recalled') return;
      const date: string = doc.teacherOvertimeData?.date;
      if (!date || !date.startsWith(year)) return;
      const idx = parseInt(date.substring(5, 7), 10) - 1;
      if (idx >= 0 && idx < 12) {
        months[idx].hours = parseFloat((months[idx].hours + (doc.teacherOvertimeData?.totalHours || 0)).toFixed(1));
      }
    });
    return months;
  } catch (error) {
    console.error('[DocService] getOvertimeStatsByYear Error:', error);
    return months;
  }
}

export async function getTeacherOvertimeHoursByMonth(userEmail: string, yearMonth: string) {
  if (!userEmail || !yearMonth) return 0;
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'teacher-overtime'),
    where('requesterEmail', '==', userEmail.toLowerCase())
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    const filtered = docs.filter(doc => {
      const date = doc.teacherOvertimeData?.date; // YYYY-MM-DD
      if (!date) return false;
      const docYearMonth = date.substring(0, 7);
      return docYearMonth === yearMonth && doc.status !== 'rejected' && doc.status !== 'recalled';
    });
    
    const total = filtered.reduce((acc, doc) => {
      const hrs = doc.teacherOvertimeData?.totalHours || 0;
      return acc + hrs;
    }, 0);
    
    return parseFloat(total.toFixed(1));
  } catch (error) {
    console.error("[DocService] getTeacherOvertimeHoursByMonth Error:", error);
    return 0;
  }
}

export async function getStudentFieldTripDays(studentName: string, gradeClassNumber: string, year: string) {
  if (!studentName || !gradeClassNumber || !year) return 0;
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent'),
    where('parentFormData.studentName', '==', studentName),
    where('parentFormData.gradeClassNumber', '==', gradeClassNumber)
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    const filtered = docs.filter(doc => {
      const formData = doc.parentFormData;
      if (!formData || formData.type !== 'field-trip') return false;
      const startDate = formData.tripPeriod?.startDate; // YYYY-MM-DD
      if (!startDate) return false;
      return startDate.startsWith(year) && doc.status !== 'rejected' && doc.status !== 'recalled';
    });
    
    return filtered.reduce((acc, doc) => {
      return acc + (doc.parentFormData?.tripPeriod?.totalDays || 0);
    }, 0);
  } catch (error) {
    console.error("[DocService] getStudentFieldTripDays Error:", error);
    return 0;
  }
}

export async function getStudentAbsenceDays(studentName: string, gradeClassNumber: string, year: string) {
  if (!studentName || !gradeClassNumber || !year) return 0;
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent'),
    where('parentFormData.studentName', '==', studentName),
    where('parentFormData.gradeClassNumber', '==', gradeClassNumber)
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    const filtered = docs.filter(doc => {
      const formData = doc.parentFormData;
      if (!formData || formData.type !== 'absence') return false;
      if (formData.absenceType === '출석인정') return false;
      const startDate = formData.absencePeriod?.startDate; // YYYY-MM-DD
      if (!startDate) return false;
      return startDate.startsWith(year) && doc.status !== 'rejected' && doc.status !== 'recalled';
    });
    
    return filtered.reduce((acc, doc) => {
      return acc + (doc.parentFormData?.absencePeriod?.totalDays || 0);
    }, 0);
  } catch (error) {
    console.error("[DocService] getStudentAbsenceDays Error:", error);
    return 0;
  }
}

export async function getMyTeacherDocuments(userEmail: string) {
  if (!userEmail) return [];
  const q = query(
    getApprovalsCol(),
    where('requesterEmail', '==', userEmail.toLowerCase())
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs, 'createdAt');
    return docs.filter(doc => doc.docType === 'teacher-duty' || doc.docType === 'teacher-overtime');
  } catch (error) {
    console.error("[DocService] getMyTeacherDocuments Error:", error);
    return [];
  }
}

export async function getParentServiceDocuments(userEmail: string, isAdmin: boolean) {
  if (!userEmail) return [];
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent')
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs, 'createdAt');
    if (isAdmin) return docs;
    
    const normalizedEmail = userEmail.toLowerCase();
    return docs.filter(doc => {
      const isRequester = doc.requesterEmail?.toLowerCase() === normalizedEmail;
      const isApprover = doc.approvers?.some((a: any) => a.email?.toLowerCase() === normalizedEmail);
      return isRequester || isApprover;
    });
  } catch (error) {
    console.error("[DocService] getParentServiceDocuments Error:", error);
    return [];
  }
}

export async function getTeacherDutyStats(userEmail: string, year: string, annualLimit: number = 21) {
  if (!userEmail || !year) return { annualUsed: 0, sickUsed: 0, otherUsed: 0, earlyUsedHours: 0, earlyConvertedDays: 0, remainingEarlyHours: 0, totalAnnualUsed: 0, annualLimit, annualRemaining: annualLimit };
  
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'teacher-duty'),
    where('requesterEmail', '==', userEmail.toLowerCase()),
    where('status', '==', 'approved')
  );
  
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    
    const filtered = docs.filter(doc => {
      const startDate = doc.teacherDutyData?.startDate; // YYYY-MM-DD
      return startDate && startDate.startsWith(year);
    });

    let annualDays = 0; 
    let sickDays = 0;   
    let otherDays = 0;  
    let earlyHours = 0; 

    filtered.forEach(doc => {
      const data = doc.teacherDutyData;
      if (!data) return;

      if (data.mainType === '휴가') {
        const sub = data.subType;
        const detail = data.detailType;

        if (sub === '연가') {
          if (detail === '조퇴' || detail === '지참') {
            if (data.startTime && data.endTime) {
              const [startH, startM] = data.startTime.split(':').map(Number);
              const [endH, endM] = data.endTime.split(':').map(Number);
              const diffMin = (endH * 60 + endM) - (startH * 60 + startM);
              if (diffMin > 0) {
                earlyHours += diffMin / 60;
              }
            } else {
              earlyHours += (data.totalDays || 0) * 8;
            }
          } else {
            annualDays += (data.totalDays || 0);
          }
        } else if (sub === '병가') {
          sickDays += (data.totalDays || 0);
        } else {
          otherDays += (data.totalDays || 0);
        }
      }
    });

    const earlyConvertedDays = Math.floor(earlyHours / 8);
    const remainingEarlyHours = earlyHours % 8;
    const totalAnnualUsed = annualDays + earlyConvertedDays;
    const annualRemaining = Math.max(0, annualLimit - totalAnnualUsed);

    return {
      annualUsed: annualDays,
      earlyUsedHours: parseFloat(earlyHours.toFixed(1)),
      earlyConvertedDays,
      remainingEarlyHours: parseFloat(remainingEarlyHours.toFixed(1)),
      totalAnnualUsed,
      sickUsed: sickDays,
      otherUsed: otherDays,
      annualLimit,
      annualRemaining
    };
  } catch (error) {
    console.error("[DocService] getTeacherDutyStats Error:");
    return { annualUsed: 0, sickUsed: 0, otherUsed: 0, earlyUsedHours: 0, earlyConvertedDays: 0, remainingEarlyHours: 0, totalAnnualUsed: 0, annualLimit, annualRemaining: annualLimit };
  }
}

/** 감사 로그 조회 (페이지네이션 및 날짜 필터 지원) */
export async function getAuditLogs(
  limitCount: number = 50,
  lastDoc?: DocumentSnapshot,
  startDate?: string,
  endDate?: string
): Promise<{ logs: any[]; lastVisible: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ];
  
  if (startDate) {
    constraints.push(where('timestamp', '>=', new Date(startDate)));
  }
  if (endDate) {
    constraints.push(where('timestamp', '<=', new Date(endDate + 'T23:59:59.999Z')));
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, 'audit_logs'), ...constraints);
  try {
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(d => {
      const data = d.data();
      const safeToISOString = (timestamp: any) => {
        if (!timestamp) return null;
        if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
        if (typeof timestamp === 'string' && !isNaN(Date.parse(timestamp))) return timestamp;
        if (timestamp?.toDate) return timestamp.toDate().toISOString();
        try { return new Date(timestamp).toISOString(); } catch { return null; }
      };
      return {
        id: d.id,
        ...data,
        timestamp: safeToISOString(data.timestamp),
      };
    });
    
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === limitCount;
    return { logs, lastVisible, hasMore };
  } catch (error) {
    console.error("[DocService] getAuditLogs Error:", error);
    return { logs: [], lastVisible: null, hasMore: false };
  }
}


