import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
];

/**
 * 환경 변수의 Firebase/Google Service Account 자격 증명을 사용하여 Google Auth 클라이언트를 생성
 */
export function getGoogleServiceAuth() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account 자격 증명이 환경 변수(FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)에 설정되어 있지 않습니다.');
  }

  // 줄바꿈 이스케이프 문자 복원
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES
  });

  return auth;
}

export function getGoogleDriveClient() {
  const auth = getGoogleServiceAuth();
  return google.drive({ version: 'v3', auth });
}

export function getGoogleSheetsClient() {
  const auth = getGoogleServiceAuth();
  return google.sheets({ version: 'v4', auth });
}
