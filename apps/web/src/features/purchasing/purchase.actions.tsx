import { useId, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Controller,
  useForm,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/forms';
import { PagedPicker } from '../../components/paged-picker';
import { FormError, FormField, accessibility, applyFormError } from '../../components/form-helpers';
import { today } from '../inventory/types';
import { remaining, scaled } from '../inventory/inventory.schemas';
import { useEditorLeaveGuard, type RegisterLeaveGuard } from '../recipes/leave-guard';
import { linkFormSchema, paymentFormSchema, receiveFormSchema } from './purchase.schemas';
import { rupiah, type Purchase } from './types';

interface Props {
  purchase: Purchase;
  onBack: () => void;
  onSaved: (p: Purchase) => void;
  registerLeaveGuard: RegisterLeaveGuard;
}
function useAction<T extends FieldValues>(
  form: UseFormReturn<T>,
  path: string,
  fields: FieldPath<T>[],
  onSaved: (p: Purchase) => void,
) {
  const requestId = useRef(crypto.randomUUID());
  const flight = useRef(false);
  const mutation = useMutation({ mutationFn: (body: unknown) => api<Purchase>(path, body) });
  const save = async (body: unknown) => {
    if (flight.current) return;
    flight.current = true;
    form.clearErrors('root.server');
    try {
      onSaved(await mutation.mutateAsync({ ...(body as object), id: requestId.current }));
    } catch (e) {
      applyFormError(e, form, fields);
    } finally {
      flight.current = false;
    }
  };
  return { busy: mutation.isPending, save };
}

export function PurchaseReceive({ purchase: p, onBack, onSaved, registerLeaveGuard }: Props) {
  const prefix = useId();
  const lines = p.lines.filter((l) => remaining(l.quantity, l.receivedQuantity) !== '0');
  const form = useForm<z.infer<typeof receiveFormSchema>>({
    resolver: zodResolver(receiveFormSchema),
    mode: 'onBlur',
    defaultValues: {
      businessDate: today(),
      reference: '',
      note: '',
      lines: lines.map((l) => ({ lineId: l.id, quantity: '' })),
    },
  });
  const errors = form.formState.errors;
  const action = useAction(
    form,
    `purchasing/invoices/${p.id}/receive`,
    ['businessDate', 'reference', 'note', ...lines.map((_, i) => `lines.${i}.quantity` as const)],
    onSaved,
  );
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    action.busy,
    registerLeaveGuard,
    'Penerimaan pembelian',
  );
  const submit = form.handleSubmit(async (data) => {
    for (let i = 0; i < data.lines.length; i++)
      if (
        data.lines[i].quantity &&
        scaled(data.lines[i].quantity) >
          scaled(remaining(lines[i].quantity, lines[i].receivedQuantity))
      ) {
        form.setError(`lines.${i}.quantity`, { message: 'Melebihi sisa nota.' });
        return;
      }
    await action.save({
      ...data,
      lines: data.lines.filter((l) => l.quantity && scaled(l.quantity) > 0n),
    });
  });
  return (
    <Card className="space-y-4">
      <h3 className="font-bold">Terima barang pembelian</h3>
      <p className="text-sm text-muted-foreground">
        Isi jumlah tambahan yang benar-benar diterima. Konfirmasi ini langsung menambah stok. Jika
        barang sudah dicatat di Stok & Mutasi, gunakan Tautkan penerimaan—jangan terima lagi.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset disabled={action.busy} className="space-y-4">
          <FormField
            id={`${prefix}-date`}
            label="Tanggal terima pembelian"
            error={errors.businessDate?.message}
          >
            <Input
              type="date"
              max={today()}
              {...form.register('businessDate')}
              {...accessibility(`${prefix}-date`, errors.businessDate?.message)}
            />
          </FormField>
          <FormField
            id={`${prefix}-ref`}
            label="Bukti terima / surat jalan"
            error={errors.reference?.message}
          >
            <Input
              {...form.register('reference')}
              {...accessibility(`${prefix}-ref`, errors.reference?.message)}
              maxLength={120}
            />
          </FormField>
          {lines.map((l, i) => (
            <FormField
              key={l.id}
              id={`${prefix}-qty-${i}`}
              label={`Terima ${l.stockItem.name} (${l.stockItem.baseUnit.code})`}
              required={false}
              hint={`Sisa nota ${remaining(l.quantity, l.receivedQuantity)}; kosongkan jika belum diterima.`}
              error={errors.lines?.[i]?.quantity?.message}
            >
              <Input
                {...form.register(`lines.${i}.quantity`)}
                id={`${prefix}-qty-${i}`}
                inputMode="decimal"
                aria-invalid={!!errors.lines?.[i]?.quantity}
                aria-describedby={`${prefix}-qty-${i}-hint${errors.lines?.[i]?.quantity ? ` ${prefix}-qty-${i}-error` : ''}`}
              />
            </FormField>
          ))}
          <FormError message={errors.lines?.message ?? errors.lines?.root?.message} />
          <FormField
            id={`${prefix}-note`}
            label="Catatan terima pembelian"
            error={errors.note?.message}
          >
            <Input
              {...form.register('note')}
              {...accessibility(`${prefix}-note`, errors.note?.message)}
              maxLength={500}
            />
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => leave.requestLeave(onBack)}
          >
            Batal penerimaan
          </Button>
          <Button type="submit" disabled={action.busy}>
            {action.busy ? 'Mencatat…' : 'Konfirmasi terima & tambah stok'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </Card>
  );
}

export function PurchasePayment({ purchase: p, onBack, onSaved, registerLeaveGuard }: Props) {
  const prefix = useId();
  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    mode: 'onBlur',
    defaultValues: {
      businessDate: today(),
      amount: '',
      method: 'CASH',
      fundingSource: '',
      reference: '',
      note: '',
    },
  });
  const errors = form.formState.errors;
  const action = useAction(
    form,
    `purchasing/invoices/${p.id}/payments`,
    ['businessDate', 'amount', 'fundingSource', 'reference', 'note'],
    onSaved,
  );
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    action.busy,
    registerLeaveGuard,
    'Pembayaran pembelian',
  );
  const submit = form.handleSubmit(async (data) => {
    if (BigInt(data.amount) > BigInt(p.outstandingAmount)) {
      form.setError('amount', { message: 'Melebihi sisa tagihan.' });
      return;
    }
    await action.save(data);
  });
  const field = (
    key: 'businessDate' | 'amount' | 'fundingSource' | 'reference' | 'note',
    label: string,
  ) => (
    <FormField id={`${prefix}-${key}`} label={label} error={errors[key]?.message}>
      <Input
        {...form.register(key)}
        {...accessibility(`${prefix}-${key}`, errors[key]?.message)}
        type={key === 'businessDate' ? 'date' : 'text'}
        inputMode={key === 'amount' ? 'numeric' : undefined}
        max={key === 'businessDate' ? today() : undefined}
        maxLength={key === 'note' ? 500 : 120}
      />
    </FormField>
  );
  return (
    <Card className="space-y-4">
      <h3 className="font-bold">Catat pembayaran supplier</h3>
      <p className="text-sm">
        Sisa tagihan: <strong>{rupiah(p.outstandingAmount)}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        Catat hanya pembayaran yang sudah dilakukan dan ada buktinya. Ini catatan pembayaran nota;
        belum memotong saldo kas/bank atau memverifikasi transfer otomatis.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset disabled={action.busy} className="space-y-4">
          {field('businessDate', 'Tanggal pembayaran')}
          {field('amount', 'Jumlah bayar (Rp)')}
          <FormField id={`${prefix}-method`} label="Metode pembayaran">
            <Select id={`${prefix}-method`} {...form.register('method')}>
              <option value="CASH">Tunai</option>
              <option value="BANK_TRANSFER">Transfer bank</option>
            </Select>
          </FormField>
          {field('fundingSource', 'Sumber dana / kas / rekening')}
          {field('reference', 'Nomor bukti pembayaran')}
          {field('note', 'Catatan pembayaran')}
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => leave.requestLeave(onBack)}
          >
            Batal pembayaran
          </Button>
          <Button type="submit" disabled={action.busy}>
            {action.busy ? 'Mencatat…' : 'Konfirmasi catatan pembayaran'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </Card>
  );
}

export function PurchaseLink({ purchase: p, onBack, onSaved, registerLeaveGuard }: Props) {
  const prefix = useId();
  const [selected, setSelected] = useState<{ id: string; name: string; code: string } | null>(null);
  const form = useForm<z.infer<typeof linkFormSchema>>({
    resolver: zodResolver(linkFormSchema),
    mode: 'onBlur',
    defaultValues: { stockDocumentId: '', note: '' },
  });
  const errors = form.formState.errors;
  const action = useAction(
    form,
    `purchasing/invoices/${p.id}/link-receipt`,
    ['stockDocumentId', 'note'],
    onSaved,
  );
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    action.busy,
    registerLeaveGuard,
    'Tautan penerimaan',
  );
  return (
    <Card className="space-y-4">
      <h3 className="font-bold">Tautkan penerimaan yang sudah dicatat</h3>
      <p className="text-sm text-muted-foreground">
        Pilih dokumen supplier yang sudah masuk buku stok pada lokasi ini. Nama supplier dan seluruh
        jumlah harus cocok dengan nota. Tautan hanya memperbarui jumlah diterima di nota, tidak
        menambah stok lagi.
      </p>
      <form onSubmit={form.handleSubmit(action.save)} className="space-y-4" noValidate>
        <fieldset disabled={action.busy} className="space-y-4">
          <Controller
            control={form.control}
            name="stockDocumentId"
            render={({ field: f }) => (
              <FormField
                id={`${prefix}-stock`}
                label="Penerimaan existing"
                error={errors.stockDocumentId?.message}
              >
                <PagedPicker
                  endpoint={`purchasing/invoices/${p.id}/receipt-options`}
                  value={selected}
                  placeholder="Pilih penerimaan existing"
                  {...accessibility(`${prefix}-stock`, errors.stockDocumentId?.message)}
                  ref={f.ref}
                  onBlur={f.onBlur}
                  onSelect={(v) => {
                    setSelected(v);
                    f.onChange(v.id);
                  }}
                />
              </FormField>
            )}
          />
          <FormField
            id={`${prefix}-note`}
            label="Dasar tautan nota & penerimaan"
            error={errors.note?.message}
          >
            <Input
              {...form.register('note')}
              {...accessibility(`${prefix}-note`, errors.note?.message)}
              maxLength={500}
            />
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() => leave.requestLeave(onBack)}
          >
            Batal tautkan
          </Button>
          <Button type="submit" disabled={action.busy}>
            {action.busy ? 'Menautkan…' : 'Tautkan tanpa tambah stok'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </Card>
  );
}
