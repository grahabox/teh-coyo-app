import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, type SessionUser } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { FormDialog } from '../../components/ui/form-dialog';
import { ErrorNotice } from '../../components/forms';
import { FormError, FormField, applyFormError, accessibility } from '../../components/form-helpers';
import { useEditorLeaveGuard, type RegisterLeaveGuard } from '../recipes/leave-guard';
import { kindNames, statusNames, today, type StockDocument } from './types';
import { remaining, scaled } from './inventory.schemas';

const receiving = z
  .object({
    businessDate: z.iso.date('Isi tanggal yang valid.'),
    note: z.string().trim().min(3, 'Isi catatan penerimaan/selisih.').max(500),
    lines: z.array(
      z.object({
        lineId: z.string(),
        quantity: z
          .string()
          .refine(
            (v) => v === '' || /^\d{1,9}(\.\d{1,6})?$/.test(v),
            'Isi angka positif dengan titik desimal.',
          ),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (
      !data.lines.some((l) => /^\d{1,9}(\.\d{1,6})?$/.test(l.quantity) && scaled(l.quantity) > 0n)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Isi minimal satu jumlah terima yang positif.',
      });
  });
type Receiving = z.infer<typeof receiving>;

export function StockDetail({
  id,
  user,
  onBack,
  registerLeaveGuard,
}: {
  id: string;
  user: SessionUser;
  onBack: () => void;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const data = useQuery({
    queryKey: ['inventory', 'document', id],
    queryFn: () => api<StockDocument>(`inventory/documents/${id}`),
  });
  const action = useMutation({
    mutationFn: (doc: StockDocument) =>
      api<StockDocument>(
        `inventory/documents/${doc.id}/${doc.kind === 'TRANSFER' ? 'ship' : 'post'}`,
        {},
      ),
  });
  const doc = data.data;
  const canPost =
    doc &&
    (user.role === 'CENTRAL_ADMIN' ||
      (user.role === 'DC_ADMIN' &&
        user.locationId === doc.locationId &&
        (doc.kind === 'TRANSFER' || doc.kind === 'RECEIPT')));
  const canReceive =
    doc &&
    doc.status === 'SHIPPED' &&
    (user.role === 'CENTRAL_ADMIN' || user.locationId === doc.destinationId);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['inventory'] });
  };
  return (
    <div className="space-y-5">
      {!canReceive && (
        <Button variant="ghost" disabled={action.isPending} onClick={onBack}>
          ← Kembali ke daftar
        </Button>
      )}
      <ErrorNotice error={data.error} />
      {data.isLoading && <p role="status">Memuat dokumen…</p>}
      {data.error && (
        <Button variant="outline" onClick={() => void data.refetch()}>
          Coba lagi
        </Button>
      )}
      {doc && (
        <>
          <div>
            <h2 className="text-2xl font-bold">
              {kindNames[doc.kind]} · {doc.reference}
            </h2>
            <p className="text-sm text-muted-foreground">
              {statusNames[doc.status]} · {doc.businessDate.slice(0, 10)}
            </p>
          </div>
          {message && (
            <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
              {message}
            </p>
          )}
          <Card className="space-y-3">
            <p>
              <strong>{doc.location.name}</strong>
              {doc.destination && (
                <>
                  {' '}
                  → <strong>{doc.destination.name}</strong>
                </>
              )}
            </p>
            {doc.supplierName && <p>Supplier: {doc.supplierName}</p>}
            <p className="break-words text-sm">{doc.reason}</p>
            <p className="text-xs text-muted-foreground">
              Jumlah barang saja; bukan nilai persediaan/HPP, pembayaran atau tagihan mitra.
            </p>
          </Card>
          <Card className="space-y-3">
            <h3 className="font-bold">Rincian barang</h3>
            {doc.lines.map((line) => (
              <div
                key={line.id}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-3"
              >
                <div>
                  <p className="font-semibold">{line.stockItem.name}</p>
                  <p className="text-xs text-muted-foreground">{line.stockItem.code}</p>
                </div>
                <div className="text-sm">
                  <p>
                    {line.quantity} {line.stockItem.baseUnit.code}
                  </p>
                  {doc.kind === 'TRANSFER' && (
                    <p>
                      Terima {line.receivedQuantity} ·{' '}
                      {doc.status === 'DRAFT' ? 'Rencana' : 'Sisa perjalanan'}{' '}
                      {remaining(line.quantity, line.receivedQuantity)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </Card>
          <ErrorNotice error={action.error} />
          {canPost && doc.status === 'DRAFT' && (
            <Button disabled={action.isPending} onClick={() => setConfirm(true)}>
              {doc.kind === 'TRANSFER' ? 'Konfirmasi kirim' : 'Konfirmasi masuk buku stok'}
            </Button>
          )}
          {doc.status === 'DRAFT' && (
            <p className="text-sm text-muted-foreground">
              Draft tidak mengubah stok. Rincian tersimpan belum dapat diedit/dibatalkan pada tahap
              ini; draft keliru jangan dikonfirmasi. Buat draft baru yang benar.
            </p>
          )}
          {canReceive && (
            <ReceiveForm
              key={doc.id + doc.receipts.length}
              doc={doc}
              registerLeaveGuard={registerLeaveGuard}
              onBack={onBack}
              onSaved={async () => {
                setMessage('Penerimaan tercatat. Sisa yang belum diterima tetap dalam perjalanan.');
                await refresh();
              }}
            />
          )}
          {doc.receipts.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-bold">Riwayat penerimaan</h3>
              {doc.receipts.map((event) => (
                <p className="break-words text-sm" key={event.id}>
                  {event.businessDate.slice(0, 10)} · {event.note}
                </p>
              ))}
            </Card>
          )}
          {confirm && (
            <FormDialog
              title={doc.kind === 'TRANSFER' ? 'Kirim barang ini?' : 'Masukkan ke buku stok?'}
              description="Konfirmasi hanya ketika jumlah dan dokumen sudah diverifikasi. Mutasi tercatat tidak dihapus; koreksi menggunakan dokumen terpisah."
              dirty={false}
              busy={action.isPending}
              onClose={() => setConfirm(false)}
              footer={
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => setConfirm(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    disabled={action.isPending}
                    onClick={async () => {
                      try {
                        await action.mutateAsync(doc);
                        setConfirm(false);
                        setMessage('Konfirmasi berhasil. Stok sudah diperbarui.');
                        await refresh();
                      } catch {
                        /* Mutation error is shown and document stays visible. */
                      }
                    }}
                  >
                    {action.isPending ? 'Memproses…' : 'Ya, konfirmasi'}
                  </Button>
                </div>
              }
            >
              <ErrorNotice error={action.error} />
              <p className="text-sm">
                {doc.kind === 'TRANSFER'
                  ? 'Stok sumber berkurang; tujuan belum bertambah sebelum diterima.'
                  : 'Jumlah pada dokumen akan dicatat pada lokasi ini.'}
              </p>
            </FormDialog>
          )}
        </>
      )}
    </div>
  );
}

function ReceiveForm({
  doc,
  registerLeaveGuard,
  onBack,
  onSaved,
}: {
  doc: StockDocument;
  registerLeaveGuard: RegisterLeaveGuard;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const prefix = useId();
  const receiptId = useRef(crypto.randomUUID());
  const flight = useRef(false);
  const openLines = doc.lines.filter((l) => remaining(l.quantity, l.receivedQuantity) !== '0');
  const form = useForm<Receiving>({
    resolver: zodResolver(receiving),
    mode: 'onBlur',
    defaultValues: {
      businessDate: today(),
      note: '',
      lines: openLines.map((l) => ({ lineId: l.id, quantity: '' })),
    },
  });
  const mutation = useMutation({
    mutationFn: (data: Receiving) =>
      api<StockDocument>(`inventory/documents/${doc.id}/receive`, {
        ...data,
        id: receiptId.current,
        lines: data.lines.filter((l) => l.quantity !== '' && scaled(l.quantity) > 0n),
      }),
  });
  const leave = useEditorLeaveGuard(
    form.formState.isDirty,
    mutation.isPending,
    registerLeaveGuard,
    'Penerimaan barang',
  );
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (data) => {
    if (flight.current) return;
    for (let i = 0; i < data.lines.length; i++)
      if (
        data.lines[i].quantity &&
        scaled(data.lines[i].quantity) >
          scaled(remaining(openLines[i].quantity, openLines[i].receivedQuantity))
      ) {
        form.setError(`lines.${i}.quantity`, { message: 'Melebihi sisa kiriman.' });
        return;
      }
    flight.current = true;
    form.clearErrors('root.server');
    try {
      await mutation.mutateAsync(data);
      form.reset();
      await onSaved();
    } catch (error) {
      applyFormError(error, form, ['businessDate', 'note']);
    } finally {
      flight.current = false;
    }
  });
  return (
    <>
      <Button
        variant="ghost"
        disabled={mutation.isPending}
        onClick={() => leave.requestLeave(onBack)}
      >
        ← Kembali ke daftar
      </Button>
      <Card className="space-y-4">
        <h3 className="font-bold">Konfirmasi jumlah yang benar-benar diterima</h3>
        <p className="text-sm text-muted-foreground">
          Isi jumlah tambahan yang diterima sekarang, bukan total kumulatif. Kosongkan barang yang
          belum diterima. Sisa/selisih tetap terbuka; belum ada penyelesaian kehilangan atau retur
          pada tahap ini.
        </p>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <FormField
              id={`${prefix}-date`}
              label="Tanggal terima"
              error={errors.businessDate?.message}
            >
              <Input
                type="date"
                max={today()}
                {...form.register('businessDate')}
                {...accessibility(`${prefix}-date`, errors.businessDate?.message)}
              />
            </FormField>
            {openLines.map((l, i) => (
              <FormField
                key={l.id}
                id={`${prefix}-qty-${i}`}
                label={`${l.stockItem.name} (${l.stockItem.baseUnit.code})`}
                required={false}
                hint={`Sisa kiriman: ${remaining(l.quantity, l.receivedQuantity)}`}
                error={errors.lines?.[i]?.quantity?.message}
              >
                <Input
                  inputMode="decimal"
                  {...form.register(`lines.${i}.quantity`)}
                  id={`${prefix}-qty-${i}`}
                  aria-invalid={!!errors.lines?.[i]?.quantity}
                  aria-describedby={`${prefix}-qty-${i}-hint ${prefix}-qty-${i}-error`}
                />
              </FormField>
            ))}
            <FormError message={errors.lines?.message ?? errors.lines?.root?.message} />
            <FormField
              id={`${prefix}-note`}
              label="Catatan penerimaan / selisih"
              error={errors.note?.message}
            >
              <Input
                maxLength={500}
                {...form.register('note')}
                {...accessibility(`${prefix}-note`, errors.note?.message)}
              />
            </FormField>
          </fieldset>
          <FormError message={errors.root?.server?.message} />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Memproses…' : 'Konfirmasi penerimaan aktual'}
          </Button>
        </form>
      </Card>
      {leave.confirmation}
    </>
  );
}
