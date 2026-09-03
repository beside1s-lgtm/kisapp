import { getDb, auth } from '@/lib/firebase';
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
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
  OrgStructure,
  DutyRolePermission,
} from '@/lib/types';
import { getUserProfileByEmail, saveUserProfile } from '@/lib/services/userService';

const getApprovalsCol = () => collection(getDb(), 'approvals');
const getSettingsCol = () => collection(getDb(), 'settings');

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
export async function sendMailNotification(
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

    
    const mailCol = collection(getDb(), 'mail');
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
    
    const logRef = doc(collection(getDb(), 'audit_logs'));
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

export async function getInboxDocuments(userEmail: string, userName?: string) {
  if (!userEmail && !userName) return [];
  if (!auth.currentUser || userEmail?.includes('test')) return [];
  try {
    const q = query(getApprovalsCol(), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs, 'createdAt');
    const normalizedEmail = userEmail?.trim().toLowerCase();
    const normalizedName = userName?.trim();

    return allPending.filter(doc => {
      if (doc.currentStep >= 0 && doc.currentStep < doc.approvers.length) {
        const currentApprover = doc.approvers[doc.currentStep];
        const approverEmail = currentApprover?.email?.trim().toLowerCase();
        const approverName = currentApprover?.name?.trim();

        // 1) 이메일 일치 검사
        if (normalizedEmail && approverEmail && approverEmail === normalizedEmail) {
          return true;
        }
        // 2) 이름 일치 검사 (이메일이 누락되었거나 이름으로만 지정된 경우 보조 매칭)
        if (normalizedName && approverName && approverName === normalizedName) {
          return true;
        }
      }
      return false;
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      return [];
    }
    console.error("[DocService] getInboxDocuments Error:", error);
    return [];
  }
}

export async function getSentDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  if (!auth.currentUser || userId?.startsWith('test_') || userEmail?.includes('test')) return [];
  // limit(200): 과거 상신 문서 전체 목록 중 최근 200건만 로드 (Firestore 무제한 쿼리 방지)
  const q = query(
    getApprovalsCol(),
    or(
      where('requesterId', '==', userId),
      where('requesterEmail', '==', userEmail.toLowerCase())
    ),
    limit(200)
  );
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("[DocService] getSentDocuments Error:", error);
    return [];
  }
}

/**
 * 내가 공람자로 지정된 결재 완료(approved) 문서 조회
 */
export async function getCircularDocuments(userEmail: string, userName?: string): Promise<any[]> {
  if (!userEmail) return [];
  const normalizedEmail = userEmail.trim().toLowerCase();
  const trimmedName = userName?.trim();

  try {
    const q = query(
      getApprovalsCol(),
      and(
        where('circularEmails', 'array-contains', normalizedEmail),
        where('status', '==', 'approved')
      ),
      limit(200)
    );

    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs, 'completedAt');

    return docs.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error("[DocService] getCircularDocuments Error:", error);
    return [];
  }
}

export async function getPendingDocuments(userId: string, userEmail: string, userName?: string) {
  if (!userId && !userEmail) return [];
  if (!auth.currentUser || userId?.startsWith('test_') || userEmail?.includes('test')) return [];

  const normalizedEmail = userEmail?.trim().toLowerCase();
  const trimmedName = userName?.trim();

  try {
    // 1. 내가 기안자인 진행중 문서
    const q1 = query(getApprovalsCol(), and(
      or(where('requesterId', '==', userId), where('requesterEmail', '==', normalizedEmail)),
      where('status', '==', 'pending')
    ));

    // 2. 내가 결재선에 포함된 진행중 문서
    const q2 = query(getApprovalsCol(), and(
      where('approverEmails', 'array-contains', normalizedEmail),
      where('status', '==', 'pending')
    ));

    const [snap1, snap2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    const docMap = new Map<string, any>();

    // 기안자 문서 등록
    serializeDocs(snap1.docs, 'createdAt').forEach(d => {
      docMap.set(d.id, d);
    });

    // 결재자 문서 등록: 내가 이미 결재 승인(approved)을 마쳤으나 전체 상태가 pending인 문서
    serializeDocs(snap2.docs, 'createdAt').forEach(d => {
      const isMyApproved = d.approvers?.some((ap: any) => {
        const apEmail = ap.email?.trim().toLowerCase();
        const apName = ap.name?.trim();
        const isMe = (normalizedEmail && apEmail && apEmail === normalizedEmail) ||
                     (trimmedName && apName && apName === trimmedName);
        return isMe && ap.status === 'approved';
      });

      if (isMyApproved) {
        docMap.set(d.id, d);
      }
    });

    const allDocs = Array.from(docMap.values());
    // 복무 및 초과근무 신청 문서는 일반 기안 상신 문서 목록에서 제외
    const filtered = allDocs.filter(doc => doc.docType !== 'teacher-duty' && doc.docType !== 'teacher-overtime');

    return filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
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

export async function getAttendanceDocuments(
  userEmail: string, 
  isAdmin: boolean,
  options?: {
    permissions?: DutyRolePermission[];
    orgStructure?: OrgStructure | null;
  }
) {
  if (!userEmail) return [];
  const normalizedEmail = userEmail.toLowerCase();
  
  try {
    const org = options?.orgStructure;
    const permissions = options?.permissions || [];

    // 1. 최고 결재권자 판정: 관리자, 학교장, 교감, 교무부장
    const isLeadership = !!(
      isAdmin ||
      (org?.principal && org.principal.toLowerCase() === normalizedEmail) ||
      (org?.vicePrincipal && org.vicePrincipal.toLowerCase() === normalizedEmail) ||
      (org?.academicHead && org.academicHead.toLowerCase() === normalizedEmail)
    );

    // 2. 학생출결/학적 총괄 관리자(student_admin) 또는 전교생 범위('all') 권한 판정
    const hasAllScope = isLeadership || permissions.some(p => 
      p.features?.includes('student_admin') || 
      p.attendanceScope?.type === 'all'
    );

    // 전교생 전체 권한자인 경우: 모든 승인된 결석/체험학습 문서 즉시 반환
    if (hasAllScope) {
      const q = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', '==', 'parent')
      );
      const snapshot = await getDocs(q);
      return serializeDocs(snapshot.docs, 'completedAt');
    }

    // 3. 학년/학급별 문서 접근 권한 범위 계산
    const allowedGrades = new Set<string>();
    const allowedClasses = new Set<string>(); // "3-1" 형식

    // (1) 학년부장 여부 확인 (소속 학년 전체)
    if (org?.gradeHeads) {
      Object.entries(org.gradeHeads).forEach(([grade, email]) => {
        if (email && email.toLowerCase() === normalizedEmail) {
          allowedGrades.add(grade);
        }
      });
    }

    // (2) 담임교사 여부 확인 (소속 학급 전체)
    if (org?.homerooms) {
      Object.entries(org.homerooms).forEach(([gc, email]) => {
        if (email && email.toLowerCase() === normalizedEmail) {
          allowedClasses.add(gc);
        }
      });
    }

    // (3) 부여된 업무 권한(attendanceScope) 해석
    permissions.forEach(p => {
      if (p.attendanceScope) {
        if (p.attendanceScope.type === 'assigned_grade') {
          // 해당 교사가 속한 학년 전체
          if (org?.gradeHeads) {
            Object.entries(org.gradeHeads).forEach(([grade, email]) => {
              if (email && email.toLowerCase() === normalizedEmail) allowedGrades.add(grade);
            });
          }
          if (org?.homerooms) {
            Object.entries(org.homerooms).forEach(([gc, email]) => {
              if (email && email.toLowerCase() === normalizedEmail) allowedGrades.add(gc.split('-')[0]);
            });
          }
        } else if (p.attendanceScope.type === 'specific_grades' && p.attendanceScope.grades) {
          p.attendanceScope.grades.forEach(g => allowedGrades.add(String(g)));
        } else if (p.attendanceScope.type === 'assigned_class') {
          if (org?.homerooms) {
            Object.entries(org.homerooms).forEach(([gc, email]) => {
              if (email && email.toLowerCase() === normalizedEmail) allowedClasses.add(gc);
            });
          }
        }
      }
    });

    // 4. Firestore 쿼리 실행
    // (A) 기본 공통: 자신이 기안했거나 결재선(approverEmails)에 포함된 승인 문서
    const q1 = query(
      getApprovalsCol(),
      where('status', '==', 'approved'),
      where('docType', '==', 'parent'),
      where('requesterEmail', '==', normalizedEmail)
    );
    const q2 = query(
      getApprovalsCol(),
      where('status', '==', 'approved'),
      where('docType', '==', 'parent'),
      where('approverEmails', 'array-contains', normalizedEmail)
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const docMap = new Map<string, any>();

    const addDocsToMap = (docs: any[]) => {
      docs.forEach(doc => {
        docMap.set(doc.id, doc);
      });
    };

    addDocsToMap(serializeDocs(snap1.docs, 'completedAt'));
    addDocsToMap(serializeDocs(snap2.docs, 'completedAt'));

    // (B) 만약 특정 학년 또는 학급에 대한 추가 열람 권한이 있다면, 전체 승인 문서 중 해당 학년/학급 문서를 매칭하여 병합
    if (allowedGrades.size > 0 || allowedClasses.size > 0) {
      const qAll = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', '==', 'parent')
      );
      const allSnap = await getDocs(qAll);
      const allDocs = serializeDocs(allSnap.docs, 'completedAt');

      allDocs.forEach(d => {
        const gcStr = d.parentFormData?.gradeClassNumber || d.gradeClass || '';
        const parts = gcStr.split('-');
        const grade = parts[0] || (d.studentGrade ? String(d.studentGrade) : '');
        const gradeClass = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : (d.studentGrade && d.studentClass ? `${d.studentGrade}-${d.studentClass}` : '');

        const isAllowedGrade = grade && allowedGrades.has(grade);
        const isAllowedClass = gradeClass && allowedClasses.has(gradeClass);

        if (isAllowedGrade || isAllowedClass) {
          docMap.set(d.id, d);
        }
      });
    }

    return Array.from(docMap.values()).sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });
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

export async function getRejectedDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const q = query(getApprovalsCol(), and(
    or(where('requesterId', '==', userId), where('requesterEmail', '==', userEmail.toLowerCase())),
    where('status', '==', 'rejected')
  ));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'completedAt');
  } catch (error) {
    console.error("[DocService] getRejectedDocuments Error:", error);
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
        where('docType', 'in', ['teacher-duty', 'teacher-overtime', 'teacher-afterschool'])
      );
      const snapshot = await getDocs(q);
      return serializeDocs(snapshot.docs, 'completedAt');
    } else {
      const normalizedEmail = userEmail.toLowerCase();
      
      // 1. 기안자 쿼리
      const q1 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime', 'teacher-afterschool']),
        where('requesterEmail', '==', normalizedEmail)
      );
      
      // 2. 결재자 쿼리
      const q2 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime', 'teacher-afterschool']),
        where('approverEmails', 'array-contains', normalizedEmail)
      );
      
      // 3. 참조자 쿼리
      const q3 = query(
        getApprovalsCol(),
        where('status', '==', 'approved'),
        where('docType', 'in', ['teacher-duty', 'teacher-overtime', 'teacher-afterschool']),
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
    
    const finalDocNoStr = await runTransaction(getDb(), async (transaction: any) => {
      const settingsSnap = await transaction.get(settingsRef);
      let nextNum = 1;
      const isFamily = payload.category === 'family'; 
      const isTeacherDuty = payload.docType === 'teacher-duty';
      const isTeacherAfterschool = payload.docType === 'teacher-afterschool';
      const isParentAbsence = payload.docType === 'parent' && payload.parentFormData?.type === 'absence';
      const isParentFieldTrip = payload.docType === 'parent' && payload.parentFormData?.type === 'field-trip';
      const isParentFieldTripReport = payload.docType === 'parent' && payload.parentFormData?.type === 'field-trip-report';
      
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
            nextNumber: (isTeacherDuty || isTeacherAfterschool) ? 1 : 2,
            nextFamilyNumber: 1,
            nextTeacherDutyNumber: isTeacherDuty ? 2 : 1,
            nextAfterschoolNumber: isTeacherAfterschool ? 2 : 1,
            nextAbsenceNumber: isParentAbsence ? 2 : 1,
            nextFieldTripNumber: isParentFieldTrip ? 2 : 1,
            nextFieldTripReportNumber: isParentFieldTripReport ? 2 : 1,
            currentSchoolYear: schoolYear
          });
        } else {
          if (isTeacherDuty) {
            nextNum = data.nextTeacherDutyNumber || 1;
            transaction.update(settingsRef, { nextTeacherDutyNumber: nextNum + 1 });
          } else if (isTeacherAfterschool) {
            nextNum = data.nextAfterschoolNumber || 1;
            transaction.update(settingsRef, { nextAfterschoolNumber: nextNum + 1 });
          } else if (isParentAbsence) {
            nextNum = data.nextAbsenceNumber || 1;
            transaction.update(settingsRef, { nextAbsenceNumber: nextNum + 1 });
          } else if (isParentFieldTrip) {
            nextNum = data.nextFieldTripNumber || 1;
            transaction.update(settingsRef, { nextFieldTripNumber: nextNum + 1 });
          } else if (isParentFieldTripReport) {
            nextNum = data.nextFieldTripReportNumber || 1;
            transaction.update(settingsRef, { nextFieldTripReportNumber: nextNum + 1 });
          } else {
            nextNum = isFamily ? (data.nextFamilyNumber || 1) : (data.nextNumber || 1);
            transaction.update(settingsRef, isFamily ? { nextFamilyNumber: nextNum + 1 } : { nextNumber: nextNum + 1 });
          }
        }
      } else {
        const initialData = { 
          nextNumber: (isTeacherDuty || isTeacherAfterschool) ? 1 : 2, 
          nextFamilyNumber: 1, 
          nextTeacherDutyNumber: isTeacherDuty ? 2 : 1,
          nextAfterschoolNumber: isTeacherAfterschool ? 2 : 1,
          nextAbsenceNumber: isParentAbsence ? 2 : 1,
          nextFieldTripNumber: isParentFieldTrip ? 2 : 1,
          nextFieldTripReportNumber: isParentFieldTripReport ? 2 : 1,
          currentSchoolYear: schoolYear
        };
        transaction.set(settingsRef, initialData);
      }
      
      if (isTeacherDuty) return `Kish-${schoolYear}-복무-${nextNum}`;
      if (isTeacherAfterschool) return `Kish-${schoolYear}-방과후-${nextNum}`;
      if (isParentAbsence) return `결석-${schoolYear}-${nextNum}`;
      if (isParentFieldTrip) {
        const gradeClassParts = payload.parentFormData?.gradeClassNumber?.replace(/[^0-9-]/g, '-').split('-').filter(Boolean) || [];
        const gradeStr = gradeClassParts[0] || userProfile.studentGrade || '1';
        return `체험-${schoolYear}-${gradeStr}-${nextNum}`;
      }
      if (isParentFieldTripReport) return `결과-${schoolYear}-${nextNum}`;
      return isFamily ? `Kish-${schoolYear}-가통-${nextNum}` : `Kish-${schoolYear}-초등-${nextNum}`;
    });


    const hasApprovers = payload.approvers && payload.approvers.length > 0;
    const newDocData: any = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userProfile.uid,
      requesterName: payload.docType === 'parent' ? (userProfile.parentName || userProfile.name) : userProfile.name,
      requesterEmail: userProfile.email?.toLowerCase() || '',
      requesterRole: userProfile.role,
      requesterSignature: userProfile.parentSignature || userProfile.signature || '',
      currentStep: 0,
      status: hasApprovers ? 'pending' : 'approved',
      createdAt: serverTimestamp(),
      completedAt: hasApprovers ? null : serverTimestamp(),
      approverEmails: payload.approvers?.map(a => a.email?.toLowerCase()?.trim()).filter(Boolean) || [],
      circularEmails: payload.circulars?.map(c => c.email?.toLowerCase()?.trim()).filter(Boolean) || [],
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

    
    await runTransaction(getDb(), async (transaction: any) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("문서가 없습니다.");
      const data = docSnap.data() as ApprovalDoc;
      const step = data.currentStep;
      
      const currentAp = data.approvers[step];
      const currentApEmail = currentAp?.email?.trim().toLowerCase();
      const currentApName = currentAp?.name?.trim();
      const userEmail = userProfile.email?.trim().toLowerCase();
      const userName = userProfile.name?.trim();

      const isAuthorized = 
        (userEmail && currentApEmail && userEmail === currentApEmail) || 
        (userName && currentApName && userName === currentApName) || 
        userProfile.isAdmin;

      if (!isAuthorized) throw new Error("권한이 없습니다.");

      const updatedApprovers = [...data.approvers];
      updatedApprovers[step] = {
        ...updatedApprovers[step],
        status: 'approved',
        signature: userProfile.signature || '',
        approvedAt: new Date().toISOString(),
        approverName: userProfile.name,
      };

      const isFinal = updatedApprovers[step].type === 'final' || step === updatedApprovers.length - 1;
      
      let finalDocNoStr = data.docNo || '';
      if (isFinal) {
        // '미채번', '(결재 진행 중)', '진행 중' 등 미완료 번호인 경우 정식 일련번호 채번
        const needsNewDocNo = !finalDocNoStr || finalDocNoStr === '미채번' || finalDocNoStr.includes('진행 중') || finalDocNoStr.includes('임시');
        if (needsNewDocNo) {
          const settingsRef = doc(getSettingsCol(), 'docConfig');
          const settingsSnap = await transaction.get(settingsRef);
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          const schoolYear = (currentMonth === 1 || currentMonth === 2) ? currentYear - 1 : currentYear;

          let nextNum = 1;
          const isFamilyCat = data.category === 'family';

          if (settingsSnap.exists()) {
            const sData = settingsSnap.data() as any;
            const savedYear = sData.currentSchoolYear || 0;
            if (savedYear !== schoolYear) {
              nextNum = 1;
              if (isFamilyCat) {
                transaction.update(settingsRef, { nextFamilyNumber: 2, nextNumber: 1, currentSchoolYear: schoolYear });
              } else {
                transaction.update(settingsRef, { nextNumber: 2, nextFamilyNumber: 1, currentSchoolYear: schoolYear });
              }
            } else {
              if (isFamilyCat) {
                nextNum = sData.nextFamilyNumber || 1;
                transaction.update(settingsRef, { nextFamilyNumber: nextNum + 1 });
              } else {
                nextNum = sData.nextNumber || 1;
                transaction.update(settingsRef, { nextNumber: nextNum + 1 });
              }
            }
          } else {
            const initialData = isFamilyCat
              ? { nextNumber: 1, nextFamilyNumber: 2, currentSchoolYear: schoolYear }
              : { nextNumber: 2, nextFamilyNumber: 1, currentSchoolYear: schoolYear };
            transaction.set(settingsRef, initialData);
          }
          finalDocNoStr = isFamilyCat ? `Kish-${schoolYear}-가통-${nextNum}` : `Kish-${schoolYear}-초등-${nextNum}`;
        }
      }

      const updates: any = {
        approvers: updatedApprovers,
        currentStep: isFinal ? step : step + 1,
        status: isFinal ? 'approved' : 'pending',
        completedAt: isFinal ? serverTimestamp() : null,
        ...(isFinal ? { docNo: finalDocNoStr } : {}),
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
        docNo: finalDocNoStr,
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
            <a href="https://app.cjwave.kr/documents/${docId}" 
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
            <a href="https://app.cjwave.kr/inbox" 
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

    
    await runTransaction(getDb(), async (transaction: any) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("문서가 없습니다.");
      const data = docSnap.data() as ApprovalDoc;
      const step = data.currentStep;

      const currentAp = data.approvers[step];
      const currentApEmail = currentAp?.email?.trim().toLowerCase();
      const currentApName = currentAp?.name?.trim();
      const userEmail = userProfile.email?.trim().toLowerCase();
      const userName = userProfile.name?.trim();

      const isAuthorized = 
        (userEmail && currentApEmail && userEmail === currentApEmail) || 
        (userName && currentApName && userName === currentApName) || 
        userProfile.isAdmin;

      if (!isAuthorized) throw new Error("권한이 없습니다.");

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

export async function recallDocument(docId: string, userIdOrEmail: string) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return { success: false, error: "문서를 찾을 수 없습니다." };
    const docData = docSnap.data() as ApprovalDoc;

    const target = (userIdOrEmail || '').trim().toLowerCase();
    const reqId = (docData.requesterId || '').trim().toLowerCase();
    const reqEmail = (docData.requesterEmail || '').trim().toLowerCase();

    const isRequester = Boolean(
      (target && reqId && reqId === target) ||
      (target && reqEmail && reqEmail === target)
    );

    if (!isRequester || docData.status !== 'pending') {
      return { success: false, error: "회수할 권한이 없거나 진행 중인 문서가 아닙니다." };
    }
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

export async function deleteDocument(docId: string, userIdOrEmail: string, isAdmin: boolean = false) {
  const docRef = doc(getApprovalsCol(), docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return { success: false, error: "문서를 찾을 수 없습니다." };
    const docData = docSnap.data() as ApprovalDoc;

    const target = (userIdOrEmail || '').trim().toLowerCase();
    const reqId = (docData.requesterId || '').trim().toLowerCase();
    const reqEmail = (docData.requesterEmail || '').trim().toLowerCase();
    const isParentDoc = docData.docType === 'parent' || Boolean(docData.parentFormData);

    const isRequester = Boolean(
      (target && reqId && reqId === target) ||
      (target && reqEmail && reqEmail === target) ||
      isParentDoc
    );

    // 회수(recalled), 반려(rejected), 대기(pending), 임시저장(draft) 상태인 경우 기안자 또는 관리자(학부모 포함)가 삭제 가능
    const status = (docData.status || '').toLowerCase();
    const isAllowedStatus = status === 'recalled' || status === 'rejected' || status === 'draft' || (isParentDoc && status === 'pending');

    if (!isAllowedStatus || status === 'approved') {
      return { success: false, error: "회수 또는 반려된 문서만 삭제할 수 있습니다 (승인 완료된 문서는 삭제 불가)." };
    }

    if (!isRequester && !isAdmin) {
      return { success: false, error: "문서 삭제 권한이 없습니다 (기안자 본인 또는 관리자만 삭제 가능)." };
    }

    await firestoreDeleteDoc(docRef);

    // 삭제 감사 로그 기록 (비차단)
    try {
      createAuditLog(
        docId,
        docData.docNo || '',
        docData.title,
        'delete',
        {
          uid: docData.requesterId || '',
          name: docData.requesterName || '',
          email: docData.requesterEmail || '',
          role: docData.requesterRole || '',
        }
      );
    } catch (auditErr) {
      console.warn("[DocService] audit log failed during delete:", auditErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[DocService] deleteDocument error:", error);
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
  const normalized = email.trim().toLowerCase();
  try {
    const q = query(
      getApprovalsCol(),
      where('docType', '==', 'parent')
    );
    const snapshot = await getDocs(q);
    const allDocs = serializeDocs(snapshot.docs, 'createdAt');
    return allDocs.filter(d => (d.requesterEmail || '').trim().toLowerCase() === normalized);
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
  try {
    const q = query(
      getApprovalsCol(),
      where('docType', '==', 'parent')
    );
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    const filtered = docs.filter(doc => {
      const formData = doc.parentFormData;
      if (!formData || formData.type !== 'field-trip') return false;
      if (formData.studentName !== studentName || formData.gradeClassNumber !== gradeClassNumber) return false;
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
  try {
    const q = query(
      getApprovalsCol(),
      where('docType', '==', 'parent')
    );
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs);
    const filtered = docs.filter(doc => {
      const formData = doc.parentFormData;
      if (!formData || formData.type !== 'absence') return false;
      if (formData.studentName !== studentName || formData.gradeClassNumber !== gradeClassNumber) return false;
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

export async function getParentServiceDocuments(userEmail: string, userName?: string) {
  if (!userEmail && !userName) return [];
  const q = query(
    getApprovalsCol(),
    where('docType', '==', 'parent'),
    where('status', '==', 'pending')
  );
  try {
    const snapshot = await getDocs(q);
    const docs = serializeDocs(snapshot.docs, 'createdAt');
    const normalizedEmail = userEmail?.trim().toLowerCase();
    const normalizedName = userName?.trim();

    // 오직 현재 로그인 사용자의 결재 차례(currentStep)인 학부모 출결 문서만 반환
    return docs.filter(doc => {
      if (doc.status !== 'pending') return false;
      if (doc.currentStep >= 0 && doc.currentStep < (doc.approvers?.length || 0)) {
        const currentApprover = doc.approvers[doc.currentStep];
        const approverEmail = currentApprover?.email?.trim().toLowerCase();
        const approverName = currentApprover?.name?.trim();

        const emailMatch = normalizedEmail && approverEmail && approverEmail === normalizedEmail;
        const nameMatch = normalizedName && approverName && approverName === normalizedName;
        return emailMatch || nameMatch;
      }
      return false;
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
    console.error("[DocService] getTeacherDutyStats Error:", error);
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

  
  const q = query(collection(getDb(), 'audit_logs'), ...constraints);
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

/** 체험학습 결과보고서를 승인 완료된 신청서에 결합 제출 */
export async function submitFieldTripReport(
  originalDocId: string,
  reportData: {
    reportTitle: string;
    reportContent: string;
    submittedAt: string;
  },
  userProfile: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getApprovalsCol(), originalDocId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("원본 체험학습 신청서를 찾을 수 없습니다.");
    
    const docData = docSnap.data() as ApprovalDoc;
    if (docData.status !== 'approved') {
      throw new Error("승인 완료된 신청서에만 보고서를 제출할 수 있습니다.");
    }

    // 1. 기존 parentFormData 와 reportData 를 합쳐서 머지
    const updatedParentFormData = {
      ...docData.parentFormData,
      reportSubmitted: true,
      reportTitle: reportData.reportTitle,
      reportContent: reportData.reportContent,
      reportSubmittedAt: reportData.submittedAt,
    };

    // 2. 문서 content 영역 하단에 결과보고서 양식 HTML 덧붙임
    const reportHtml = `
      <div class="field-trip-report-page" style="page-break-before: always; break-before: page; margin-top: 30px; font-family: serif; text-align: left; width: 100%;">
        <div style="font-family: serif; text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">「학교장허가 교외체험학습」 결과보고서</h2>
          <span style="font-size: 11px; color: #dc2626; font-weight: bold;">(체험학습 실시 후 7일 이내 제출)</span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-size: 12px; text-align: center;">
          <tbody>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; width: 120px; font-weight: bold;">성 명</th>
              <td style="border: 1px solid black; padding: 8px;">${docData.parentFormData?.studentName || ''}</td>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; width: 120px; font-weight: bold;">학년 반 번</th>
              <td style="border: 1px solid black; padding: 8px;">${docData.parentFormData?.gradeClassNumber || ''}</td>
            </tr>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; font-weight: bold;">교외체험학습 기간</th>
              <td style="border: 1px solid black; padding: 8px; text-align: left;" colSpan="3">
                ${docData.parentFormData?.tripPeriod?.startDate} ~ ${docData.parentFormData?.tripPeriod?.endDate} (총 ${docData.parentFormData?.tripPeriod?.totalDays}일간)
              </td>
            </tr>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; font-weight: bold;">교외체험학습 장소</th>
              <td style="border: 1px solid black; padding: 8px; text-align: left;" colSpan="3">
                ${docData.parentFormData?.destination || ''}
              </td>
            </tr>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; font-weight: bold;">학습 형태</th>
              <td style="border: 1px solid black; padding: 8px; text-align: left;" colSpan="3">
                ${docData.parentFormData?.tripType || ''}
              </td>
            </tr>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; font-weight: bold;">제 목</th>
              <td style="border: 1px solid black; padding: 8px; text-align: left;" colSpan="3">
                <strong>${reportData.reportTitle}</strong>
              </td>
            </tr>
            <tr>
              <th style="border: 1px solid black; background-color: #f8fafc; padding: 8px; height: 240px; font-weight: bold; vertical-align: middle;">교외<br/>체험학습<br/>결과</th>
              <td style="border: 1px solid black; padding: 12px; text-align: left; vertical-align: top; line-height: 1.6;" colSpan="3">
                <div style="font-size: 11px; color: #64748b; margin-bottom: 8px; font-style: italic;">* 각 일정별로 느낀 점, 배운 점 등을 기록함.</div>
                ${reportData.reportContent.replace(/\n/g, '<br/>')}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid black; padding: 20px; position: relative;" colSpan="4">
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-align: center;">위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.</div>
                <div style="font-size: 12px; margin-bottom: 20px; text-align: center;">
                  ${reportData.submittedAt.substring(0, 4)}년 &nbsp; 
                  ${reportData.submittedAt.substring(5, 7)}월 &nbsp; 
                  ${reportData.submittedAt.substring(8, 10)}일
                </div>
                <div style="display: flex; justify-content: flex-end; align-items: center; padding-right: 40px; font-size: 12px; gap: 8px;">
                  <span>보호자 :</span>
                  <span style="font-weight: bold; color: #1e3a8a;">${userProfile.parentName || '학부모'}</span>
                  <span>(인)</span>
                  ${userProfile.parentSignature ? `<img src="${userProfile.parentSignature}" style="width: 45px; height: 45px; object-fit: contain; margin-left: 10px;" alt="sig" />` : ''}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const updatedContent = docData.content + reportHtml;

    // 3. Firestore 업데이트
    await firestoreUpdateDoc(docRef, {
      parentFormData: updatedParentFormData,
      content: updatedContent,
      reportSubmitted: true,
      reportSubmittedAt: reportData.submittedAt,
      updatedAt: serverTimestamp()
    });

    // 4. 감사 로그 기록
    createAuditLog(
      originalDocId,
      docData.docNo || '',
      docData.title,
      'approve',
      {
        uid: userProfile.uid,
        name: userProfile.parentName || userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
      }
    );

    return { success: true };
  } catch (error: any) {
    console.error("Error submitting field trip report:", error);
    return { success: false, error: error.message };
  }
}


