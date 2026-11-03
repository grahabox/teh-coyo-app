import { useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Item, LocationRow } from '../../lib/types';
import { PagedPicker } from '../../components/paged-picker';
import { FormField, FormError, applyFormError, accessibility } from '../../components/form-helpers';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { useEditorLeaveGuard, type RegisterLeaveGuard } from '../recipes/leave-guard';
import { kindNames, today, type StockDocument, type StockKind } from './types';
import { stockFormSchema, type StockForm } from './inventory.schemas';

export function StockEditor({
  kind,
  location,
  registerLeaveGuard,
  onBack,
  onSaved,
}: {
  kind: StockKind;
  location: LocationRow;
  registerLeaveGuard: RegisterLeaveGuard;
  onBack: () => void;
  onSaved: (doc: StockDocument) => void;
}) {
  const prefix = useId();
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [destination, setDestination] = useState<LocationRow | null>(null);
  const form = useForm<StockForm>({
    resolver: zodResolver(stockFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      kind,
      locationId: location.id,
      destinationId: '',
      businessDate: today(),
      reference: '',
      reason: '',
      supplierName: '',
      lines: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ name: 'lines', control: form.control });
  const errors = form.formState.errors;
  const mutation = useMutation({
    mutationFn: (data: StockForm) =>
      api<StockDocument>('inventory/documents', {
        ...data,
        id: requestId.current,
        destinationId: kind === 'TRANSFER' ? data.destinationId : null,
        supplierName: kind === 'RECEIPT' ? data.supplierName : null,
      }),
  });
  const busy = mutation.isPending;
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    busy,
    registerLeaveGuard,
    'Dokumen stok',
  );
  const submit = form.handleSubmit(async (data) => {
    if (inFlight.current) return;
    inFlight.current = true;
    form.clearErrors('root.server');
    try {
      onSaved(await mutation.mutateAsync(data));
    } catch (error) {
      applyFormError(error, form, [
        'reference',
        'reason',
        'businessDate',
        'supplierName',
        'destinationId',
        ...data.lines.flatMap((_, i) => [`lines.${i}.stockItemId`, `lines.${i}.quantity`] as const),
      ]);
    } finally {
      inFlight.current = false;
    }
  });
  const field = (
    key: 'reference' | 'reason' | 'businessDate' | 'supplierName',
    label: string,
    hint?: string,
  ) => (
    <FormField id={`${prefix}-${key}`} label={label} hint={hint} error={errors[key]?.message}>
      <Input
        {...form.register(key)}
        {...accessibility(`${prefix}-${key}`, errors[key]?.message, !!hint)}
        maxLength={key === 'reason' ? 500 : 120}
        type={key === 'businessDate' ? 'date' : 'text'}
        max={key === 'businessDate' ? today() : undefined}
        disabled={busy}
      />
    </FormField>
  );
  return (
    <div className="space-y-5">
      <Button variant="ghost" disabled={busy} onClick={() => leave.requestLeave(onBack)}>
        ← Kembali ke daftar
      </Button>
      <div>
        <h2 className="text-2xl font-bold">Buat {kindNames[kind].toLowerCase()}</h2>
        <p className="text-sm text-muted-foreground">
          {location.name} · Draft belum mengubah stok. Jumlah mengikuti satuan pencatatan barang.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset disabled={busy} className="space-y-5">
          <Card className="grid gap-4 sm:grid-cols-2">
            {field(
              'reference',
              'Referensi dokumen',
              kind === 'RECEIPT'
                ? 'Nomor nota/surat jalan supplier.'
                : 'Kode atau nomor dokumen yang dapat ditelusuri.',
            )}
            {field('businessDate', kind === 'TRANSFER' ? 'Tanggal kirim' : 'Tanggal pencatatan')}
            {field(
              'reason',
              kind === 'ADJUSTMENT' ? 'Alasan penyesuaian' : 'Keterangan',
              kind === 'OPENING'
                ? 'Dasar hasil hitung/verifikasi saldo awal, bukan saldo Accurate otomatis.'
                : undefined,
            )}
            {kind === 'RECEIPT' &&
              field(
                'supplierName',
                'Nama supplier',
                'Jika ada nota pembelian, terima dari menu Pembelian. Penerimaan di sini bisa ditautkan ke nota tanpa tambah stok lagi.',
              )}
            {kind === 'TRANSFER' && (
              <Controller
                name="destinationId"
                control={form.control}
                render={({ field: f }) => (
                  <FormField
                    id={`${prefix}-destination`}
                    label="Lokasi tujuan"
                    error={errors.destinationId?.message}
                  >
                    <PagedPicker<LocationRow>
                      endpoint={`locations/page?parentId=${location.id}&type=${location.type === 'CENTER' ? 'DC' : 'STAND'}`}
                      value={destination}
                      placeholder="Pilih tujuan"
                      {...accessibility(`${prefix}-destination`, errors.destinationId?.message)}
                      ref={f.ref}
                      onBlur={f.onBlur}
                      onSelect={(value) => {
                        setDestination(value);
                        f.onChange(value.id);
                      }}
                    />
                  </FormField>
                )}
              />
            )}
          </Card>
          <Card className="space-y-4">
            <h3 className="font-bold">Barang dan jumlah</h3>
            {kind === 'ADJUSTMENT' && (
              <p className="text-sm text-muted-foreground">
                Isi jumlah perubahan: positif untuk menambah, tanda minus untuk mengurangi. Bukan
                jumlah stok akhir.
              </p>
            )}
            {kind === 'OPENING' && (
              <p className="text-sm text-muted-foreground">
                Isi nol jika barang benar-benar kosong. Saldo awal setiap barang hanya dapat
                ditetapkan sekali per lokasi.
              </p>
            )}
            {fields.map((line, i) => (
              <div key={line.id} className="space-y-3 rounded-xl border border-border p-4">
                <Controller
                  name={`lines.${i}.stockItemId`}
                  control={form.control}
                  render={({ field: f }) => (
                    <FormField
                      id={`${prefix}-item-${i}`}
                      label={`Barang ${i + 1}`}
                      error={errors.lines?.[i]?.stockItemId?.message}
                    >
                      <PagedPicker<Item>
                        endpoint="catalog/items/page"
                        value={items[line.id] ?? null}
                        placeholder="Pilih barang"
                        {...accessibility(
                          `${prefix}-item-${i}`,
                          errors.lines?.[i]?.stockItemId?.message,
                        )}
                        ref={f.ref}
                        onBlur={f.onBlur}
                        onSelect={(value) => {
                          setItems((old) => ({ ...old, [line.id]: value }));
                          f.onChange(value.id);
                        }}
                      />
                    </FormField>
                  )}
                />
                <FormField
                  id={`${prefix}-qty-${i}`}
                  label={`Jumlah (${items[line.id]?.baseUnit.code ?? 'pilih barang'})`}
                  error={errors.lines?.[i]?.quantity?.message}
                >
                  <Input
                    {...form.register(`lines.${i}.quantity`)}
                    {...accessibility(`${prefix}-qty-${i}`, errors.lines?.[i]?.quantity?.message)}
                    inputMode={kind === 'ADJUSTMENT' ? 'text' : 'decimal'}
                  />
                </FormField>
                <Button variant="ghost" onClick={() => remove(i)}>
                  Hapus baris {i + 1}
                </Button>
              </div>
            ))}
            <FormError message={errors.lines?.message ?? errors.lines?.root?.message} />
            <Button
              variant="outline"
              disabled={fields.length >= 100}
              onClick={() => append({ stockItemId: '', quantity: '' })}
            >
              + Tambah barang
            </Button>
          </Card>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => leave.requestLeave(onBack)}>
            Batal
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan draft'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </div>
  );
}
