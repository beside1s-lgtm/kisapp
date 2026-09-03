
import type { MeasurementItem, Student } from './types';

// 1. PAPS 등급 기준표 (기존 유지)
export const papsGradeStandards: Record<
  string, // 학년
  Record<
    string, // 종목명
    {
      male: { grade: number; min: number; max: number }[];
      female: { grade: number; min: number; max: number }[];
      type: 'time' | 'count' | 'distance' | 'weight' | 'compound';
    }
  >
> = {
  // ... (기존 등급 기준 데이터)
    '4': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 96, max: Infinity }, { grade: 2, min: 69, max: 95 }, { grade: 3, min: 45, max: 68 }, { grade: 4, min: 26, max: 44 }, { grade: 5, min: 1, max: 25 } ],
      female: [ { grade: 1, min: 77, max: Infinity }, { grade: 2, min: 57, max: 76 }, { grade: 3, min: 40, max: 56 }, { grade: 4, min: 21, max: 39 }, { grade: 5, min: 1, max: 20 } ],
      type: 'count'
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 7, max: 21 }, { grade: 5, min: 0, max: 6 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 29, max: 59 }, { grade: 3, min: 18, max: 28 }, { grade: 4, min: 6, max: 17 }, { grade: 5, min: 0, max: 5 } ],
      type: 'count'
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8.0, max: Infinity }, { grade: 2, min: 5.0, max: 7.9 }, { grade: 3, min: 1.0, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14.0, max: Infinity }, { grade: 2, min: 10.0, max: 13.9 }, { grade: 3, min: 5.0, max: 9.9 }, { grade: 4, min: 2.0, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.8 }, { grade: 2, min: 8.9, max: 9.7 }, { grade: 3, min: 9.8, max: 10.5 }, { grade: 4, min: 10.6, max: 13.2 }, { grade: 5, min: 13.3, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 9.4 }, { grade: 2, min: 9.5, max: 10.4 }, { grade: 3, min: 10.5, max: 11.0 }, { grade: 4, min: 11.1, max: 13.3 }, { grade: 5, min: 13.4, max: Infinity } ],
      type: 'time'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 149, max: 169 }, { grade: 3, min: 130, max: 148 }, { grade: 4, min: 100, max: 129 }, { grade: 5, min: 10, max: 99 } ],
      female: [ { grade: 1, min: 161, max: Infinity }, { grade: 2, min: 135, max: 160 }, { grade: 3, min: 119, max: 134 }, { grade: 4, min: 97, max: 118 }, { grade: 5, min: 10, max: 96 } ],
      type: 'distance'
    },
    '악력': {
      male: [ { grade: 1, min: 31.0, max: Infinity }, { grade: 2, min: 18.5, max: 30.9 }, { grade: 3, min: 15.0, max: 18.4 }, { grade: 4, min: 11.5, max: 14.9 }, { grade: 5, min: 0, max: 11.4 } ],
      female: [ { grade: 1, min: 29.0, max: Infinity }, { grade: 2, min: 18.0, max: 28.9 }, { grade: 3, min: 13.5, max: 17.9 }, { grade: 4, min: 10.5, max: 13.4 }, { grade: 5, min: 0, max: 10.4 } ],
      type: 'weight'
    },
    '체질량지수(BMI)': {
        male: [ { grade: 1, min: 14.1, max: 18.0 }, { grade: 2, min: 18.1, max: 19.9 }, { grade: 3, min: 12.8, max: 14.0 }, { grade: 4, min: 20.0, max: 21.6 }, { grade: 5, min: 0, max: 12.7 }, { grade: 5, min: 21.7, max: Infinity } ],
        female: [ { grade: 1, min: 14.0, max: 18.2 }, { grade: 2, min: 18.3, max: 20.3 }, { grade: 3, min: 12.7, max: 13.9 }, { grade: 4, min: 20.4, max: 22.1 }, { grade: 5, min: 0, max: 12.6 }, { grade: 5, min: 22.2, max: Infinity } ],
        type: 'compound'
    }
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 100, max: Infinity }, { grade: 2, min: 73, max: 99 }, { grade: 3, min: 50, max: 72 }, { grade: 4, min: 29, max: 49 }, { grade: 5, min: 1, max: 28 } ],
        female: [ { grade: 1, min: 85, max: Infinity }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 1, max: 22 } ],
        type: 'count'
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 29, max: 59 }, { grade: 3, min: 18, max: 28 }, { grade: 4, min: 6, max: 17 }, { grade: 5, min: 0, max: 5 } ],
      type: 'count'
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8, max: Infinity }, { grade: 2, min: 5.0, max: 7.9 }, { grade: 3, min: 1.0, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14, max: Infinity }, { grade: 2, min: 10, max: 13.9 }, { grade: 3, min: 5.0, max: 9.9 }, { grade: 4, min: 2, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.5 }, { grade: 2, min: 8.6, max: 9.4 }, { grade: 3, min: 9.5, max: 10.2 }, { grade: 4, min: 10.3, max: 11.0 }, { grade: 5, min: 11.1, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 8.9 }, { grade: 2, min: 9.0, max: 9.9 }, { grade: 3, min: 10.0, max: 10.7 }, { grade: 4, min: 10.8, max: 11.5 }, { grade: 5, min: 11.6, max: Infinity } ],
      type: 'time'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 159, max: 179 }, { grade: 3, min: 141, max: 158 }, { grade: 4, min: 111, max: 140 }, { grade: 5, min: 10, max: 110 } ],
      female: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 139, max: 169 }, { grade: 3, min: 123, max: 138 }, { grade: 4, min: 100, max: 122 }, { grade: 5, min: 10, max: 99 } ],
      type: 'distance'
    },
    '악력': {
      male: [ { grade: 1, min: 31.0, max: Infinity }, { grade: 2, min: 23.0, max: 30.9 }, { grade: 3, min: 17.0, max: 22.9 }, { grade: 4, min: 12.5, max: 16.9 }, { grade: 5, min: 0, max: 12.4 } ],
      female: [ { grade: 1, min: 29.0, max: Infinity }, { grade: 2, min: 19.0, max: 28.9 }, { grade: 3, min: 15.5, max: 18.9 }, { grade: 4, min: 12.0, max: 15.4 }, { grade: 5, min: 0, max: 11.9 } ],
      type: 'weight'
    },
    '체질량지수(BMI)': {
        male: [ { grade: 1, min: 14.5, max: 18.9 }, { grade: 2, min: 19.0, max: 20.9 }, { grade: 3, min: 13.2, max: 14.4 }, { grade: 4, min: 21.0, max: 22.7 }, { grade: 5, min: 0, max: 13.1 }, { grade: 5, min: 22.8, max: Infinity } ],
        female: [ { grade: 1, min: 14.4, max: 19.2 }, { grade: 2, min: 19.3, max: 21.4 }, { grade: 3, min: 13.1, max: 14.3 }, { grade: 4, min: 21.5, max: 23.3 }, { grade: 5, min: 0, max: 13.0 }, { grade: 5, min: 23.4, max: Infinity } ],
        type: 'compound'
    }
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 104, max: Infinity }, { grade: 2, min: 78, max: 103 }, { grade: 3, min: 54, max: 77 }, { grade: 4, min: 32, max: 53 }, { grade: 5, min: 1, max: 31 } ],
      female: [ { grade: 1, min: 93, max: Infinity }, { grade: 2, min: 69, max: 84 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 1, max: 24 } ],
      type: 'count'
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 23, max: 42 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count'
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8, max: Infinity }, { grade: 2, min: 5, max: 7.9 }, { grade: 3, min: 1, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14, max: Infinity }, { grade: 2, min: 10, max: 13.9 }, { grade: 3, min: 5, max: 9.9 }, { grade: 4, min: 2, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.1 }, { grade: 2, min: 8.2, max: 9.0 }, { grade: 3, min: 9.1, max: 9.8 }, { grade: 4, min: 9.9, max: 10.6 }, { grade: 5, min: 10.7, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 8.9 }, { grade: 2, min: 9.0, max: 9.8 }, { grade: 3, min: 9.9, max: 10.7 }, { grade: 4, min: 10.8, max: 11.5 }, { grade: 5, min: 11.6, max: Infinity } ],
      type: 'time'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 200, max: Infinity }, { grade: 2, min: 167, max: 199 }, { grade: 3, min: 148, max: 166 }, { grade: 4, min: 122, max: 147 }, { grade: 5, min: 10, max: 121 } ],
      female: [ { grade: 1, min: 175, max: Infinity }, { grade: 2, min: 144, max: 174 }, { grade: 3, min: 127, max: 143 }, { grade: 4, min: 100, max: 126 }, { grade: 5, min: 10, max: 99 } ],
      type: 'distance'
    },
    '악력': {
      male: [ { grade: 1, min: 35.0, max: Infinity }, { grade: 2, min: 26.5, max: 34.9 }, { grade: 3, min: 19.0, max: 26.4 }, { grade: 4, min: 15.0, max: 18.9 }, { grade: 5, min: 0, max: 14.9 } ],
      female: [ { grade: 1, min: 33.0, max: Infinity }, { grade: 2, min: 22.0, max: 32.9 }, { grade: 3, min: 19.0, max: 21.9 }, { grade: 4, min: 14.0, max: 18.9 }, { grade: 5, min: 0, max: 13.9 } ],
      type: 'weight'
    },
     '체질량지수(BMI)': {
        male: [ { grade: 1, min: 15.0, max: 19.9 }, { grade: 2, min: 20.0, max: 21.9 }, { grade: 3, min: 13.6, max: 14.9 }, { grade: 4, min: 22.0, max: 23.8 }, { grade: 5, min: 0, max: 13.5 }, { grade: 5, min: 23.9, max: Infinity } ],
        female: [ { grade: 1, min: 14.9, max: 20.1 }, { grade: 2, min: 20.2, max: 22.4 }, { grade: 3, min: 13.5, max: 14.8 }, { grade: 4, min: 22.5, max: 24.4 }, { grade: 5, min: 0, max: 13.4 }, { grade: 5, min: 24.5, max: Infinity } ],
        type: 'compound'
    }
  },
  '7': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
  '8': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
  '9': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
  '10': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
  '11': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
  '12': {
    '왕복오래달리기': { male: [], female: [], type: 'count' },
    '윗몸 말아올리기': { male: [], female: [], type: 'count' },
    '앉아윗몸앞으로굽히기': { male: [], female: [], type: 'distance' },
    '팔굽혀펴기': { male: [], female: [], type: 'count' },
    '악력': { male: [], female: [], type: 'weight' },
    '체질량지수(BMI)': { male: [], female: [], type: 'compound' }
  },
};


// 2. 새로운 PAPS 비율 점수 기준표 (0점-20점)
const papsScoreStandards: Record<string, Record<string, {
    male: { min: number; max: number };
    female: { min: number; max: number };
    type: 'time' | 'count' | 'distance' | 'weight' | 'compound';
}>> = {
    '4': {
        '제자리 멀리뛰기': {
            male: { min: 87.4, max: 165.5 }, female: { min: 82.1, max: 154.2 }, type: 'distance'
        },
        '50m 달리기': {
            male: { min: 11.6, max: 9.0 }, female: { min: 12.1, max: 9.6 }, type: 'time'
        },
        '윗몸 말아올리기': {
            male: { min: 7.9, max: 37.0 }, female: { min: 4.8, max: 34.0 }, type: 'count'
        },
    },
    // 다른 학년 및 종목 기준 추가...
};


export const papsStandards: Record<string, { type: 'time' | 'count' | 'distance' | 'weight' | 'compound', unit: string }> = {};
Object.values(papsGradeStandards).forEach(gradeData => {
    Object.entries(gradeData).forEach(([itemName, itemData]) => {
        if (!papsStandards[itemName]) {
            papsStandards[itemName] = { type: itemData.type, unit: '단위' }; // 단위 정보는 새 기준표에서 가져와야 함
        }
    });
});

papsStandards['앉아윗몸앞으로굽히기'] = { type: 'distance', unit: 'cm' };
papsStandards['50m 달리기'] = { type: 'time', unit: '초' };
papsStandards['제자리 멀리뛰기'] = { type: 'distance', unit: 'cm' };
papsStandards['팔굽혀펴기'] = { type: 'count', unit: '회' };
papsStandards['악력'] = { type: 'weight', unit: 'kg' };
papsStandards['체질량지수(BMI)'] = { type: 'compound', unit: 'kg/m²' };
papsStandards['오래달리기'] = { type: 'time', unit: '초' };


export function getPapsGrade(item: string, student: Student, value: number): number | null {
  const gradeKey = student.grade;
  let gradeStandard = papsGradeStandards[gradeKey];
  
  if (!gradeStandard) {
    const gradeNum = parseInt(gradeKey);
    if (gradeNum >= 1 && gradeNum <= 3) {
      gradeStandard = papsGradeStandards['4'];
    } else {
      return null; 
    }
  }

  let standard = gradeStandard[item];
  if (item === '무릎 대고 팔굽혀펴기' && !standard) {
    standard = gradeStandard['팔굽혀펴기'];
  }

  if (!standard) return null;

  const thresholds = student.gender === '남' ? standard.male : standard.female;
  if (!thresholds || thresholds.length === 0) return null;

  for (const range of thresholds) {
    if (item === '체질량지수(BMI)') {
        if (value >= range.min && value <= range.max) {
            return range.grade;
        }
    } else if (standard.type === 'time') {
        if (value <= range.max && value >= range.min) {
            return range.grade;
        }
    } else {
        if (value >= range.min && value <= range.max) {
            return range.grade;
        }
    }
  }

  if (item === '체질량지수(BMI)') {
      const grade5Ranges = thresholds.filter(r => r.grade === 5);
      for (const range of grade5Ranges) {
          if (value >= range.min && value <= range.max) {
              return 5;
          }
      }
  }
  
  const isTimeType = standard.type === 'time';
  const sortedThresholds = [...thresholds].sort((a,b) => a.grade - b.grade);
  const grade1 = sortedThresholds[0];
  const grade5 = sortedThresholds[4];

  if (isTimeType) {
    if (value < grade1.max) return 1;
    if (value > grade5.min) return 5;
  } else {
    if (value > grade1.min) return 1;
    if (value < grade5.max) return 5;
  }
  
  return 5;
}


export function calculatePapsScore(item: string, student: Student, value: number): number | null {
    const gradeKey = student.grade;
    const standard = papsScoreStandards[gradeKey]?.[item];
    
    if (!standard) {
        // 임시: 기준표에 없는 종목은 등급 기반으로 점수 환산
        const grade = getPapsGrade(item, student, value);
        if (grade === null) return null;
        if (item === '체질량지수(BMI)') {
            if (grade === 1) return 20; // 정상
            if (grade === 2 || grade === 3) return 15; // 과체중/저체중
            return 10; // 비만/심한 저체중
        }
        return Math.max(0, (5 - grade) * 4); // 1등급->16점, 5등급->0점, 대략적 환산
    }

    const thresholds = student.gender === '남' ? standard.male : standard.female;
    const { type } = standard;
    const { min, max } = thresholds;

    let score = 0;
    const range = thresholds.max - thresholds.min;
    
    if (range === 0) {
        return value >= thresholds.max ? 20 : 0;
    }

    if (type === 'time') { // 낮을수록 좋은 기록
        if (value <= thresholds.max) {
            score = 20;
        } else if (value >= thresholds.min) {
            score = 0;
        } else {
            score = ((thresholds.min - value) / (thresholds.min - thresholds.max)) * 20;
        }
    } else { // 높을수록 좋은 기록
        if (value >= thresholds.max) {
            score = 20;
        } else if (value <= thresholds.min) {
            score = 0;
        } else {
            score = ((value - thresholds.min) / range) * 20;
        }
    }
    
    return Math.round(Math.max(0, Math.min(20, score)));
}

export function getCustomItemGrade(item: MeasurementItem, value: number): number | null {
  if (item.isPaps || item.recordType === 'time') {
    return null;
  }
  
  if (item.recordType === 'level') {
    if(value === 1) return 1;
    if(value === 2) return 3; // '중'을 3등급으로 매핑
    if(value === 3) return 5; // '하'를 5등급으로 매핑
    return null;
  }
  
  if (!item.goal) return null;

  const percentage = (value / item.goal) * 100;

  if (percentage >= 100) return 1;
  if (percentage >= 75) return 2;
  if (percentage >= 50) return 3;
  if (percentage >= 25) return 4;
  return 5;
}

export function normalizePapsRecord(grade: number, value: number, item: string, student: Student): number {
    const score = calculatePapsScore(item, student, value);
    if (score === null) return (5 - grade) * 25; // Fallback
    return score * 5; // 20점 만점을 100점 만점으로
}

export function normalizeCustomRecord(item: MeasurementItem, value: number): number {
    if (item.recordType === 'level') {
        if (value === 1) return 100;
        if (value === 2) return 75;
        if (value === 3) return 50;
        return 0;
    }
    
    if (!item.goal || item.goal === 0 || item.recordType === 'time') {
        return 0;
    }
    const achievement = Math.min(100, (value / item.goal) * 100);
    return parseFloat(achievement.toFixed(2));
}
