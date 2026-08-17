'use client';

import React from 'react';
import { ApprovalDoc, DocConfig } from '@/lib/types';
import { format } from 'date-fns';
import { formatOfficialDocumentHtml } from '@/lib/documentFormatter';

type OfficialDocumentPrintProps = {
  doc: ApprovalDoc;
  config: DocConfig;
  approverSignatures?: Record<string, string>;
};

export const OfficialDocumentPrint = React.forwardRef<HTMLDivElement, OfficialDocumentPrintProps>(
  ({ doc, config, approverSignatures = {} }, ref) => {
    const isFamily = doc.category === 'family';
    const approvalDate = doc.completedAt ? new Date(doc.completedAt) : doc.createdAt ? new Date(doc.createdAt) : new Date();

    const mainApprovers = (doc.approvers || []).map((ap) => {
      const emailNormal = ap.email?.trim().toLowerCase();
      const fetchedSignature = emailNormal ? approverSignatures[emailNormal] : '';
      return {
        ...ap,
        approverName: ap.name || ap.role,
        signature: ap.signature || fetchedSignature || '',
      };
    });

    return (
      <div
        ref={ref}
        style={{
          width: '210mm',
          minHeight: '295mm',
          padding: '12mm 15mm 12mm 15mm',
          boxSizing: 'border-box' as const,
          display: 'flex' as const,
          flexDirection: 'column' as const,
          justifyContent: 'space-between' as const,
          backgroundColor: '#ffffff',
          fontFamily: 'Batang, Noto Serif KR, serif',
          color: '#111827',
          margin: '0 auto',
        }}
        className="official-print-paper bg-white"
      >
        {/* 상단 헤더 & 본문 래퍼 */}
        <div style={{ flex: 1, display: 'flex' as const, flexDirection: 'column' as const, justifyContent: 'flex-start' as const }}>
          {/* 헤더 표제 */}
          <header style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
            <p style={{ fontSize: '11pt', fontWeight: 500, color: '#6b7280', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              {config.slogan || '글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교'}
            </p>
            {isFamily ? (
              <h1 style={{ fontSize: '28pt', fontWeight: 800, letterSpacing: '0.3em', border: '2px solid #000', display: 'inline-block', padding: '6px 24px', margin: '0 auto' }}>
                가 정 통 신 문
              </h1>
            ) : doc.headerImage ? (
              <img src={doc.headerImage} alt="Header" style={{ height: '60px', margin: '0 auto 8px auto', objectFit: 'contain' as const }} />
            ) : (
              <h1 style={{ fontSize: '22pt', fontWeight: 800, marginBottom: '8px' }}>호치민시한국국제학교</h1>
            )}
          </header>

          {/* 수신, 경유, 제목 */}
          {!isFamily && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12pt', lineHeight: 1.6, marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px 0' }}><span style={{ fontWeight: 'bold' }}>수신</span> <span style={{ marginLeft: '12px' }}>{doc.docType === 'external' ? doc.receiverInfo?.name : '내부결재'}</span></p>
                <p style={{ margin: '0 0 4px 0' }}>(경유)</p>
                <p style={{ margin: '0', display: 'flex' as const, alignItems: 'flex-start' as const }}>
                  <span style={{ fontWeight: 'bold', flexShrink: 0 }}>제목</span>
                  <span style={{ marginLeft: '12px', fontWeight: 500 }}>{doc.title}</span>
                </p>
              </div>
              <div style={{ height: '2px', backgroundColor: '#000000', width: '100%' }} />
            </div>
          )}

          {/* 본문 내용 */}
          <div
            style={{ fontSize: '12pt', lineHeight: 1.8, color: '#111827' }}
            dangerouslySetInnerHTML={{ __html: formatOfficialDocumentHtml(doc.content) }}
          />
        </div>

        {/* 하단 결재선 & 바닥글 */}
        <footer style={{ marginTop: 'auto', paddingTop: '16px', flexShrink: 0 }}>
          {doc.docType === 'external' && (
            <div style={{ textAlign: 'center' as const, marginBottom: '24px', height: '40px', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const }}>
              <h2 style={{ fontSize: '24pt', fontWeight: 900, letterSpacing: '0.4em' }}>호치민시한국국제학교장</h2>
            </div>
          )}

          {/* 결재선 테이블 */}
          <div style={{ borderTop: '2px solid #000000', paddingTop: '12px', paddingBottom: '8px' }}>
            <div style={{ display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, fontSize: '11pt', width: '100%' }}>
              <div style={{ display: 'flex' as const, alignItems: 'center' as const, gap: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>{doc.requesterRole}</span>
                <div style={{ display: 'flex' as const, alignItems: 'center' as const, gap: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{doc.requesterName}</span>
                  <div style={{ position: 'relative' as const, display: 'inline-flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, width: '40px', height: '40px' }}>
                    <span style={{ fontSize: '11pt', color: '#1f2937', position: 'absolute' as const }}>(인)</span>
                    {doc.requesterSignature && (
                      <img src={doc.requesterSignature} style={{ position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'contain' as const, mixBlendMode: 'multiply' as const }} alt="sig" />
                    )}
                  </div>
                </div>
              </div>

              {mainApprovers.map((ap, idx) => (
                <div key={idx} style={{ display: 'flex' as const, alignItems: 'center' as const, gap: '8px' }}>
                  <div style={{ display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'flex-start' as const, lineHeight: 1.2 }}>
                    <span style={{ fontWeight: 'bold' }}>{ap.role}</span>
                  </div>
                  <div style={{ display: 'flex' as const, alignItems: 'center' as const, gap: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{ap.approverName}</span>
                    {ap.status === 'approved' && ap.signature && (
                      <div style={{ width: '36px', height: '36px', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const }}>
                        <img src={ap.signature} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' as const }} alt="sig" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 학교 주소 & 시행 정보 바닥글 */}
          <div style={{ marginTop: '12px', fontSize: '10pt', fontWeight: 500, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: '12px', lineHeight: 1.6 }}>
            <div style={{ display: 'flex' as const, gap: '24px', marginBottom: '4px' }}>
              <span><strong>시행</strong> {doc.docNo} ({format(approvalDate, 'yyyy. MM. dd.')})</span>
              {!isFamily && <span><strong>접수</strong> ( )</span>}
            </div>
            <p style={{ margin: '0 0 4px 0' }}><strong>우</strong> {config.address || '21 Tan Phu Street, Tan Phu Ward, Dist.7 HCMC'}</p>
            <div style={{ display: 'flex' as const, justifyContent: 'space-between' as const }}>
              <p style={{ margin: 0 }}><strong>전화</strong> {config.phone || '028-5417-9021'} / <strong>전송</strong> {config.fax || '028-5417-9022'} / {config.email || 'hcmcks@hanmail.net'}</p>
              <p style={{ margin: 0 }}>{config.homepage || 'http://kshcm.net'} / <strong>{doc.publishStatus || '공개'}</strong></p>
            </div>
          </div>
        </footer>
      </div>
    );
  }
);

OfficialDocumentPrint.displayName = 'OfficialDocumentPrint';
