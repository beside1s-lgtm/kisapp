import * as XLSX from 'xlsx';
import { getGoogleDriveConfig, saveGoogleDriveConfig } from '@/lib/services/settingsService';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/pe/types';
import { getPapsGrade, calculatePapsScore } from '@/lib/pe/paps';

export interface PeArchiveExportOptions {
  mode: 'grade6-graduation' | 'all-paps';
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  academicYear?: string;
  updaterEmail?: string;
}

export interface PeArchiveExportResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  folderUrl?: string;
  error?: string;
}

const papsFactors: Record<string, string> = {
  '왕복오래달리기': '심폐지구력',
  '오래달리기': '심폐지구력',
  '윗몸 말아올리기': '근력/근지구력',
  '팔굽혀펴기': '근력/근지구력',
  '무릎 대고 팔굽혀펴기': '근력/근지구력',
  '악력': '근력/근지구력',
  '앉아윗몸앞으로굽히기': '유연성',
  '50m 달리기': '순발력',
  '제자리 멀리뛰기': '순발력',
  '체질량지수(BMI)': '체질량지수(BMI)',
};

/**
 * 학생 1명의 5대 PAPS 체력요인별 최신 측정치 및 등급을 계산
 */
function evaluateStudentPaps(student: Student, allRecords: MeasurementRecord[], allItems: MeasurementItem[]) {
  const studentRecords = allRecords.filter(r => r.studentId === student.id);
  const factorMap: Record<string, { value: number; grade: number; score: number; itemName: string; unit: string }> = {};

  const papsItems = allItems.filter(i => i.isPaps);

  papsItems.forEach(item => {
    const factor = papsFactors[item.name] || item.category || '기타';
    const recs = studentRecords.filter(r => r.item === item.name || (r as any).itemId === item.id);
    if (recs.length === 0) return;

    // 최신 기록
    const latest = recs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const stdMock = { grade: student.grade, gender: ((student.gender as any) === 'Female' || student.gender === '여') ? '여' : '남' } as any;
    const grade = getPapsGrade(item.name, stdMock, latest.value);
    const score = calculatePapsScore(item.name, stdMock, latest.value);

    if (!factorMap[factor] || new Date(latest.date) > new Date((factorMap[factor] as any).date || '1970-01-01')) {
      factorMap[factor] = {
        value: latest.value,
        grade: grade ?? 5,
        score: score ?? 0,
        itemName: item.name,
        unit: item.unit || '',
      };
    }
  });

  // 5대 요인 점수 합산 및 종합 등급
  const factors = ['심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)'];
  let totalScore = 0;
  let evaluatedCount = 0;

  factors.forEach(f => {
    if (factorMap[f]) {
      totalScore += factorMap[f].score;
      evaluatedCount++;
    }
  });

  // 종합등급 산출 (점수 기준: 1등급 17~20점, 2등급 13~16점, 3등급 9~12점, 4등급 5~8점, 5등급 4점 이하)
  let finalGrade = '-';
  if (evaluatedCount >= 4) { // 4개 이상 측정 시 종합 등급 산출
    if (totalScore >= 17) finalGrade = '1등급';
    else if (totalScore >= 13) finalGrade = '2등급';
    else if (totalScore >= 9) finalGrade = '3등급';
    else if (totalScore >= 5) finalGrade = '4등급';
    else finalGrade = '5등급';
  }

  return {
    factorMap,
    totalScore,
    finalGrade,
    evaluatedCount,
  };
}

/**
 * 체육 측정 결과를 엑셀로 생성하여 Google Drive의 '06_체육 측정 결과' 폴더에 자동 아카이빙
 */
export async function exportPeToGoogleDrive(options: PeArchiveExportOptions): Promise<PeArchiveExportResult> {
  const { mode, allStudents, allItems, allRecords, updaterEmail } = options;

  try {
    // 1. Google Drive 설정 확인
    let driveConfig = await getGoogleDriveConfig();
    if (!driveConfig.enabled || !driveConfig.rootFolderId) {
      return {
        success: false,
        error: 'Google Drive 중앙 저장소가 연동되어 있지 않습니다. 시스템 관리자 설정에서 Google Drive 연동을 먼저 활성화해 주세요.'
      };
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const academicYear = options.academicYear || String(currentMonth >= 3 ? currentYear : currentYear - 1);

    // 06_체육 측정 결과 폴더 확인 및 필요 시 자동 동기화
    let peResultsId = driveConfig.yearlyFolders?.[academicYear]?.peResultsId;
    let peResultsUrl = driveConfig.yearlyFolders?.[academicYear]?.peResultsUrl;

    if (!peResultsId) {
      // sync-folders API 호출하여 자동 생성
      const syncRes = await fetch('/api/drive/sync-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootFolderId: driveConfig.rootFolderId,
          academicYear
        })
      });
      const syncData = await syncRes.json();
      if (syncData.success && syncData.yearFolders) {
        peResultsId = syncData.yearFolders.peResultsId;
        peResultsUrl = syncData.yearFolders.peResultsUrl;
        // 설정 동기화 저장
        const nextCfg = {
          ...driveConfig,
          yearlyFolders: {
            ...(driveConfig.yearlyFolders || {}),
            [academicYear]: syncData.yearFolders
          }
        };
        await saveGoogleDriveConfig(nextCfg, updaterEmail || '체육교사');
      }
    }

    if (!peResultsId) {
      return {
        success: false,
        error: '06_체육 측정 결과 폴더 ID를 확인하거나 생성하지 못했습니다. 중앙 저장소 권한을 확인해 주세요.'
      };
    }

    // 2. 엑셀 워크북(XLSX) 데이터 생성
    const wb = XLSX.utils.book_new();
    const todayStr = new Date().toISOString().split('T')[0];
    let fileName = '';

    if (mode === 'grade6-graduation') {
      // ─── 6학년 졸업 사정회용 체력 평가 결과 ───
      fileName = `${academicYear}학년도_6학년_졸업사정회_체력평가결과_${todayStr}.xlsx`;

      const grade6Students = allStudents
        .filter(s => String(s.grade) === '6')
        .sort((a, b) => {
          const cA = Number(a.classNum) || 0;
          const cB = Number(b.classNum) || 0;
          if (cA !== cB) return cA - cB;
          const nA = Number(a.studentNum) || 0;
          const nB = Number(b.studentNum) || 0;
          return nA - nB;
        });

      const rows: (string | number)[][] = [
        ['호치민시한국국제학교 6학년 졸업 사정회 체력 평가(PAPS) 결과표'],
        [`[ 학년도: ${academicYear}학년도 | 출력일자: ${todayStr} | 대상: 6학년 전원 (${grade6Students.length}명) ]`],
        [],
        [
          '반',
          '번호',
          '성명',
          '성별',
          '심폐지구력 (측정값)',
          '심폐지구력 (등급)',
          '유연성 (측정값)',
          '유연성 (등급)',
          '근력/근지구력 (측정값)',
          '근력/근지구력 (등급)',
          '순발력 (측정값)',
          '순발력 (등급)',
          '체질량지수 BMI (측정값)',
          '체질량지수 (등급)',
          '종합점수 (20점 만점)',
          '최종 체력등급 (졸업사정회 제출용)'
        ]
      ];

      grade6Students.forEach(st => {
        const evalData = evaluateStudentPaps(st, allRecords, allItems);
        const fm = evalData.factorMap;

        rows.push([
          st.classNum ? `${st.classNum}반` : '-',
          st.studentNum ? `${st.studentNum}번` : '-',
          st.name,
          ((st.gender as any) === 'Female' || st.gender === '여') ? '여' : '남',
          fm['심폐지구력'] ? `${fm['심폐지구력'].value}${fm['심폐지구력'].unit}` : '-',
          fm['심폐지구력'] ? `${fm['심폐지구력'].grade}등급` : '-',
          fm['유연성'] ? `${fm['유연성'].value}${fm['유연성'].unit}` : '-',
          fm['유연성'] ? `${fm['유연성'].grade}등급` : '-',
          fm['근력/근지구력'] ? `${fm['근력/근지구력'].value}${fm['근력/근지구력'].unit}` : '-',
          fm['근력/근지구력'] ? `${fm['근력/근지구력'].grade}등급` : '-',
          fm['순발력'] ? `${fm['순발력'].value}${fm['순발력'].unit}` : '-',
          fm['순발력'] ? `${fm['순발력'].grade}등급` : '-',
          fm['체질량지수(BMI)'] ? `${fm['체질량지수(BMI)'].value}` : '-',
          fm['체질량지수(BMI)'] ? `${fm['체질량지수(BMI)'].grade}등급` : '-',
          evalData.evaluatedCount > 0 ? `${evalData.totalScore}점` : '-',
          evalData.finalGrade
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // 열 너비 설정
      ws['!cols'] = [
        { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 6 },
        { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
        { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
        { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, '6학년_졸업사정회_결과');

    } else {
      // ─── 전교생 PAPS 종합 측정 결과 ───
      fileName = `${academicYear}학년도_PAPS_전교생_체육측정결과_${todayStr}.xlsx`;

      // 4~6학년 대상 학생 정렬
      const targetStudents = allStudents
        .filter(s => ['4', '5', '6'].includes(String(s.grade)))
        .sort((a, b) => {
          const gA = Number(a.grade) || 0;
          const gB = Number(b.grade) || 0;
          if (gA !== gB) return gA - gB;
          const cA = Number(a.classNum) || 0;
          const cB = Number(b.classNum) || 0;
          if (cA !== cB) return cA - cB;
          const nA = Number(a.studentNum) || 0;
          const nB = Number(b.studentNum) || 0;
          return nA - nB;
        });

      const rows: (string | number)[][] = [
        ['호치민시한국국제학교 PAPS 학생건강체력평가 종합 결과 보고서'],
        [`[ 학년도: ${academicYear}학년도 | 측정일자: ${todayStr} | 총원: ${targetStudents.length}명 ]`],
        [],
        [
          '학년',
          '반',
          '번호',
          '성명',
          '성별',
          '심폐지구력 (등급)',
          '유연성 (등급)',
          '근력/근지구력 (등급)',
          '순발력 (등급)',
          '체질량지수 (등급)',
          '종합점수',
          '종합등급'
        ]
      ];

      targetStudents.forEach(st => {
        const evalData = evaluateStudentPaps(st, allRecords, allItems);
        const fm = evalData.factorMap;

        rows.push([
          `${st.grade}학년`,
          `${st.classNum}반`,
          st.studentNum ? `${st.studentNum}번` : '-',
          st.name,
          ((st.gender as any) === 'Female' || st.gender === '여') ? '여' : '남',
          fm['심폐지구력'] ? `${fm['심폐지구력'].grade}등급` : '-',
          fm['유연성'] ? `${fm['유연성'].grade}등급` : '-',
          fm['근력/근지구력'] ? `${fm['근력/근지구력'].grade}등급` : '-',
          fm['순발력'] ? `${fm['순발력'].grade}등급` : '-',
          fm['체질량지수(BMI)'] ? `${fm['체질량지수(BMI)'].grade}등급` : '-',
          evalData.evaluatedCount > 0 ? `${evalData.totalScore}점` : '-',
          evalData.finalGrade
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 6 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'PAPS_종합결과');
    }

    // 3. 엑셀을 Buffer/Blob으로 변환
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // 4. POST /api/drive/upload-file 호출하여 Google Drive에 업로드
    const formData = new FormData();
    formData.append('folderId', peResultsId);
    formData.append('file', file);

    const uploadRes = await fetch('/api/drive/upload-file', {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();

    if (!uploadData.success) {
      return {
        success: false,
        error: uploadData.error || 'Google Drive 업로드 중 오류가 발생했습니다.'
      };
    }

    return {
      success: true,
      fileId: uploadData.file?.id,
      fileName,
      webViewLink: uploadData.file?.webViewLink,
      folderUrl: peResultsUrl
    };

  } catch (err: any) {
    console.error('[peDriveArchiveService] export error:', err);
    return {
      success: false,
      error: err.message || '체육 결과 Google Drive 아카이빙 중 오류가 발생했습니다.'
    };
  }
}
