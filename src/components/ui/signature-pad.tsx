'use client';

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: (type?: string, quality?: number) => string;
  getTrimmedCanvas: () => HTMLCanvasElement;
  getCanvas: () => HTMLCanvasElement | null;
}

export interface SignaturePadProps {
  penColor?: string;
  lineWidth?: number;
  className?: string;
  containerClassName?: string;
  onBegin?: () => void;
  onEnd?: () => void;
  onChange?: (isEmpty: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

type Stroke = Point[];

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      penColor = '#000000',
      lineWidth = 2.5,
      className = '',
      containerClassName = '',
      onBegin,
      onEnd,
      onChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Stroke>([]);
    const isDrawingRef = useRef(false);
    const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
      width: 0,
      height: 0,
      dpr: 1,
    });

    // 캔버스에 모든 획 다시 그리기
    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { dpr } = sizeRef.current;

      // 캔버스 버퍼 초기화
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.strokeStyle = penColor;
      ctx.fillStyle = penColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 저장된 획들 렌더링
      const allStrokes = [...strokesRef.current];
      if (currentStrokeRef.current.length > 0) {
        allStrokes.push(currentStrokeRef.current);
      }

      for (const stroke of allStrokes) {
        if (stroke.length === 0) continue;
        if (stroke.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke[0].x, stroke[0].y, lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
    }, [penColor, lineWidth]);

    // 캔버스 크기 및 High-DPI(devicePixelRatio) 보정
    const updateCanvasSize = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const newWidth = Math.round(rect.width);
      const newHeight = Math.round(rect.height);

      // 이미 같은 크기라면 재설정 불필요
      if (
        sizeRef.current.width === newWidth &&
        sizeRef.current.height === newHeight &&
        sizeRef.current.dpr === dpr
      ) {
        return;
      }

      sizeRef.current = { width: newWidth, height: newHeight, dpr };

      // 내부 버퍼 해상도 = CSS 픽셀 * DPR
      canvas.width = Math.round(newWidth * dpr);
      canvas.height = Math.round(newHeight * dpr);

      // CSS 렌더링 크기 고정
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      redraw();
    }, [redraw]);

    useEffect(() => {
      updateCanvasSize();

      // 컨테이너 크기 변경(모달 표시, 윈도우 리사이즈 등) 감지
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        const observer = new ResizeObserver(() => {
          updateCanvasSize();
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
      } else {
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
      }
    }, [updateCanvasSize]);

    // 포인터 좌표 계산 (캔버스 기준 로컬 좌표)
    const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // 일부 환경 방어
      }

      const pos = getPointerPos(e);
      isDrawingRef.current = true;
      currentStrokeRef.current = [pos];

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = penColor;
        ctx.fillStyle = penColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      onBegin?.();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pos = getPointerPos(e);
      const stroke = currentStrokeRef.current;
      const lastPos = stroke[stroke.length - 1];

      // 이전 점과 너무 가까운 미세 노이즈 무시
      if (lastPos) {
        const dx = pos.x - lastPos.x;
        const dy = pos.y - lastPos.y;
        if (dx * dx + dy * dy < 1.0) return;
      }

      stroke.push(pos);

      const ctx = canvas.getContext('2d');
      if (ctx && lastPos) {
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;

      const canvas = canvasRef.current;
      if (canvas) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
      }

      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push([...currentStrokeRef.current]);
      }
      currentStrokeRef.current = [];

      onEnd?.();
      onChange?.(strokesRef.current.length === 0);
    };

    // 트림 캔버스 생성 함수 (외부 라이브러리 결함 원천 차단)
    const getTrimmedCanvas = useCallback((): HTMLCanvasElement => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return document.createElement('canvas');
      }

      // 획이 없는 경우 빈 캔버스 반환
      if (strokesRef.current.length === 0) {
        const emptyCanvas = document.createElement('canvas');
        emptyCanvas.width = 100;
        emptyCanvas.height = 50;
        return emptyCanvas;
      }

      // 모든 획의 Bounding Box 계산 (논리 좌표계 기준)
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of strokesRef.current) {
        for (const pt of stroke) {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        }
      }

      // 패딩 부여 (선 굵기 고려)
      const padding = Math.max(12, lineWidth * 3);
      const logicalW = sizeRef.current.width || canvas.clientWidth || 300;
      const logicalH = sizeRef.current.height || canvas.clientHeight || 150;

      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(logicalW, maxX + padding);
      maxY = Math.min(logicalH, maxY + padding);

      const cropW = Math.max(10, maxX - minX);
      const cropH = Math.max(10, maxY - minY);

      // 고화질 트림 캔버스 렌더링
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const trimmed = document.createElement('canvas');
      trimmed.width = Math.round(cropW * dpr);
      trimmed.height = Math.round(cropH * dpr);

      const tCtx = trimmed.getContext('2d');
      if (tCtx) {
        tCtx.scale(dpr, dpr);
        tCtx.strokeStyle = penColor;
        tCtx.fillStyle = penColor;
        tCtx.lineWidth = lineWidth;
        tCtx.lineCap = 'round';
        tCtx.lineJoin = 'round';

        // 크롭 영역 원점으로 이동
        tCtx.translate(-minX, -minY);

        for (const stroke of strokesRef.current) {
          if (stroke.length === 0) continue;
          if (stroke.length === 1) {
            tCtx.beginPath();
            tCtx.arc(stroke[0].x, stroke[0].y, lineWidth / 2, 0, Math.PI * 2);
            tCtx.fill();
            continue;
          }

          tCtx.beginPath();
          tCtx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) {
            tCtx.lineTo(stroke[i].x, stroke[i].y);
          }
          tCtx.stroke();
        }
      }

      return trimmed;
    }, [penColor, lineWidth]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          strokesRef.current = [];
          currentStrokeRef.current = [];
          isDrawingRef.current = false;
          redraw();
          onChange?.(true);
        },
        isEmpty: () => {
          return strokesRef.current.length === 0;
        },
        toDataURL: (type = 'image/png', quality = 0.9) => {
          const trimmed = getTrimmedCanvas();
          return trimmed.toDataURL(type, quality);
        },
        getTrimmedCanvas,
        getCanvas: () => canvasRef.current,
      }),
      [getTrimmedCanvas, redraw, onChange]
    );

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none ${containerClassName}`}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`block w-full h-full cursor-crosshair select-none ${className}`}
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
