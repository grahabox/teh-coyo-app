import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { Entity, Location, LocationRow } from '../../lib/types';
import { api } from '../../lib/api';
import { FormDialog } from '../../components/ui/form-dialog';
import { Input } from '../../components/ui/input';
import { PagedPicker } from '../../components/paged-picker';
import { Select } from '../../components/forms';
import {
  Footer,
  FormError,
  FormField,
  accessibility,
  useSave,
} from '../../components/form-helpers';
import {
  entityFormSchema,
  locationFormSchema,
  locationLabel,
  type EntityFormValues,
  type LocationFormValues,
} from './location.schemas';

export function EntityDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (entity: Entity) => void;
}) {
  const id = useId();
  const form = useForm<EntityFormValues>({
    resolver: zodResolver(entityFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { name: '', code: '' },
  });
  const save = useSave<EntityFormValues, Entity>('entities', form, ['name', 'code'], onSaved);
  const errors = form.formState.errors;
  const code = form.register('code');
  return (
    <FormDialog
      title="Tambah pemilik usaha"
      description="Daftarkan usaha Teh Coyo atau pemilik mitra. Ini tidak menetapkan bentuk hukum atau aturan pajak."
      dirty={form.formState.isDirty}
      busy={save.busy}
      onClose={onClose}
      footer={(cancel) => (
        <Footer formId={id} busy={save.busy} onCancel={cancel} label="Simpan pemilik usaha" />
      )}
    >
      <form id={id} noValidate onSubmit={save.submit} className="space-y-5">
        <fieldset disabled={save.busy} className="space-y-5">
          <FormField id={`${id}-name`} label="Nama pemilik usaha" error={errors.name?.message}>
            <Input
              data-dialog-focus
              maxLength={120}
              placeholder="Contoh: Teh Coyo / Usaha Pak Budi"
              {...form.register('name')}
              {...accessibility(`${id}-name`, errors.name?.message)}
            />
          </FormField>
          <FormField
            id={`${id}-code`}
            label="Kode pemilik usaha"
            hint="Kode unik. Contoh: COYO atau MITRA-BUDI."
            error={errors.code?.message}
          >
            <Input
              maxLength={40}
              autoCapitalize="characters"
              spellCheck={false}
              {...code}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void code.onChange(event);
              }}
              {...accessibility(`${id}-code`, errors.code?.message, true)}
            />
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}

export function LocationDialog({
  type,
  initialParent,
  onClose,
  onSaved,
}: {
  type: Location['type'];
  initialParent?: LocationRow;
  onClose: () => void;
  onSaved: (location: Location) => void;
}) {
  const id = useId();
  const label = locationLabel(type);
  const [parent, setParent] = useState<LocationRow | null>(initialParent ?? null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      code: '',
      type,
      ownership: 'OWNED',
      parentId: initialParent?.id ?? null,
      entityId: initialParent?.entityId ?? '',
    },
  });
  const save = useSave<LocationFormValues, Location>(
    'locations',
    form,
    ['name', 'code', 'parentId', 'entityId', 'ownership'],
    onSaved,
  );
  const errors = form.formState.errors;
  const ownership = form.watch('ownership');
  const code = form.register('code');
  const partner = type === 'STAND' && ownership === 'PARTNER';
  const needEntity = type === 'CENTER' || partner;
  const parentLabel = type === 'DC' ? 'Pusat yang membawahi DC' : 'DC pembina';

  return (
    <FormDialog
      title={`Tambah ${label}`}
      description={
        type === 'CENTER'
          ? 'Daftarkan pusat utama penyimpanan barang.'
          : type === 'DC'
            ? 'Daftarkan DC di bawah pusat. Pemilik usaha mengikuti pusat yang dipilih.'
            : 'Daftarkan stand dan pilih DC yang menanganinya. Stand sendiri dan mitra memiliki aturan penyelesaian uang berbeda.'
      }
      dirty={form.formState.isDirty}
      busy={save.busy}
      onClose={onClose}
      footer={(cancel) => (
        <Footer formId={id} busy={save.busy} onCancel={cancel} label={`Simpan ${label}`} />
      )}
    >
      <form id={id} noValidate onSubmit={save.submit} className="space-y-5">
        <fieldset disabled={save.busy} className="space-y-5">
          <FormField id={`${id}-name`} label={`Nama ${label}`} error={errors.name?.message}>
            <Input
              data-dialog-focus
              maxLength={120}
              placeholder={
                type === 'CENTER'
                  ? 'Contoh: Pusat Teh Coyo'
                  : type === 'DC'
                    ? 'Contoh: DC Cirebon'
                    : 'Contoh: Stand Kesambi'
              }
              {...form.register('name')}
              {...accessibility(`${id}-name`, errors.name?.message)}
            />
          </FormField>
          <FormField
            id={`${id}-code`}
            label={`Kode ${label}`}
            hint="Kode unik, bukan alamat. Gunakan huruf, angka, - atau _."
            error={errors.code?.message}
          >
            <Input
              maxLength={40}
              autoCapitalize="characters"
              spellCheck={false}
              {...code}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void code.onChange(event);
              }}
              {...accessibility(`${id}-code`, errors.code?.message, true)}
            />
          </FormField>
          {type !== 'CENTER' && (
            <FormField id={`${id}-parent`} label={parentLabel} error={errors.parentId?.message}>
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <PagedPicker<LocationRow>
                    endpoint={`locations/page?type=${type === 'DC' ? 'CENTER' : 'DC'}`}
                    value={parent}
                    placeholder={type === 'DC' ? 'Pilih pusat' : 'Pilih DC'}
                    {...accessibility(`${id}-parent`, errors.parentId?.message)}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    disabled={save.busy}
                    onSelect={(location) => {
                      setParent(location);
                      field.onChange(location.id);
                      if (!partner)
                        form.setValue('entityId', location.entityId, { shouldDirty: true });
                      else if (entity?.id === location.entityId) {
                        setEntity(null);
                        form.setValue('entityId', '', { shouldValidate: true });
                      }
                    }}
                  />
                )}
              />
            </FormField>
          )}
          {type === 'STAND' && (
            <FormField
              id={`${id}-ownership`}
              label="Kepemilikan stand"
              error={errors.ownership?.message}
            >
              <Select
                {...form.register('ownership')}
                onChange={(event) => {
                  const value = event.target.value as Location['ownership'];
                  form.setValue('ownership', value, { shouldDirty: true, shouldValidate: true });
                  setEntity(null);
                  form.setValue('entityId', value === 'OWNED' ? (parent?.entityId ?? '') : '', {
                    shouldDirty: true,
                  });
                  form.clearErrors('entityId');
                }}
                {...accessibility(`${id}-ownership`, errors.ownership?.message)}
              >
                <option value="OWNED">Milik Teh Coyo</option>
                <option value="PARTNER">Milik mitra</option>
              </Select>
            </FormField>
          )}
          {needEntity ? (
            <FormField
              id={`${id}-entity`}
              label={partner ? 'Pemilik mitra' : 'Pemilik usaha'}
              hint="Pemilik belum terdaftar? Tambahkan dari tab Pemilik Usaha terlebih dahulu; data lokasi belum akan disimpan."
              error={errors.entityId?.message}
            >
              <Controller
                name="entityId"
                control={form.control}
                render={({ field }) => (
                  <PagedPicker<Entity>
                    endpoint={`entities/page${partner && parent ? `?excludeEntityId=${parent.entityId}` : ''}`}
                    value={entity}
                    placeholder={partner ? 'Pilih pemilik mitra' : 'Pilih pemilik usaha'}
                    {...accessibility(`${id}-entity`, errors.entityId?.message, true)}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    disabled={save.busy || (partner && !parent)}
                    onSelect={(selected) => {
                      setEntity(selected);
                      field.onChange(selected.id);
                    }}
                  />
                )}
              />
            </FormField>
          ) : (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              Pemilik usaha:{' '}
              <strong className="text-foreground">
                {parent?.entity.name ?? 'Mengikuti lokasi induk setelah dipilih'}
              </strong>
            </p>
          )}
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}

export function LocationDetailDialog({
  id: locationId,
  onClose,
  onViewChildren,
}: {
  id: string;
  onClose: () => void;
  onViewChildren: (location: LocationRow) => void;
}) {
  const data = useQuery({
    queryKey: ['location-detail', locationId],
    queryFn: () => api<LocationRow>(`locations/${locationId}/detail`),
  });
  return (
    <FormDialog
      title={data.data?.name ?? 'Detail lokasi'}
      description="Informasi lokasi dalam cakupan akunmu. Perubahan data belum tersedia pada tahap ini."
      dirty={false}
      busy={false}
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Tutup detail
        </button>
      )}
    >
      {data.isPending && <p role="status">Memuat detail…</p>}
      {data.error && <FormError message="Detail belum dapat dimuat. Tutup lalu coba kembali." />}
      {data.data && (
        <dl className="space-y-4 text-sm">
          {[
            ['Kode', data.data.code],
            ['Jenis', locationLabel(data.data.type)],
            ['Pemilik usaha', data.data.entity.name],
            ...(data.data.parent
              ? [[data.data.type === 'STAND' ? 'DC pembina' : 'Pusat', data.data.parent.name]]
              : []),
            ...(data.data.type === 'STAND'
              ? [['Kepemilikan', data.data.ownership === 'OWNED' ? 'Sendiri' : 'Mitra']]
              : []),
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-semibold">{value}</dd>
            </div>
          ))}
          {data.data.type !== 'STAND' && (
            <div>
              <dt className="text-muted-foreground">
                {data.data.type === 'DC' ? 'Stand binaan' : 'DC di bawah pusat'}
              </dt>
              <dd className="mt-1 font-semibold">{data.data._count.children} lokasi</dd>
              <button
                type="button"
                className="mt-3 min-h-11 rounded-xl border border-border px-4 font-semibold text-primary"
                onClick={() => onViewChildren(data.data!)}
              >
                Lihat {data.data.type === 'DC' ? 'stand binaan' : 'daftar DC'}
              </button>
            </div>
          )}
        </dl>
      )}
    </FormDialog>
  );
}
