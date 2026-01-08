import * as admin from 'firebase-admin';

interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function formatPrivateKey(key: string) {
  // 실제 줄바꿈이 있는 경우와 \n 문자열로 들어온 경우 모두 처리
  return key.replace(/\\n/g, '\n');
}

export function customInitApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    // [중요] 어떤 환경변수가 없는지 터미널에 알려줌
    const missing = [];
    if (!projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    
    throw new Error(`[Firebase Admin] 환경변수가 누락되었습니다: ${missing.join(', ')}`);
  }

  const cert = {
    projectId,
    clientEmail,
    privateKey: formatPrivateKey(privateKey),
  };

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(cert),
    });
  } catch (error: any) {
    console.error('[Firebase Admin] Initialization Failed:', error);
    throw error;
  }
}

export function getDb() {
  try {
    const app = customInitApp();
    return app.firestore();
  } catch (error) {
    console.error('[Firebase Admin] Firestore Connection Failed:', error);
    throw error;
  }
}