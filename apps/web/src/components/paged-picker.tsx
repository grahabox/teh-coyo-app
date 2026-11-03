import { useEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { PageResult } from '../lib/types';
import { useDebounced } from '../lib/use-debounced';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ErrorNotice } from './forms';
import { Pagination } from './pagination';

interface Option {
  id: string;
  name: string;
  code: string;
}
export function PagedPicker<T extends Option>({
  endpoint,
  value,
  onSelect,
  placeholder,
  id,
  disabled = false,
  ref,
  onBlur,
  ...aria
}: {
  endpoint: string;
  value: T | null;
  onSelect: (value: T) => void;
  placeholder: string;
} & Pick<
  ComponentPropsWithRef<'button'>,
  'id' | 'disabled' | 'ref' | 'onBlur' | 'aria-invalid' | 'aria-describedby'
>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(query);
  const input = useRef<HTMLInputElement>(null);
  const data = useQuery({
    queryKey: ['organization-options', endpoint, debounced, page],
    enabled: open && !disabled,
    queryFn: () =>
      api<PageResult<T>>(
        `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(debounced)}&page=${page}&perPage=10`,
      ),
  });
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  return (
    <div className="space-y-2">
      <button
        type="button"
        id={id}
        ref={ref}
        onBlur={onBlur}
        disabled={disabled}
        {...aria}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => {
          setOpen(!open);
          setQuery('');
          setPage(1);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-left text-sm aria-invalid:border-red-500 disabled:opacity-50"
      >
        <span className={`min-w-0 break-words ${value ? '' : 'text-muted-foreground'}`}>
          {value ? `${value.name} · ${value.code}` : placeholder}
        </span>
        <ChevronDown size={17} className="shrink-0" />
      </button>
      {open && !disabled && (
        <div
          id={`${id}-options`}
          className="space-y-2 rounded-xl border border-border bg-muted p-3"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              document.getElementById(id!)?.focus();
            }
          }}
        >
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-3.5 text-muted-foreground"
            />
            <Input
              ref={input}
              aria-label={`Cari ${placeholder.toLowerCase()}`}
              value={query}
              maxLength={100}
              placeholder="Cari nama atau kode…"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="pl-9 text-sm"
            />
          </div>
          <ErrorNotice error={data.error} />
          {data.error && (
            <Button
              variant="outline"
              disabled={data.isFetching}
              onClick={() => void data.refetch()}
            >
              Coba lagi
            </Button>
          )}
          {data.isFetching && (
            <p role="status" className="text-xs text-muted-foreground">
              Mencari…
            </p>
          )}
          {data.data && !data.isFetching && (
            <>
              <ul className="max-h-44 overflow-y-auto rounded-lg bg-white">
                {data.data.items.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                      onClick={() => {
                        onSelect(option);
                        setOpen(false);
                        document.getElementById(id!)?.focus();
                      }}
                    >
                      <span className="min-w-0 break-words">
                        {option.name}
                        <small className="block text-muted-foreground">{option.code}</small>
                      </span>
                      {value?.id === option.id && <Check size={17} />}
                    </button>
                  </li>
                ))}
              </ul>
              {!data.data.items.length && (
                <p className="text-sm text-muted-foreground">
                  Tidak ada pilihan yang cocok. Coba pencarian lain.
                </p>
              )}
              <Pagination {...data.data} busy={data.isFetching} onPage={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
