import { getDb } from '@/lib/firebase';
import { getKisbusDb } from '@/lib/kisbus/firebase';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, query, where 
} from 'firebase/firestore';
import type { MasterStudent, NewMasterStudent } from '@/lib/types/masterStudent';

const COLLECTION_NAME = 'master_students';

// 학생 계정 이메일 정규표현식 검증 유틸 (예: 2023kangdongyun@kshcm.net - 입학년도 4자리 + 영문이름 + @kshcm.net)
const STUDENT_EMAIL_REGEX = /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i;

export const isStudentEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  // 교직원 및 관리자 계정 배제
  if (lower === 'beside1s@kshcm.net' || lower.startsWith('teacher') || lower.startsWith('admin')) {
    return false;
  }
  // 입학년도 4자리 + 영문이름 + @kshcm.net 규칙만 허용 (예: 2023kangdongyun@kshcm.net)
  return /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i.test(lower);
};

export const getAllMasterStudents = async (): Promise<MasterStudent[]> => {
  try {
    const [masterSnap, userSnap] = await Promise.all([
      getDocs(collection(getDb(), COLLECTION_NAME)),
      getDocs(collection(getDb(), 'users')),
    ]);
    
    const map = new Map<string, MasterStudent>();
    
    userSnap.docs.forEach(doc => {
      const u = doc.data();
      const email = (u.email || doc.id || '').trim().toLowerCase();
      // 교직원 계정 배제
      const isStaff = Boolean(u.isFaculty || u.dept || (u.role && !['학부모', '학생', 'parent', 'student'].includes(u.role)));
      if (isStaff) return;

      // 학년 정보가 없으면 임의로 1학년 1반에 배치하지 않고 배제
      const grade = u.grade || u.studentGrade;
      if (!grade) return;

      if (email && isStudentEmail(email)) {
        const studentName = u.studentName || u.nameKo || u.name || '';
        if (!studentName || studentName === '사용자' || studentName === '학생') return;

        map.set(email, {
          studentEmail: email,
          studentId: doc.id,
          name: studentName,
          nameKo: studentName,
          grade: String(grade),
          classNum: String(u.classNum || u.class || u.studentClass || '1'),
          studentNum: String(u.studentNum || u.number || u.studentNumber || ''),
          gender: u.gender === 'Female' || u.gender === 'female' || u.gender === '여' ? 'Female' : 'Male',
          contact: u.phone || u.parentPhone || u.contact || '',
          parentEmail: u.parentEmail || '',
          address: u.address || u.residenceDestinationId || '',
          kisbusNo: u.kisbusNo || '',
          photoUrl: u.photoUrl || '',
          peStudentId: u.peStudentId || '',
        } as MasterStudent);
      }
    });

    masterSnap.docs.forEach(doc => {
      const s = doc.data();
      const email = (s.studentEmail || s.email || '').trim().toLowerCase();
      const key = email || doc.id;
      const existing = email ? map.get(email) : map.get(doc.id);
      const studentName = s.nameKo || s.name || s.studentName || existing?.nameKo || existing?.name || '';
      
      map.set(key, {
        ...existing,
        ...s,
        id: doc.id,
        studentId: doc.id,
        studentEmail: email || existing?.studentEmail || '',
        name: studentName || '학생',
        nameKo: studentName || '학생',
        grade: String(s.grade || s.studentGrade || existing?.grade || '1'),
        classNum: String(s.classNum || s.class || s.studentClass || existing?.classNum || '1'),
        studentNum: String(s.studentNum || s.number || s.studentNumber || existing?.studentNum || ''),
        gender: s.gender === 'Female' || s.gender === 'female' || s.gender === '여' ? 'Female' : 'Male',
        photoUrl: s.photoUrl || (existing as any)?.photoUrl || '',
        peStudentId: (s as any).peStudentId || (existing as any)?.peStudentId || '',
      } as MasterStudent);
    });

    // 이름이 없는 학생 데이터 필터링 또는 정리
    return Array.from(map.values()).filter(s => s.name && s.name !== '학생');
  } catch (err) {
    console.error('getAllMasterStudents error:', err);
    return [];
  }
};

// 1. 실시간 전체 통합 학생 마스터 구독 (입학년도 규칙을 만족하는 실제 등록 학생만 수신)
export const onMasterStudentsUpdate = (callback: (students: MasterStudent[]) => void) => {
  let masterList: MasterStudent[] = [];
  let userList: MasterStudent[] = [];
  let busStudentList: any[] = [];
  let destinationList: any[] = [];
  let routeList: any[] = [];
  let busList: any[] = [];
  let afterschoolCourseList: any[] = [];
  let afterschoolEnrollmentList: any[] = [];
  let afterschoolClassroomList: any[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, MasterStudent>();
    const destMap = new Map<string, string>();
    destinationList.forEach(d => {
      if (d.id) destMap.set(d.id, d.name || d.id);
    });

    const busNameMap = new Map<string, string>();
    busList.forEach(b => {
      if (b.id) busNameMap.set(b.id, b.name || b.id);
    });

    const classroomMap = new Map<string, string>();
    afterschoolClassroomList.forEach(c => {
      if (c.id) classroomMap.set(c.id, c.name || c.id);
    });

    const courseMap = new Map<string, any>();
    afterschoolCourseList.forEach(c => {
      if (c.id) courseMap.set(c.id, c);
    });

    // 1. users 컬렉션 (시스템에 직접 등록된 실제 학생 계정만 필터링)
    userList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        map.set(key, s);
      }
    });

    // 2. master_students 컬렉션 (통합 마스터 학생 DB)
    masterList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        const existing = map.get(key);
        map.set(key, { ...existing, ...s });
      }
    });

    // 3. 방과후 수강 신청 및 스쿨버스 학생 & 목적지 & 노선 정보와 양방향 100% 통합 매칭
    map.forEach((master, key) => {
      // (1) 방과후 수강 신청 실시간 연동 매칭
      const matchedEnrollments = afterschoolEnrollmentList.filter(e => {
        if (e.status === 'CANCELLED') return false;
        const idMatches = e.studentId && (e.studentId === master.studentId || e.studentId.toLowerCase() === master.studentEmail.toLowerCase());
        const nameMatches = (e.name === master.name || e.name === master.nameKo);
        const gradeClassMatches = String(e.grade) === String(master.grade) && String(e.classNum || e.class) === String(master.classNum);
        const phoneMatches = master.contact && e.parentPhone && master.contact.replace(/\D/g, '') === e.parentPhone.replace(/\D/g, '');
        const kisbusNoMatches = master.kisbusNo && e.kisbusNo && master.kisbusNo === e.kisbusNo;
        return idMatches || (nameMatches && gradeClassMatches) || (nameMatches && phoneMatches) || kisbusNoMatches;
      });

      const enrolledCourses = matchedEnrollments.map(e => {
        const c = courseMap.get(e.courseId) || {} as any;
        const days = (e.selectedDays && e.selectedDays.length > 0) ? e.selectedDays : (c.classDays || []);
        const classroom = c.classroom || (c.classroomId ? classroomMap.get(c.classroomId) : '') || '';
        return {
          courseId: e.courseId,
          title: c.title || e.courseTitle || '방과후 강좌',
          days: Array.isArray(days) ? days : [String(days)],
          classroom: classroom || undefined,
          classTime: c.classTime || undefined,
          instructorName: c.instructorName || undefined,
          kisbusNo: e.kisbusNo || c.kisbusDepartureTime || undefined,
        };
      });

      const enrolledCourseIds = enrolledCourses.map(c => c.courseId);
      const enrolledCourseTitles = enrolledCourses.map(c => c.title);
      const totalTuition = matchedEnrollments.reduce((sum, e) => sum + (Number(e.tuition) || 0) + (Number(e.materialFee) || 0) + (Number(e.textbookFee) || 0), 0);

      master.afterschoolSummary = {
        enrolledCourseIds,
        enrolledCourseTitles,
        enrolledCourses,
        totalTuition,
        paymentStatus: (master.afterschoolSummary?.paymentStatus as any) || (totalTuition > 0 ? 'UNPAID' : 'PAID')
      };

      // (2) 스쿨버스 거주지(주소) 명칭 동기화
      if (master.address && destMap.has(master.address)) {
        master.address = destMap.get(master.address)!;
      }

      // 스쿨버스 학생 매칭
      const matchedBusStudent = busStudentList.find(bs => {
        const nameMatches = bs.name === master.name || bs.nameKo === master.name || (bs.name && bs.name.includes(master.name));
        const gradeClassMatches = String(bs.grade) === String(master.grade) && String(bs.class) === String(master.classNum);
        const contactMatches = master.contact && bs.contact && master.contact.replace(/\D/g, '') === bs.contact.replace(/\D/g, '');
        const kisbusNoMatches = master.kisbusNo && bs.kisbusNo && master.kisbusNo === bs.kisbusNo;
        return (nameMatches && gradeClassMatches) || (nameMatches && contactMatches) || kisbusNoMatches || nameMatches;
      });

      let morningDestId: string | null = null;
      let afternoonDestId: string | null = null;
      let assignedBusName: string | null = null;
      let assignedBusId: string | null = null;
      let assignedSeatNumber: number | null = null;

      if (matchedBusStudent) {
        morningDestId = matchedBusStudent.morningDestinationId || matchedBusStudent.suggestedMorningDestination || null;
        afternoonDestId = matchedBusStudent.afternoonDestinationId || matchedBusStudent.suggestedAfternoonDestination || null;
        const destName = (morningDestId ? (destMap.get(morningDestId) || morningDestId) : null) || 
                         (afternoonDestId ? (destMap.get(afternoonDestId) || afternoonDestId) : null);

        if ((!master.address || destMap.has(master.address)) && destName) {
          master.address = destName;
        }

        for (const route of routeList) {
          const seat = (route.seating || []).find((se: any) => se.studentId === matchedBusStudent.id);
          if (seat) {
            assignedBusId = route.busId || null;
            assignedBusName = busNameMap.get(route.busId) || null;
            assignedSeatNumber = seat.seatNumber || null;
            break;
          }
        }
      }

      // (3) 다중 스쿨버스 노선 분리 산출 (정규 하교 버스 + 방과후 수강 요일별 버스)
      const afterSchoolDays = Array.from(new Set(enrolledCourses.flatMap(c => c.days || [])));
      const weekdays = ['월', '화', '수', '목', '금'];
      const regularBusDays = weekdays.filter(day => !afterSchoolDays.includes(day));

      let regularBusName: string | null = null;
      if (matchedBusStudent) {
        const afternoonRoute = routeList.find((r: any) => 
          r.type === 'Afternoon' && (r.seating || []).some((se: any) => se.studentId === matchedBusStudent.id)
        );
        if (afternoonRoute) {
          regularBusName = busNameMap.get(afternoonRoute.busId) || afternoonRoute.name || null;
        } else if (matchedBusStudent.afternoonDestinationId) {
          const destRoute = routeList.find((r: any) => 
            r.type === 'Afternoon' && (r.destinationIds || []).includes(matchedBusStudent.afternoonDestinationId)
          );
          if (destRoute) {
            regularBusName = busNameMap.get(destRoute.busId) || destRoute.name || null;
          }
        }
      }
      if (!regularBusName) {
        regularBusName = assignedBusName || master.busSummary?.assignedBusName || null;
      }

      const afterSchoolBuses: { day: string; busName: string; courseTitle?: string }[] = [];
      for (const day of afterSchoolDays) {
        const courseOnDay = enrolledCourses.find(c => c.days?.includes(day));
        let busForDay: string | null = null;

        if (matchedBusStudent) {
          const asRoute = routeList.find((r: any) => {
            if (r.type !== 'AfterSchool') return false;
            if (r.operatingDays && Array.isArray(r.operatingDays) && !r.operatingDays.includes(day)) return false;
            return (r.seating || []).some((se: any) => {
              if (se.studentId !== matchedBusStudent.id) return false;
              if (se.days && Array.isArray(se.days) && !se.days.includes(day)) return false;
              return true;
            });
          });
          if (asRoute) {
            busForDay = busNameMap.get(asRoute.busId) || asRoute.name || null;
          }

          if (!busForDay && matchedBusStudent.afterSchoolDestinations?.[day]) {
            const destId = matchedBusStudent.afterSchoolDestinations[day];
            const destRoute = routeList.find((r: any) => 
              r.type === 'AfterSchool' && (r.destinationIds || []).includes(destId)
            );
            if (destRoute) {
              busForDay = busNameMap.get(destRoute.busId) || destRoute.name || null;
            }
          }
        }

        if (!busForDay && courseOnDay?.kisbusNo) {
          busForDay = courseOnDay.kisbusNo;
        }

        if (busForDay) {
          afterSchoolBuses.push({
            day,
            busName: busForDay,
            courseTitle: courseOnDay?.title
          });
        }
      }

      master.busSummary = {
        ...(master.busSummary || {}),
        morningDestinationId: morningDestId,
        afternoonDestinationId: afternoonDestId,
        assignedBusId,
        assignedBusName: assignedBusName || regularBusName || master.busSummary?.assignedBusName || null,
        assignedSeatNumber,
        afterSchoolDestinations: matchedBusStudent?.afterSchoolDestinations || master.busSummary?.afterSchoolDestinations || {},
        regularBusName: regularBusName || null,
        regularBusDays,
        afterSchoolBuses,
      };
    });

    callback(Array.from(map.values()));
  };

  // 1. master_students 실시간 리스너
  const unsubMaster = onSnapshot(collection(getDb(), COLLECTION_NAME), (snapshot) => {
    masterList = snapshot.docs.map(doc => ({
      studentId: doc.id,
      ...doc.data()
    } as MasterStudent));
    mergeAndEmit();
  }, (err) => console.error('master_students snapshot error:', err));

  // 2. users 실시간 리스너
  const unsubUsers = onSnapshot(collection(getDb(), 'users'), (snapshot) => {
    const rawUsers = snapshot.docs.map(doc => {
      const data = doc.data();
      const userEmail = (data.email || doc.id || '').trim();
      return {
        ...data,
        docId: doc.id,
        email: userEmail
      };
    });

    const filtered = rawUsers.filter((u: any) => {
      if (!isStudentEmail(u.email)) return false;
      const isStaff = Boolean(u.isFaculty || u.dept || (u.role && !['학부모', '학생', 'parent', 'student'].includes(u.role)));
      if (isStaff) return false;
      // 학년 정보가 없는 계정은 1학년 1반 기본값으로 생성하지 않고 제외
      const grade = u.grade || u.studentGrade;
      if (!grade) return false;
      const studentName = u.studentName || u.nameKo || u.name || '';
      if (!studentName || studentName === '사용자' || studentName === '학생') return false;
      return true;
    });
    
    userList = filtered.map((u: any) => ({
      studentEmail: u.email,
      studentId: u.docId || u.email,
      name: u.studentName || u.nameKo || u.name,
      nameKo: u.studentName || u.nameKo || u.name,
      grade: String(u.grade || u.studentGrade),
      classNum: String(u.class || u.classNum || u.studentClass || '1'),
      studentNum: String(u.number || u.studentNum || u.studentNumber || ''),
      gender: u.gender === 'Female' || u.gender === '여' ? 'Female' : 'Male',
      contact: u.phone || u.parentPhone || u.contact || '',
      parentEmail: u.parentEmail || '',
      address: u.address || u.residenceDestinationId || '',
      kisbusNo: u.kisbusNo || '',
      afterschoolSummary: {
        enrolledCourseIds: [],
        enrolledCourseTitles: [],
        enrolledCourses: [],
      },
      busSummary: {
        assignedBusName: u.busName || null,
      }
    } as MasterStudent));

    mergeAndEmit();
  }, (err) => console.error('users snapshot error:', err));

  // 3. 스쿨버스 students 실시간 리스너
  const unsubBusStudents = onSnapshot(collection(getKisbusDb(), 'students'), (snapshot) => {
    busStudentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus students snapshot error:', err));

  // 4. 스쿨버스 destinations 실시간 리스너
  const unsubDestinations = onSnapshot(collection(getKisbusDb(), 'destinations'), (snapshot) => {
    destinationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus destinations snapshot error:', err));

  // 5. 스쿨버스 routes 실시간 리스너
  const unsubRoutes = onSnapshot(collection(getKisbusDb(), 'routes'), (snapshot) => {
    routeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus routes snapshot error:', err));

  // 6. 스쿨버스 buses 실시간 리스너
  const unsubBuses = onSnapshot(collection(getKisbusDb(), 'buses'), (snapshot) => {
    busList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus buses snapshot error:', err));

  // 7. 방과후 courses 실시간 리스너
  const unsubCourses = onSnapshot(collection(getDb(), 'afterschool_courses'), (snapshot) => {
    afterschoolCourseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_courses snapshot error:', err));

  // 8. 방과후 enrollments 실시간 리스너
  const unsubEnrollments = onSnapshot(collection(getDb(), 'afterschool_enrollments'), (snapshot) => {
    afterschoolEnrollmentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_enrollments snapshot error:', err));

  // 9. 방과후 classrooms 실시간 리스너
  const unsubClassrooms = onSnapshot(collection(getDb(), 'afterschool_classrooms'), (snapshot) => {
    afterschoolClassroomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_classrooms snapshot error:', err));

  return () => {
    unsubMaster();
    unsubUsers();
    unsubBusStudents();
    unsubDestinations();
    unsubRoutes();
    unsubBuses();
    unsubCourses();
    unsubEnrollments();
    unsubClassrooms();
  };
};

// 2. 단일 마스터 학생 생성 (users & master_students & kisbus students 동시 연동)
export const createMasterStudent = async (studentData: NewMasterStudent): Promise<string> => {
  const colRef = collection(getDb(), COLLECTION_NAME);
  const docRef = doc(colRef);
  const now = new Date().toISOString();
  
  const payload: MasterStudent = {
    ...studentData,
    studentId: docRef.id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, payload);

  // users 컬렉션에도 동시 등록/업데이트하여 연동 완벽 보장
  if (studentData.studentEmail) {
    const q = query(collection(getDb(), 'users'), where("email", "==", studentData.studentEmail.trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      await updateDoc(doc(getDb(), 'users', userDoc.id), {
        studentName: studentData.name,
        grade: studentData.grade,
        class: studentData.classNum,
        number: studentData.studentNum,
        phone: studentData.contact,
        address: studentData.address || '',
        photoUrl: studentData.photoUrl || ''
      });
    } else {
      const userRef = doc(collection(getDb(), 'users'));
      await setDoc(userRef, {
        email: studentData.studentEmail.trim(),
        name: studentData.name,
        studentName: studentData.name,
        grade: studentData.grade,
        class: studentData.classNum,
        number: studentData.studentNum,
        phone: studentData.contact,
        address: studentData.address || '',
        photoUrl: studentData.photoUrl || '',
        role: 'student'
      });
    }
  }

  // 스쿨버스 students 컬렉션에도 거주지 주소(목적지) 동기화
  if (studentData.address && studentData.name) {
    await syncAddressToKisbusStudent(studentData.name, studentData.grade, studentData.classNum, studentData.address, studentData.contact);
  }

  return docRef.id;
};

// 3. 마스터 학생 정보 수정 (기본 프로필 + users 컬렉션 + 스쿨버스 students 동시 양방향 업데이트)
export const updateMasterStudent = async (studentId: string, updateData: Partial<MasterStudent>): Promise<void> => {
  const docRef = doc(getDb(), COLLECTION_NAME, studentId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...updateData,
    updatedAt: now
  });

  // users 컬렉션 동시 업데이트
  if (updateData.studentEmail || updateData.name || updateData.grade || updateData.address || updateData.photoUrl !== undefined) {
    const emailToSearch = updateData.studentEmail || studentId;
    const q = query(collection(getDb(), 'users'), where("email", "==", emailToSearch.trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const payload: any = {};
      if (updateData.name) payload.studentName = updateData.name;
      if (updateData.grade) payload.grade = updateData.grade;
      if (updateData.classNum) payload.class = updateData.classNum;
      if (updateData.studentNum) payload.number = updateData.studentNum;
      if (updateData.contact) payload.phone = updateData.contact;
      if (updateData.address !== undefined) payload.address = updateData.address;
      if (updateData.photoUrl !== undefined) payload.photoUrl = updateData.photoUrl;
      await updateDoc(doc(getDb(), 'users', userDoc.id), payload);
    }
  }

  // 스쿨버스 students 컬렉션 동시 양방향 동기화
  if (updateData.name || updateData.address !== undefined) {
    const name = updateData.name;
    const grade = updateData.grade;
    const classNum = updateData.classNum;
    const address = updateData.address;
    const contact = updateData.contact;
    if (name && address) {
      await syncAddressToKisbusStudent(name, grade, classNum, address, contact);
    }
  }
};

// 스쿨버스 학생 목적지 동기화 헬퍼 함수
export const syncAddressToKisbusStudent = async (
  name: string, 
  grade?: string, 
  classNum?: string, 
  address?: string | null,
  contact?: string | null
) => {
  try {
    if (!name || !address) return;
    const busDb = getKisbusDb();
    
    // 1. 목적지 목록에서 목적지 ID 조회
    const destSnap = await getDocs(collection(busDb, 'destinations'));
    const destinations = destSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const matchedDest = destinations.find((d: any) => d.name === address || d.id === address);
    const destIdToSet = matchedDest ? matchedDest.id : address;

    // 2. 스쿨버스 students 컬렉션에서 학생 조회
    const studSnap = await getDocs(collection(busDb, 'students'));
    const busStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targetStudent = busStudents.find((s: any) => {
      const nameMatches = s.name === name || s.nameKo === name || (s.name && s.name.includes(name));
      const gradeMatches = !grade || String(s.grade) === String(grade);
      const classMatches = !classNum || String(s.class) === String(classNum);
      return nameMatches && gradeMatches && classMatches;
    }) || busStudents.find((s: any) => s.name === name || s.nameKo === name);

    if (targetStudent) {
      await updateDoc(doc(busDb, 'students', targetStudent.id), {
        morningDestinationId: destIdToSet,
        afternoonDestinationId: destIdToSet,
        suggestedMorningDestination: destIdToSet,
        suggestedAfternoonDestination: destIdToSet,
        contact: contact ? contact.replace(/\D/g, '') : (targetStudent as any).contact
      });
    }
  } catch (err) {
    console.error("Error syncing address to kisbus student:", err);
  }
};

// 4. 마스터 학생 삭제
export const deleteMasterStudent = async (studentId: string): Promise<void> => {
  const docRef = doc(getDb(), COLLECTION_NAME, studentId);
  await deleteDoc(docRef);
};

// 5. 전교생 엑셀 일괄 동기화 (Batch Import)
export const batchImportMasterStudents = async (students: NewMasterStudent[]): Promise<number> => {
  const batch = writeBatch(getDb());
  const colRef = collection(getDb(), COLLECTION_NAME);
  let count = 0;
  const now = new Date().toISOString();

  students.forEach((s) => {
    if (!isStudentEmail(s.studentEmail)) return;
    const docRef = doc(colRef);
    const payload: MasterStudent = {
      ...s,
      studentId: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(docRef, payload);
    count++;
  });

  await batch.commit();
  return count;
};

// 6. 학년/반 일괄 진급 처리 (Grade Advancement Batch Update + Automatic Academic Year Archiving)
export const batchPromoteStudents = async (advancements: { studentEmail: string; newGrade: string; newClassNum: string; newStudentNum: string }[]): Promise<number> => {
  const batch = writeBatch(getDb());
  let count = 0;
  const currentYear = new Date().getFullYear();
  const previousAcademicYear = currentYear - 1; // 진급 전 학학년도 (예: 2025학년도)

  for (const item of advancements) {
    if (!item.studentEmail) continue;
    const qMaster = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", item.studentEmail.trim()));
    const snapMaster = await getDocs(qMaster);
    snapMaster.forEach(d => {
      const data = d.data();
      const existingHistory = Array.isArray(data.academicHistory) ? data.academicHistory : [];
      
      // 진급 전 기존 학학년도의 학년/반/번호 아카이브 스냅샷 보존
      const alreadyArchived = existingHistory.some((h: any) => h.academicYear === previousAcademicYear);
      let updatedHistory = existingHistory;
      if (!alreadyArchived && data.grade) {
        updatedHistory = [
          ...existingHistory,
          {
            academicYear: previousAcademicYear,
            grade: String(data.grade),
            classNum: String(data.classNum || '1'),
            studentNum: String(data.studentNum || ''),
            archivedAt: new Date().toISOString()
          }
        ];
      }

      batch.update(doc(getDb(), COLLECTION_NAME, d.id), {
        grade: item.newGrade,
        classNum: item.newClassNum,
        studentNum: item.newStudentNum,
        academicHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });
    });

    const qUser = query(collection(getDb(), 'users'), where("email", "==", item.studentEmail.trim()));
    const snapUser = await getDocs(qUser);
    snapUser.forEach(d => {
      batch.update(doc(getDb(), 'users', d.id), {
        grade: item.newGrade,
        class: item.newClassNum,
        number: item.newStudentNum
      });
    });
    count++;
  }

  await batch.commit();
  return count;
};

// 7. 이메일 기반 단일 마스터 학생 조회
export const getMasterStudentByEmail = async (email: string): Promise<MasterStudent | null> => {
  if (!email) return null;
  const q = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", email.trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const firstDoc = snapshot.docs[0];
  return { studentId: firstDoc.id, ...firstDoc.data() } as MasterStudent;
};
