import { useId, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { api, type SessionUser } from '../../lib/api';
import type { Item, LocationRow, Recipe, Unit, Variant } from '../../lib/types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { PagedPicker } from '../../components/paged-picker';
import { ErrorNotice, Select } from '../../components/forms';
import { applyFormError, FormError, FormField, accessibility } from '../../components/form-helpers';
import { unitLabel } from '../catalog/catalog.schemas';
import {
  compatibleUnits,
  recipeFormSchema,
  recipePayload,
  type RecipeFormValues,
} from './recipe.schemas';
import { useEditorLeaveGuard, type RegisterLeaveGuard } from './leave-guard';

export function RecipeEditor({
  kind,
  user,
  onBack,
  onSaved,
  registerLeaveGuard,
}: {
  kind: Recipe['kind'];
  user: SessionUser;
  onBack: () => void;
  onSaved: (recipe: Recipe) => void;
  registerLeaveGuard: RegisterLeaveGuard;
}) {
  const id = useId();
  const [output, setOutput] = useState<Item | null>(null);
  const [menu, setMenu] = useState<Variant | null>(null);
  const [dc, setDc] = useState<LocationRow | null>(null);
  const [specificDc, setSpecificDc] = useState(user.role === 'DC_ADMIN');
  const [selectedItems, setSelectedItems] = useState<Record<string, Item>>({});
  const units = useQuery({
    queryKey: ['catalog-units'],
    queryFn: () => api<Unit[]>('catalog/units'),
  });
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      kind,
      scopeLocationId: user.role === 'DC_ADMIN' ? user.locationId : null,
      outputItemId: '',
      menuVariantId: '',
      outputQuantity: kind === 'SERVING' ? '1' : '',
      outputUnitCode: kind === 'SERVING' ? 'pcs' : '',
      components: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'components' });
  const values = form.watch();
  const errors = form.formState.errors;
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (data: RecipeFormValues) => api<Recipe>('recipes', recipePayload(data)),
  });
  const busy = mutation.isPending;
  const leave = useEditorLeaveGuard(form.formState.isDirty, busy, registerLeaveGuard);
  const heading = kind === 'PRODUCTION' ? 'Buat resep produksi DC' : 'Buat takaran per cup';
  const submit = form.handleSubmit(async (data) => {
    if (inFlight.current) return;
    if (specificDc && !data.scopeLocationId) {
      form.setError('scopeLocationId', { message: 'Pilih DC yang menggunakan resep ini.' });
      form.setFocus('scopeLocationId');
      return;
    }
    inFlight.current = true;
    form.clearErrors('root.server');
    try {
      onSaved(await mutation.mutateAsync(data));
    } catch (error) {
      applyFormError(error, form, [
        'name',
        'scopeLocationId',
        'outputItemId',
        'menuVariantId',
        'outputQuantity',
        'outputUnitCode',
        ...data.components.flatMap(
          (_line, index) =>
            [
              `components.${index}.stockItemId`,
              `components.${index}.quantity`,
              `components.${index}.unitCode`,
            ] as const,
        ),
      ]);
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={busy} onClick={() => leave.requestLeave(onBack)}>
          <ArrowLeft size={18} />
          Kembali ke daftar
        </Button>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Draft · belum aktif
        </span>
      </div>
      <div>
        <h2 className="text-xl font-bold">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {kind === 'PRODUCTION'
            ? 'Tentukan bahan dan hasil standar satu batch. Hasil produksi aktual akan dicatat terpisah.'
            : 'Isi komposisi untuk satu cup minuman. Original dapat tanpa powder; setiap rasa boleh memakai takaran berbeda.'}
        </p>
      </div>
      <ErrorNotice error={units.error} />
      {units.error && (
        <Button variant="outline" onClick={() => void units.refetch()}>
          Muat ulang satuan
        </Button>
      )}
      <form id={id} noValidate onSubmit={submit} className="space-y-5">
        <fieldset
          disabled={busy}
          className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]"
        >
          <div className="min-w-0 space-y-5">
            <Card className="space-y-5">
              <div>
                <h3 className="font-bold">1. Informasi resep</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nama dan tempat resep digunakan.
                </p>
              </div>
              <FormField id={`${id}-name`} label="Nama resep" error={errors.name?.message}>
                <Input
                  maxLength={120}
                  placeholder={
                    kind === 'PRODUCTION' ? 'Contoh: Teh Dasar' : 'Contoh: Takaran Coklat'
                  }
                  {...form.register('name')}
                  {...accessibility(`${id}-name`, errors.name?.message)}
                />
              </FormField>
              {user.role === 'CENTRAL_ADMIN' ? (
                <>
                  <FormField id={`${id}-scope-choice`} label="Berlaku untuk">
                    <Select
                      id={`${id}-scope-choice`}
                      value={specificDc ? 'DC' : 'ALL'}
                      onChange={(event) => {
                        setSpecificDc(event.target.value === 'DC');
                        setDc(null);
                        form.setValue('scopeLocationId', null, { shouldDirty: true });
                        form.clearErrors('scopeLocationId');
                      }}
                    >
                      <option value="ALL">Semua DC (diatur pusat)</option>
                      <option value="DC">DC tertentu</option>
                    </Select>
                  </FormField>
                  {specificDc && (
                    <FormField
                      id={`${id}-scope`}
                      label="DC yang menggunakan resep"
                      error={errors.scopeLocationId?.message}
                    >
                      <Controller
                        control={form.control}
                        name="scopeLocationId"
                        render={({ field }) => (
                          <PagedPicker<LocationRow>
                            endpoint="locations/page?type=DC"
                            value={dc}
                            placeholder="Pilih DC"
                            disabled={busy}
                            {...accessibility(`${id}-scope`, errors.scopeLocationId?.message)}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            onSelect={(selected) => {
                              setDc(selected);
                              field.onChange(selected.id);
                            }}
                          />
                        )}
                      />
                    </FormField>
                  )}
                </>
              ) : (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  Berlaku untuk: <strong>DC yang ditugaskan pada akunmu</strong>. Admin DC tidak
                  dapat membuat resep global.
                </p>
              )}
            </Card>
            <Card className="space-y-5">
              <div>
                <h3 className="font-bold">
                  {kind === 'PRODUCTION' ? '2. Hasil standar satu batch' : '2. Menu minuman'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {kind === 'PRODUCTION'
                    ? 'Pilih barang hasil, lalu isi jumlah yang diharapkan dari bahan di bawah.'
                    : 'Takaran berikut berlaku untuk satu cup dari menu ini.'}
                </p>
              </div>
              {kind === 'PRODUCTION' ? (
                <>
                  <FormField
                    id={`${id}-output`}
                    label="Barang hasil produksi"
                    error={errors.outputItemId?.message}
                  >
                    <Controller
                      control={form.control}
                      name="outputItemId"
                      render={({ field }) => (
                        <PagedPicker<Item>
                          endpoint="catalog/items/page"
                          value={output}
                          placeholder="Pilih barang hasil"
                          disabled={busy}
                          {...accessibility(`${id}-output`, errors.outputItemId?.message)}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onSelect={(selected) => {
                            setOutput(selected);
                            field.onChange(selected.id);
                            form.setValue('outputUnitCode', selected.baseUnit.code, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                        />
                      )}
                    />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id={`${id}-quantity`}
                      label="Jumlah hasil standar"
                      hint="Gunakan titik untuk desimal, misalnya 2.5. Ini target, bukan hasil aktual."
                      error={errors.outputQuantity?.message}
                    >
                      <Input
                        inputMode="decimal"
                        {...form.register('outputQuantity')}
                        {...accessibility(`${id}-quantity`, errors.outputQuantity?.message, true)}
                      />
                    </FormField>
                    <FormField
                      id={`${id}-unit`}
                      label="Satuan hasil"
                      error={errors.outputUnitCode?.message}
                    >
                      <Select
                        disabled={!output}
                        {...form.register('outputUnitCode')}
                        {...accessibility(`${id}-unit`, errors.outputUnitCode?.message)}
                      >
                        <option value="">Pilih satuan hasil</option>
                        {compatibleUnits(units.data ?? [], output?.baseUnit.dimension).map(
                          (unit) => (
                            <option key={unit.id} value={unit.code}>
                              {unitLabel(unit.code)}
                            </option>
                          ),
                        )}
                      </Select>
                    </FormField>
                  </div>
                </>
              ) : (
                <>
                  <FormField
                    id={`${id}-menu`}
                    label="Menu / rasa minuman"
                    error={errors.menuVariantId?.message}
                  >
                    <Controller
                      control={form.control}
                      name="menuVariantId"
                      render={({ field }) => (
                        <PagedPicker<Variant>
                          endpoint="catalog/variants/page"
                          value={menu}
                          placeholder="Pilih menu minuman"
                          disabled={busy}
                          {...accessibility(`${id}-menu`, errors.menuVariantId?.message)}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onSelect={(selected) => {
                            setMenu(selected);
                            field.onChange(selected.id);
                          }}
                        />
                      )}
                    />
                  </FormField>
                  <p className="rounded-xl bg-emerald-50 p-3 text-sm text-primary">
                    Basis takaran: <strong>1 cup</strong>. Susun resep terpisah untuk setiap rasa
                    yang komposisinya berbeda.
                  </p>
                </>
              )}
            </Card>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">3. Bahan dan takaran</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {kind === 'PRODUCTION'
                      ? 'Takaran bahan untuk menghasilkan satu batch standar.'
                      : 'Takaran bahan yang dipakai untuk satu cup.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={fields.length >= 50}
                  onClick={() => append({ stockItemId: '', quantity: '', unitCode: '' })}
                >
                  <Plus size={17} />
                  Tambah bahan
                </Button>
              </div>
              {!fields.length && (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Takaran belum diketahui? Draft boleh disimpan tanpa bahan, tetapi belum bisa
                  disimulasikan atau dipakai operasional.
                </p>
              )}
              {fields.map((field, index) => {
                const item = selectedItems[field.id];
                const lineError = errors.components?.[index];
                return (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-xl border border-border bg-muted/50 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">Bahan {index + 1}</h4>
                      <Button
                        variant="ghost"
                        aria-label={`Hapus baris bahan ${index + 1}`}
                        className="px-2 text-red-700"
                        onClick={() => remove(index)}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                    <FormField
                      id={`${id}-${field.id}-item`}
                      label={`Nama bahan ${index + 1}`}
                      error={lineError?.stockItemId?.message}
                    >
                      <Controller
                        name={`components.${index}.stockItemId`}
                        control={form.control}
                        render={({ field: controller }) => (
                          <PagedPicker<Item>
                            endpoint="catalog/items/page"
                            value={item ?? null}
                            placeholder="Pilih bahan"
                            disabled={busy}
                            {...accessibility(
                              `${id}-${field.id}-item`,
                              lineError?.stockItemId?.message,
                            )}
                            ref={controller.ref}
                            onBlur={controller.onBlur}
                            onSelect={(selected) => {
                              setSelectedItems((current) => ({ ...current, [field.id]: selected }));
                              controller.onChange(selected.id);
                              form.setValue(
                                `components.${index}.unitCode`,
                                selected.baseUnit.code,
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }}
                          />
                        )}
                      />
                    </FormField>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        id={`${id}-${field.id}-qty`}
                        label={`Takaran bahan ${index + 1}`}
                        error={lineError?.quantity?.message}
                      >
                        <Input
                          inputMode="decimal"
                          {...form.register(`components.${index}.quantity`)}
                          {...accessibility(`${id}-${field.id}-qty`, lineError?.quantity?.message)}
                        />
                      </FormField>
                      <FormField
                        id={`${id}-${field.id}-unit`}
                        label={`Satuan bahan ${index + 1}`}
                        error={lineError?.unitCode?.message}
                      >
                        <Select
                          disabled={!item}
                          {...form.register(`components.${index}.unitCode`)}
                          {...accessibility(`${id}-${field.id}-unit`, lineError?.unitCode?.message)}
                        >
                          <option value="">Pilih satuan</option>
                          {compatibleUnits(units.data ?? [], item?.baseUnit.dimension).map(
                            (unit) => (
                              <option key={unit.id} value={unit.code}>
                                {unitLabel(unit.code)}
                              </option>
                            ),
                          )}
                        </Select>
                      </FormField>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Takaran harus positif. Bahan yang sama cukup satu baris. Gram tidak bisa dikonversi
                langsung menjadi mililiter.
              </p>
            </Card>
          </div>
          <Card className="space-y-3 xl:sticky xl:top-5">
            <h3 className="font-bold">Ringkasan draft</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Jenis</dt>
                <dd>{kind === 'PRODUCTION' ? 'Produksi DC' : 'Takaran per cup'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {kind === 'PRODUCTION' ? 'Hasil standar' : 'Menu'}
                </dt>
                <dd className="break-words">
                  {kind === 'PRODUCTION'
                    ? `${output?.name ?? 'Belum dipilih'} · ${values.outputQuantity || '—'} ${values.outputUnitCode}`
                    : `${menu?.name ?? 'Belum dipilih'} · 1 cup`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Komponen</dt>
                <dd>{fields.length} baris bahan</dd>
              </div>
            </dl>
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Simpan sebagai draft baru. Belum aktif dan tidak menambah atau mengurangi stok.
            </p>
          </Card>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-white p-3 shadow-sm">
          <Button variant="outline" disabled={busy} onClick={() => leave.requestLeave(onBack)}>
            Batal
          </Button>
          <Button type="submit" disabled={busy || !units.data}>
            <Save size={17} />
            {busy ? 'Menyimpan…' : 'Simpan draft'}
          </Button>
        </div>
      </form>
      {leave.confirmation}
    </div>
  );
}
