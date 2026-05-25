'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getDocumentById } from '@/lib/services/documentService';
import { ApprovalDoc, DocConfig } from '@/lib/types';
import DocumentView from '@/components/document-view';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

export default function ParentDocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [documentData, setDocumentData] = useState<ApprovalDoc | null>(null);
  const [configData, setConfigData] = useState<DocConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !user) return;

    async function loadData() {
      try {
        const [docRes, configSnap] = await Promise.all([
          getDocumentById(id),
          getDoc(doc(db, 'settings', 'docConfig'))
        ]);

        if (!docRes) {
          setError('문서를 찾을 수 없습니다.');
          return;
        }

        // 권한 확인: 작성자가 본인이 맞는지
        if (docRes.requesterEmail !== user?.email?.toLowerCase()) {
          setError('열람 권한이 없습니다.');
          return;
        }

        setDocumentData(docRes as ApprovalDoc);
        if (configSnap.exists()) {
          setConfigData(configSnap.data() as DocConfig);
        } else {
          setConfigData({});
        }
      } catch (err: any) {
        setError(err.message || '문서 로딩 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !documentData || !configData) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/parents/history"><ArrowLeft className="w-4 h-4 mr-2" /> 목록으로 돌아가기</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error || '문서를 불러올 수 없습니다.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="px-4 mb-4">
        <Button asChild variant="ghost">
          <Link href="/parents/history"><ArrowLeft className="w-4 h-4 mr-2" /> 목록으로 돌아가기</Link>
        </Button>
      </div>
      <DocumentView initialDoc={documentData} initialConfig={configData} />
    </div>
  );
}
