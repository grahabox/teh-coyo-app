import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

export function Pagination({
  page,
  perPage,
  total,
  totalPages,
  busy,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  const from = total ? Math.min((page - 1) * perPage + 1, total) : 0;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p aria-live="polite" className="text-muted-foreground">
        {from}–{to} dari {total} data
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="px-3"
          aria-label="Halaman sebelumnya"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span className="text-xs">
          {page} / {Math.max(1, totalPages)}
        </span>
        <Button
          variant="outline"
          className="px-3"
          aria-label="Halaman berikutnya"
          disabled={busy || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
