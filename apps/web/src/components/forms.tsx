import type { ReactNode, SelectHTMLAttributes } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { Button } from './ui/button';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2 text-base focus:outline-primary aria-invalid:border-red-500 disabled:bg-muted"
    />
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {errorMessage(error)}
    </p>
  ) : null;
}
export function SubmitButton({
  pending,
  children = 'Simpan',
}: {
  pending: boolean;
  children?: ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : children}
    </Button>
  );
}
export function useCreate(path: string, keys: string[], onSuccess?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api(path, body),
    onSuccess: async () => {
      await Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
      onSuccess?.();
    },
  });
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
