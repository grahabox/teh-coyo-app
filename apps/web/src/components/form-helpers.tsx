import { useRef, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { ApiError, api, errorMessage } from '../lib/api';
import { Button } from './ui/button';

export function applyFormError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  fields: FieldPath<T>[],
) {
  let first: FieldPath<T> | undefined;
  if (error instanceof ApiError)
    for (const field of fields) {
      const issue = error.issues.find((issue) => issue.field === field);
      if (issue) {
        form.setError(field, { type: 'server', message: issue.message });
        first ??= field;
      }
    }
  form.setError('root.server', {
    message: first ? 'Periksa kolom yang ditandai, lalu simpan kembali.' : errorMessage(error),
  });
  if (first) requestAnimationFrame(() => form.setFocus(first));
}

export function useSave<T extends FieldValues, R>(
  path: string,
  form: UseFormReturn<T>,
  fields: FieldPath<T>[],
  onSaved: (record: R) => void,
) {
  const inFlight = useRef(false);
  const mutation = useMutation({ mutationFn: (body: T) => api<R>(path, body) });
  return {
    busy: mutation.isPending,
    submit: form.handleSubmit(async (values) => {
      if (inFlight.current) return;
      inFlight.current = true;
      form.clearErrors('root.server');
      try {
        onSaved(await mutation.mutateAsync(values));
      } catch (error) {
        applyFormError(error, form, fields);
      } finally {
        inFlight.current = false;
      }
    }),
  };
}

export function FormField({
  id,
  label,
  hint,
  error,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-red-600">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
export function accessibility(id: string, error: string | undefined, hint = false) {
  return {
    id,
    'aria-required': true as const,
    'aria-invalid': !!error,
    'aria-describedby':
      [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  };
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {message}
    </p>
  ) : null;
}
export function Footer({
  formId,
  busy,
  onCancel,
  label,
}: {
  formId: string;
  busy: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" disabled={busy} onClick={onCancel}>
        Batal
      </Button>
      <Button type="submit" form={formId} disabled={busy}>
        {busy ? 'Menyimpan…' : label}
      </Button>
    </div>
  );
}
