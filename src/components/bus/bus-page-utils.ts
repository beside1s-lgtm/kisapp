import type { Bus } from '@/lib/kisbus/types';

/**
 * teacher/bus/page.tsx에서 여러 하위 컴포넌트가 공유하는 순수 유틸 함수.
 * 페이지 분리 작업 중 별도 파일로 옮겨서 각 하위 컴포넌트가 동일하게
 * import해서 쓸 수 있도록 했다 (로직 자체는 원본과 동일, 동작 변경 없음).
 */
export const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt((a.name || '').replace(/\D/g, ''), 10);
    const numB = parseInt((b.name || '').replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
};

export const getGradeValue = (grade: string): number => {
  const upperGrade = (grade || '').trim().toUpperCase();
  if (upperGrade === 'S') return -50;
  if (upperGrade.startsWith('S')) {
      const num = parseInt(upperGrade.replace('S', ''), 10);
      return isNaN(num) ? -50 : -50 + (num / 100);
  }
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? -100 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};
