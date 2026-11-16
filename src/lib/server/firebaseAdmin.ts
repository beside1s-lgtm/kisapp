import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * 서버 전용 Firebase Admin SDK 초기화
 * - 클라이언트(src/lib/firebase.ts)와 같은 메인 프로젝트를 사용한다.
 * - FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY 환경 변수가 있으면 서비스 계정으로,
 *   없으면 App Hosting(Cloud Run) 기본 자격 증명(ADC)으로 초기화한다.
 * - FIRESTORE_EMULATOR_HOST가 설정되면 에뮬레이터 프로젝트(GCLOUD_PROJECT)로 연결한다 (테스트용).
 */
const MAIN_PROJECT_ID = 'studio-9153973571-7837c';
const ADMIN_APP_NAME = 'kis-admin';

function getAdminApp(): App {
  const existing = getApps().find(a => a.name === ADMIN_APP_NAME);
  if (existing) return existing;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-test' }, ADMIN_APP_NAME);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId: MAIN_PROJECT_ID, clientEmail, privateKey }), projectId: MAIN_PROJECT_ID }, ADMIN_APP_NAME);
  }
  return initializeApp({ credential: applicationDefault(), projectId: MAIN_PROJECT_ID }, ADMIN_APP_NAME);
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
