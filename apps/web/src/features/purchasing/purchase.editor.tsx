import { useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Item, LocationRow } from '../../lib/types';
import { PagedPicker } from '../../components/paged-picker';
import { FormError, FormField, accessibility, applyFormError } from '../../components/form-helpers';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { today } from '../inventory/types';
import { useEditorLeaveGuard, type RegisterLeaveGuard } from '../recipes/leave-guard';
import { lineAmount, purchaseFormSchema, type PurchaseForm } from './purchase.schemas';
import { rupiah, type Purchase, type Supplier } from './types';

export function PurchaseEditor({
  location,
  onBack,
  onSaved,
  registerLeaveGuard,
}: {
  location: LocationRow;
  onBack: () => void;
  onSaved: (p: Purchase) => void;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const id = useId();
  const requestId = useRef(crypto.randomUUID());
  const flight = useRef(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const form = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseFormSchema),
    mode: 'onBlur',
    defaultValues: {
      locationId: location.id,
      supplierId: '',
      invoiceReference: '',
      businessDate: today(),
      dueDate: '',
      note: '',
      lines: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const values = form.watch();
  const errors = form.formState.errors;
  const mutation = useMutation({
    mutationFn: (data: PurchaseForm) =>
      api<Purchase>('purchasing/invoices', {
        ...data,
        id: requestId.current,
        dueDate: data.dueDate || null,
      }),
  });
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    mutation.isPending,
    registerLeaveGuard,
    'Nota pembelian',
  );
  const amounts = values.lines.map((l) => lineAmount(l.quantity, l.unitPrice));
  const total =
    amounts.length && amounts.every((v) => v !== null)
      ? amounts.reduce((sum, v) => sum + BigInt(v!), 0n).toString()
      : null;
  const submit = form.handleSubmit(async (data) => {
    if (flight.current) return;
    flight.current = true;
    form.clearErrors('root.server');
    try {
      onSaved(await mutation.mutateAsync(data));
    } catch (e) {
      applyFormError(e, form, [
        'supplierId',
        'invoiceReference',
        'businessDate',
        'dueDate',
        'note',
        ...data.lines.flatMap(
          (_, i) =>
            [`lines.${i}.stockItemId`, `lines.${i}.quantity`, `lines.${i}.unitPrice`] as const,
        ),
      ]);
    } finally {
      flight.current = false;
    }
  });
  const input = (
    key: 'invoiceReference' | 'businessDate' | 'dueDate' | 'note',
    label: string,
    type = 'text',
  ) => (
    <FormField
      id={`${id}-${key}`}
      label={label}
      required={key !== 'dueDate'}
      error={errors[key]?.message}
    >
      <Input
        {...form.register(key)}
        id={`${id}-${key}`}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        type={type}
        max={key === 'businessDate' ? today() : undefined}
        maxLength={key === 'note' ? 500 : 120}
      />
    </FormField>
  );
  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        disabled={mutation.isPending}
        onClick={() => leave.requestLeave(onBack)}
      >
        ← Kembali ke pembelian
      </Button>
      <div>
        <h2 className="text-2xl font-bold">Buat nota pembelian</h2>
        <p className="text-sm text-muted-foreground">
          {location.name} · Draft belum menambah stok atau mencatat pembayaran.
        </p>
      </div>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <fieldset disabled={mutation.isPending} className="space-y-5">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="supplierId"
              render={({ field: f }) => (
                <FormField
                  id={`${id}-supplier`}
                  label="Supplier"
                  error={errors.supplierId?.message}
                >
                  <PagedPicker<Supplier>
                    endpoint="purchasing/suppliers"
                    value={supplier}
                    placeholder="Pilih supplier"
                    {...accessibility(`${id}-supplier`, errors.supplierId?.message)}
                    ref={f.ref}
                    onBlur={f.onBlur}
                    onSelect={(v) => {
                      setSupplier(v);
                      f.onChange(v.id);
                    }}
                  />
                </FormField>
              )}
            />
            {input('invoiceReference', 'Nomor nota / faktur supplier')}
            {input('businessDate', 'Tanggal nota', 'date')}
            {input('dueDate', 'Jatuh tempo (opsional)', 'date')}
            {input('note', 'Keterangan pembelian')}
          </Card>
          <Card className="space-y-4">
            <h3 className="font-bold">Barang, jumlah dan harga</h3>
            <p className="text-sm text-muted-foreground">
              Harga rupiah per satuan dasar barang. Nilai baris dibulatkan HALF_UP ke rupiah utuh;
              total adalah jumlah nilai baris. Belum pajak, diskon, ongkir atau HPP.
            </p>
            {fields.map((l, i) => (
              <div key={l.id} className="space-y-3 rounded-xl border border-border p-4">
                <Controller
                  control={form.control}
                  name={`lines.${i}.stockItemId`}
                  render={({ field: f }) => (
                    <FormField
                      id={`${id}-item-${i}`}
                      label={`Barang ${i + 1}`}
                      error={errors.lines?.[i]?.stockItemId?.message}
                    >
                      <PagedPicker<Item>
                        endpoint="catalog/items/page"
                        placeholder="Pilih barang pembelian"
                        value={items[l.id] ?? null}
                        {...accessibility(
                          `${id}-item-${i}`,
                          errors.lines?.[i]?.stockItemId?.message,
                        )}
                        ref={f.ref}
                        onBlur={f.onBlur}
                        onSelect={(v) => {
                          setItems((old) => ({ ...old, [l.id]: v }));
                          f.onChange(v.id);
                        }}
                      />
                    </FormField>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    id={`${id}-qty-${i}`}
                    label={`Jumlah beli ${i + 1} (${items[l.id]?.baseUnit.code ?? 'pilih barang'})`}
                    error={errors.lines?.[i]?.quantity?.message}
                  >
                    <Input
                      {...form.register(`lines.${i}.quantity`)}
                      {...accessibility(`${id}-qty-${i}`, errors.lines?.[i]?.quantity?.message)}
                      inputMode="decimal"
                    />
                  </FormField>
                  <FormField
                    id={`${id}-price-${i}`}
                    label={`Harga per ${items[l.id]?.baseUnit.code ?? 'satuan'} (Rp) ${i + 1}`}
                    error={errors.lines?.[i]?.unitPrice?.message}
                  >
                    <Input
                      {...form.register(`lines.${i}.unitPrice`)}
                      {...accessibility(`${id}-price-${i}`, errors.lines?.[i]?.unitPrice?.message)}
                      inputMode="numeric"
                    />
                  </FormField>
                </div>
                <p className="text-sm">
                  Nilai baris:{' '}
                  {amounts[i] !== null ? rupiah(amounts[i]) : 'Lengkapi jumlah dan harga'}
                </p>
                <Button variant="ghost" onClick={() => remove(i)}>
                  Hapus barang {i + 1}
                </Button>
              </div>
            ))}
            <FormError message={errors.lines?.message ?? errors.lines?.root?.message} />
            <Button
              variant="outline"
              disabled={fields.length >= 100}
              onClick={() => append({ stockItemId: '', quantity: '', unitPrice: '' })}
            >
              + Tambah barang pembelian
            </Button>
          </Card>
        </fieldset>
        <Card>
          <p className="font-bold">
            Total nota: {total === null ? 'Lengkapi rincian barang' : rupiah(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            Nilai final dihitung dan dikunci server saat draft tersimpan.
          </p>
        </Card>
        <FormError message={errors.root?.server?.message} />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => leave.requestLeave(onBack)}
          >
            Batal
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Menyimpan…' : 'Simpan draft nota'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </div>
  );
}
