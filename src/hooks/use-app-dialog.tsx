'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

type DialogOpts = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type State = DialogOpts & { mode: 'confirm' | 'notice' };

/**
 * 브라우저 기본 confirm/alert 대신 앱 안에서 뜨는 확인·안내 창.
 * (기본 창은 일부 브라우저·앱 안 브라우저에서 막혀 버튼이 먹통처럼 보일 수 있음)
 *
 *   const { confirm, notice, dialog } = useAppDialog();
 *   if (!(await confirm({ title: '...', message: '...' }))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useAppDialog() {
  const [state, setState] = useState<State | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const open = useCallback((mode: State['mode'], opts: DialogOpts) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ ...opts, mode });
    });
  }, []);

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((opts: DialogOpts) => open('confirm', opts), [open]);
  const notice = useCallback((opts: DialogOpts) => open('notice', opts).then(() => undefined), [open]);

  const dialog = (
    <AlertDialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent className="max-w-lg rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black">{state?.title}</AlertDialogTitle>
          {state?.message && (
            <AlertDialogDescription className="whitespace-pre-line text-left text-slate-600 leading-relaxed">
              {state.message}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {state?.mode === 'confirm' && (
            <AlertDialogCancel onClick={() => close(false)}>{state.cancelText || '취소'}</AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={() => close(true)}
            className={state?.destructive ? 'bg-rose-600 hover:bg-rose-700' : undefined}
          >
            {state?.confirmText || '확인'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, notice, dialog };
}
