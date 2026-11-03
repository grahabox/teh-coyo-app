import { useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, type SessionUser } from '../lib/api';
import type { LocationRow, PageResult } from '../lib/types';
import { useDebounced } from '../lib/use-debounced';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { FormDialog } from '../components/ui/form-dialog';
import { PagedPicker } from '../components/paged-picker';
import { Pagination } from '../components/pagination';
import { ErrorNotice } from '../components/forms';
import { FormError, FormField, accessibility, applyFormError } from '../components/form-helpers';
import type { RegisterLeaveGuard } from './recipes/leave-guard';
import { PurchaseEditor } from './purchasing/purchase.editor';
import { PurchaseDetail } from './purchasing/purchase.detail';
import { supplierFormSchema } from './purchasing/purchase.schemas';
import {
  paymentNames,
  receiptNames,
  rupiah,
  type Purchase,
  type Supplier,
} from './purchasing/types';

export function Purchasing({
  user,
  registerLeaveGuard,
}: {
  user: SessionUser;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState<'invoices' | 'suppliers'>('invoices');
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState(false);
  const [message, setMessage] = useState('');
  const q = useDebounced(search);
  const allowed = user.role === 'CENTRAL_ADMIN' || user.role === 'DC_ADMIN';
  const result = useQuery({
    queryKey: ['purchasing', tab, location?.id, q, page],
    enabled:
      allowed &&
      !editor &&
      !detail &&
      (tab === 'suppliers' || (!!location && location.ownership !== 'PARTNER')),
    queryFn: () =>
      api<PageResult<Purchase | Supplier>>(
        `purchasing/${tab}?q=${encodeURIComponent(q)}&page=${page}&perPage=25${tab === 'invoices' ? `&locationId=${location?.id}` : ''}`,
      ),
  });
  if (!allowed)
    return (
      <Card>
        <p>
          Modul pembelian tahap ini hanya untuk admin pusat/DC. Pembelian mitra dan izin belanja
          kasir belum diaktifkan.
        </p>
      </Card>
    );
  if (editor && location)
    return (
      <PurchaseEditor
        location={location}
        registerLeaveGuard={registerLeaveGuard}
        onBack={() => setEditor(false)}
        onSaved={(p) => {
          setEditor(false);
          setDetail(p.id);
          void client.invalidateQueries({ queryKey: ['purchasing'] });
        }}
      />
    );
  if (detail)
    return (
      <PurchaseDetail
        id={detail}
        user={user}
        registerLeaveGuard={registerLeaveGuard}
        onBack={() => setDetail(null)}
      />
    );
  const writable =
    location &&
    location.ownership !== 'PARTNER' &&
    (user.role === 'CENTRAL_ADMIN' || location.id === user.locationId);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Pembelian</h2>
        <p className="text-sm text-muted-foreground">
          Nota supplier, penerimaan aktual dan catatan pembayaran. Belum jurnal kas/bank, HPP atau
          perhitungan pajak.
        </p>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Pembelian dan supplier">
        {(['invoices', 'suppliers'] as const).map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => {
              setTab(t);
              setPage(1);
              setSearch('');
              setMessage('');
            }}
          >
            {t === 'invoices' ? 'Nota pembelian' : 'Supplier'}
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
          {message}
        </p>
      )}
      {tab === 'invoices' && (
        <Card className="space-y-3">
          <label htmlFor="purchase-location" className="font-semibold">
            Lokasi pembelian
          </label>
          <PagedPicker<LocationRow>
            id="purchase-location"
            endpoint="locations/page?ownership=OWNED"
            value={location}
            placeholder="Pilih lokasi pembelian"
            onSelect={(v) => {
              setLocation(v);
              setPage(1);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Nota menjadi tanggungan pemilik usaha lokasi. Transfer pusat–DC bukan pembelian supplier
            eksternal.
          </p>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        {tab === 'invoices' && writable && (
          <Button onClick={() => setEditor(true)}>+ Buat nota pembelian</Button>
        )}
        {tab === 'suppliers' && user.role === 'CENTRAL_ADMIN' && (
          <Button onClick={() => setSupplierForm(true)}>+ Tambah supplier</Button>
        )}
        {(tab === 'suppliers' || location) && (
          <Input
            className="sm:max-w-md"
            aria-label="Cari pembelian atau supplier"
            value={search}
            maxLength={100}
            placeholder={
              tab === 'invoices'
                ? 'Cari nomor nota atau supplier…'
                : 'Cari nama atau kode supplier…'
            }
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>
      <ErrorNotice error={result.error} />
      {result.error && (
        <Button variant="outline" onClick={() => void result.refetch()}>
          Coba lagi
        </Button>
      )}
      {result.isFetching && <p role="status">Memuat…</p>}
      {result.data && !result.isFetching && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.items.map((row) =>
              tab === 'suppliers' ? (
                <Card key={row.id}>
                  <h3 className="font-bold">{(row as Supplier).name}</h3>
                  <p className="text-sm text-muted-foreground">{(row as Supplier).code}</p>
                </Card>
              ) : (
                (() => {
                  const p = row as Purchase;
                  return (
                    <Card key={p.id} className="space-y-2">
                      <h3 className="break-words font-bold">{p.invoiceReference}</h3>
                      <p className="text-sm">
                        {p.supplierName} · {p.status === 'DRAFT' ? 'Draft' : 'Dikonfirmasi'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {receiptNames[p.receiptStatus]} · {paymentNames[p.paymentStatus]}
                      </p>
                      <p className="font-semibold">{rupiah(p.totalAmount)}</p>
                      <p className="text-sm">Sisa tagihan {rupiah(p.outstandingAmount)}</p>
                      <Button variant="outline" onClick={() => setDetail(p.id)}>
                        Buka nota
                      </Button>
                    </Card>
                  );
                })()
              ),
            )}
          </div>
          {!result.data.items.length && (
            <Card>
              <p>
                Belum ada {tab === 'invoices' ? 'nota pembelian' : 'supplier'} yang sesuai. Tidak
                ada impor atau data pembelian otomatis.
              </p>
            </Card>
          )}
          <Pagination {...result.data} busy={result.isFetching} onPage={setPage} />
        </>
      )}
      {tab === 'invoices' && !location && (
        <Card>
          <p>Pilih lokasi untuk melihat dan mencatat pembelian.</p>
        </Card>
      )}
      {supplierForm && (
        <SupplierDialog
          onClose={() => setSupplierForm(false)}
          onSaved={(supplier) => {
            setSupplierForm(false);
            setMessage(`Supplier ${supplier.name} berhasil ditambahkan.`);
            void client.invalidateQueries({ queryKey: ['purchasing'] });
            void client.invalidateQueries({ queryKey: ['organization-options'] });
          }}
        />
      )}
    </div>
  );
}

function SupplierDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
}) {
  const prefix = useId();
  const id = useRef(crypto.randomUUID());
  const flight = useRef(false);
  const form = useForm<z.infer<typeof supplierFormSchema>>({
    resolver: zodResolver(supplierFormSchema),
    mode: 'onBlur',
    defaultValues: { code: '', name: '' },
  });
  const errors = form.formState.errors;
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof supplierFormSchema>) =>
      api<Supplier>('purchasing/suppliers', { ...data, id: id.current }),
  });
  const submit = form.handleSubmit(async (data) => {
    if (flight.current) return;
    flight.current = true;
    form.clearErrors('root.server');
    try {
      onSaved(await mutation.mutateAsync(data));
    } catch (e) {
      applyFormError(e, form, ['code', 'name']);
    } finally {
      flight.current = false;
    }
  });
  return (
    <FormDialog
      title="Tambah supplier"
      description="Master supplier eksternal. Tidak mengimpor supplier Accurate atau membuat transaksi pembelian."
      dirty={form.formState.isDirty}
      busy={mutation.isPending}
      onClose={onClose}
      footer={(close) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={mutation.isPending} onClick={close}>
            Batal
          </Button>
          <Button type="submit" form={`${prefix}-form`} disabled={mutation.isPending}>
            {mutation.isPending ? 'Menyimpan…' : 'Simpan supplier'}
          </Button>
        </div>
      )}
    >
      <form id={`${prefix}-form`} onSubmit={submit} noValidate className="space-y-4">
        <fieldset disabled={mutation.isPending} className="space-y-4">
          {(['code', 'name'] as const).map((k) => (
            <FormField
              key={k}
              id={`${prefix}-${k}`}
              label={k === 'code' ? 'Kode supplier' : 'Nama supplier'}
              error={errors[k]?.message}
            >
              <Input
                {...form.register(k)}
                {...accessibility(`${prefix}-${k}`, errors[k]?.message)}
                maxLength={k === 'code' ? 40 : 120}
                data-dialog-focus={k === 'code' ? true : undefined}
              />
            </FormField>
          ))}
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}
