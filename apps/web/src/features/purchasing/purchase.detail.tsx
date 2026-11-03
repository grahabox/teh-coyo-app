import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SessionUser } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { FormDialog } from '../../components/ui/form-dialog';
import { ErrorNotice } from '../../components/forms';
import type { RegisterLeaveGuard } from '../recipes/leave-guard';
import { remaining } from '../inventory/inventory.schemas';
import { rupiah, receiptNames, paymentNames, type Purchase } from './types';
import { PurchaseLink, PurchasePayment, PurchaseReceive } from './purchase.actions';

export function PurchaseDetail({
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
  const [mode, setMode] = useState<'receive' | 'link' | 'payment' | null>(null);
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['purchasing', 'invoice', id],
    queryFn: () => api<Purchase>(`purchasing/invoices/${id}`),
  });
  const action = useMutation({
    mutationFn: () => api<Purchase>(`purchasing/invoices/${id}/confirm`, {}),
  });
  const p = query.data;
  const writable =
    p &&
    (user.role === 'CENTRAL_ADMIN' ||
      (user.role === 'DC_ADMIN' && user.locationId === p.locationId));
  const saved = (p: Purchase) => {
    client.setQueryData(['purchasing', 'invoice', id], p);
    setMode(null);
    setMessage('Dokumen berhasil diperbarui.');
    void client.invalidateQueries({ queryKey: ['purchasing'] });
    void client.invalidateQueries({ queryKey: ['inventory'] });
  };
  const props = p
    ? { purchase: p, onBack: () => setMode(null), onSaved: saved, registerLeaveGuard }
    : null;
  return (
    <div className="space-y-5">
      {!mode && (
        <Button variant="ghost" disabled={action.isPending} onClick={onBack}>
          ← Kembali ke pembelian
        </Button>
      )}
      <ErrorNotice error={query.error} />
      {query.isLoading && <p role="status">Memuat nota…</p>}
      {query.error && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      )}
      {p && (
        <>
          <div>
            <h2 className="break-words text-2xl font-bold">Nota {p.invoiceReference}</h2>
            <p className="text-sm text-muted-foreground">
              {p.status === 'DRAFT' ? 'Draft' : 'Dikonfirmasi'} · {receiptNames[p.receiptStatus]} ·{' '}
              {paymentNames[p.paymentStatus]}
            </p>
          </div>
          {message && (
            <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
              {message}
            </p>
          )}
          <Card className="space-y-2">
            <p className="font-semibold">
              {p.supplierName} · {p.location.name}
            </p>
            <p className="text-sm">
              Tanggal nota {p.businessDate.slice(0, 10)}
              {p.dueDate && ` · Jatuh tempo ${p.dueDate.slice(0, 10)}`}
            </p>
            <p className="break-words text-sm">{p.note}</p>
            <p className="text-xs text-muted-foreground">
              Nota barang dalam IDR, belum pajak/diskon/ongkir, jurnal akuntansi atau perhitungan
              HPP.
            </p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Total nota', p.totalAmount],
              ['Pembayaran tercatat', p.paidAmount],
              ['Sisa tagihan', p.outstandingAmount],
            ].map(([name, v]) => (
              <Card key={name}>
                <p className="text-sm text-muted-foreground">{name}</p>
                <p className="break-words text-xl font-bold">{rupiah(v)}</p>
              </Card>
            ))}
          </div>
          <Card className="space-y-3">
            <h3 className="font-bold">Rincian barang</h3>
            {p.lines.map((l) => (
              <div key={l.id} className="space-y-1 border-b border-border py-3">
                <p className="font-semibold">{l.stockItem.name}</p>
                <p className="text-sm">
                  {l.quantity} {l.stockItem.baseUnit.code} × {rupiah(l.unitPrice)} ={' '}
                  {rupiah(l.lineAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Terima {l.receivedQuantity} · Sisa nota{' '}
                  {remaining(l.quantity, l.receivedQuantity)} {l.stockItem.baseUnit.code}
                </p>
              </div>
            ))}
          </Card>
          {writable && !mode && (
            <div className="flex flex-wrap gap-2">
              {p.status === 'DRAFT' ? (
                <Button disabled={action.isPending} onClick={() => setConfirm(true)}>
                  Konfirmasi nota
                </Button>
              ) : (
                <>
                  {p.receiptStatus !== 'COMPLETE' && (
                    <>
                      <Button
                        onClick={() => {
                          setMessage('');
                          setMode('receive');
                        }}
                      >
                        Terima barang pembelian
                      </Button>
                      <Button variant="outline" onClick={() => setMode('link')}>
                        Tautkan penerimaan existing
                      </Button>
                    </>
                  )}
                  {p.paymentStatus !== 'PAID' && (
                    <Button variant="outline" onClick={() => setMode('payment')}>
                      Catat pembayaran
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
          {p.status === 'DRAFT' && (
            <p className="text-sm text-muted-foreground">
              Draft tidak mengubah stok atau kas. Edit/batal nota belum tersedia; jangan konfirmasi
              draft keliru. Nota yang belum dikonfirmasi bukan tagihan final.
            </p>
          )}
          {mode === 'receive' && props && <PurchaseReceive {...props} />}
          {mode === 'payment' && props && <PurchasePayment {...props} />}
          {mode === 'link' && props && <PurchaseLink {...props} />}
          <Card className="space-y-3">
            <h3 className="font-bold">Penerimaan terkait</h3>
            {p.receipts.length ? (
              p.receipts.map((r) => (
                <p className="break-words text-sm" key={r.id}>
                  {r.stockDocument.businessDate.slice(0, 10)} · {r.stockDocument.reference} ·{' '}
                  {r.linkedExisting
                    ? 'Tautan existing, stok tidak bertambah lagi'
                    : 'Penerimaan dari nota, masuk buku stok'}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada penerimaan.</p>
            )}
          </Card>
          <Card className="space-y-3">
            <h3 className="font-bold">Catatan pembayaran</h3>
            <p className="text-xs text-muted-foreground">
              Belum rekonsiliasi atau mutasi saldo kas/bank. Pembayaran tidak menentukan status
              barang diterima.
            </p>
            {p.payments.length ? (
              p.payments.map((v) => (
                <div key={v.id} className="space-y-1 border-b border-border py-2">
                  <p className="break-words text-sm">
                    {v.businessDate.slice(0, 10)} · {rupiah(v.amount)} ·{' '}
                    {v.method === 'CASH' ? 'Tunai' : 'Transfer bank'}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {v.reference} · {v.fundingSource} · {v.note}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
            )}
          </Card>
          <ErrorNotice error={action.error} />
          {confirm && (
            <FormDialog
              title="Konfirmasi nota pembelian?"
              description="Pastikan nomor nota, supplier, jumlah dan harga sesuai bukti. Konfirmasi mengunci dasar tagihan, bukan menambah stok atau mencatat pembayaran."
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
                        saved(await action.mutateAsync());
                        setConfirm(false);
                      } catch {
                        /* Error stays visible. */
                      }
                    }}
                  >
                    {action.isPending ? 'Memproses…' : 'Ya, konfirmasi nota'}
                  </Button>
                </div>
              }
            >
              <p>
                Total nota: <strong>{rupiah(p.totalAmount)}</strong>
              </p>
              <ErrorNotice error={action.error} />
            </FormDialog>
          )}
        </>
      )}
    </div>
  );
}
