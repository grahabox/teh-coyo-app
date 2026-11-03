import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface FormDialogProps {
  title: string;
  description: string;
  dirty: boolean;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode | ((requestClose: () => void) => ReactNode);
}

// Native modal dialog provides focus containment/inert background on supported
// Android Chromium browsers without adding a dialog dependency. Mount when open.
export function FormDialog({
  title,
  description,
  dirty,
  busy,
  onClose,
  children,
  footer,
}: FormDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const lastField = useRef<HTMLElement | null>(null);
  const outsidePointer = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const id = useId();

  useEffect(() => {
    const element = dialog.current!;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    // StrictMode replays effects in development. Deferring the native opening
    // prevents a synthetic open/close cycle from blurring untouched form fields.
    const frame = requestAnimationFrame(() => {
      element.showModal();
      element.querySelector<HTMLElement>('[data-dialog-focus]')?.focus();
      document.body.style.overflow = 'hidden';
    });
    return () => {
      cancelAnimationFrame(frame);
      const wasOpen = element.open;
      if (wasOpen) element.close();
      document.body.style.overflow = previousOverflow;
      if (wasOpen) previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (confirmDiscard) keepEditing.current?.focus();
  }, [confirmDiscard]);

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setConfirmDiscard(true);
    } else onClose();
  }
  function isOutside(event: { clientX: number; clientY: number }) {
    const rect = dialog.current!.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }
  function resumeEditing() {
    setConfirmDiscard(false);
    requestAnimationFrame(() => {
      const field = lastField.current?.isConnected
        ? lastField.current
        : dialog.current?.querySelector<HTMLElement>('[data-dialog-focus]');
      field?.focus();
    });
  }

  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onFocusCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.matches('input, select, textarea')
        ) {
          lastField.current = event.target;
        }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-dvh w-screen max-w-none overflow-hidden border-0 bg-white p-0 text-foreground backdrop:bg-black/40 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-lg sm:rounded-2xl sm:shadow-xl"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]',
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (!focusable.length) event.preventDefault();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (confirmDiscard) {
          resumeEditing();
        } else requestClose();
      }}
      onPointerDown={(event) => {
        outsidePointer.current = event.target === event.currentTarget && isOutside(event);
      }}
      onClick={(event) => {
        if (outsidePointer.current && event.target === event.currentTarget && isOutside(event))
          requestClose();
        outsidePointer.current = false;
      }}
    >
      <div className="flex h-full max-h-dvh flex-col sm:h-auto sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 id={`${id}-title`} className="text-xl font-bold">
              {confirmDiscard ? 'Batalkan perubahan?' : title}
            </h2>
            <p id={`${id}-description`} className="mt-1.5 text-sm text-muted-foreground">
              {confirmDiscard
                ? 'Isian belum disimpan. Jika dibatalkan, isian ini akan dibuang.'
                : description}
            </p>
          </div>
          {!confirmDiscard && (
            <Button
              variant="ghost"
              className="shrink-0 px-3"
              aria-label="Tutup formulir"
              disabled={busy}
              onClick={requestClose}
            >
              <X size={20} />
            </Button>
          )}
        </header>
        <div
          hidden={confirmDiscard}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
        >
          {children}
        </div>
        <footer className="shrink-0 border-t border-border bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {confirmDiscard ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose}>
                Buang isian
              </Button>
              <Button ref={keepEditing} onClick={resumeEditing}>
                Lanjut isi
              </Button>
            </div>
          ) : typeof footer === 'function' ? (
            footer(requestClose)
          ) : (
            footer
          )}
        </footer>
      </div>
    </dialog>
  );
}
