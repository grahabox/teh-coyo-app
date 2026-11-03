import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { FormDialog } from '../../components/ui/form-dialog';

export type LeaveGuard = (proceed: () => void) => void;
export type RegisterLeaveGuard = (guard: LeaveGuard | null) => void;

export function useEditorLeaveGuard(
  dirty: boolean,
  busy: boolean,
  register: RegisterLeaveGuard,
  subject = 'Resep',
) {
  const next = useRef<(() => void) | null>(null);
  const [confirm, setConfirm] = useState(false);
  const requestLeave = useCallback<LeaveGuard>(
    (proceed) => {
      if (busy) return;
      if (dirty) {
        next.current = proceed;
        setConfirm(true);
      } else proceed();
    },
    [dirty, busy],
  );
  useEffect(() => {
    register(requestLeave);
    return () => register(null);
  }, [requestLeave, register]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, busy]);
  return {
    requestLeave,
    confirmation: confirm ? (
      <FormDialog
        title="Keluar tanpa menyimpan?"
        description={`${subject} belum disimpan. Isian akan dibuang jika kamu keluar.`}
        dirty={false}
        busy={false}
        onClose={() => setConfirm(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                const proceed = next.current;
                setConfirm(false);
                proceed?.();
              }}
            >
              Buang isian
            </Button>
            <Button data-dialog-focus onClick={() => setConfirm(false)}>
              Lanjut isi
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Isian yang belum disimpan akan dibuang. Dokumen yang sudah tersimpan tetap tersedia.
        </p>
      </FormDialog>
    ) : null,
  };
}
