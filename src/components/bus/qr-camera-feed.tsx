'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { AlertCircle } from 'lucide-react';

/**
 * QR 스캐너용 카메라 피드 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export function QrCameraFeed({ onScan }: { onScan: (data: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (isCancelled) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          try {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              await playPromise;
            }
          } catch (playErr: any) {
            // Unmount 또는 새 스트림 로드 시 AbortError 발생 방어
            if (playErr?.name !== 'AbortError') {
              console.warn('Video play interrupted:', playErr);
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Camera open failed:', err);
          setCameraError(err.message || 'Camera access error');
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const scanQr = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_CURRENT_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              onScan(code.data);
            }
          }
        }
      }
      animationRef.current = requestAnimationFrame(scanQr);
    };

    animationRef.current = requestAnimationFrame(scanQr);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onScan]);

  if (cameraError) {
    return (
      <div className="text-red-400 text-xs text-center p-4">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p>카메라 접근 권한이 차단되었거나 지원되지 않습니다.</p>
        <p className="opacity-80 mt-1">(HTTPS 보안 프로토콜을 확인해주세요.)</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <video ref={videoRef} className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 border-[3px] border-dashed border-white/20 m-8 rounded-md pointer-events-none flex items-center justify-center">
        <div className="w-48 h-48 border border-emerald-400/50 rounded flex items-center justify-center animate-pulse">
          <div className="w-full h-0.5 bg-emerald-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
