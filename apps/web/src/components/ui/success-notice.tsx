import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from './button';

export function SuccessNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6500);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  return (
    <div className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-200 bg-white py-2 pl-4 pr-2 shadow-lg sm:left-auto sm:right-6 sm:mx-0">
      <CheckCircle2 aria-hidden="true" className="shrink-0 text-primary" size={21} />
      <p role="status" aria-live="polite" className="flex-1 text-sm font-medium">
        {message}
      </p>
      <Button
        variant="ghost"
        aria-label="Tutup notifikasi"
        className="shrink-0 px-3"
        onClick={onDismiss}
      >
        <X size={18} />
      </Button>
    </div>
  );
}
