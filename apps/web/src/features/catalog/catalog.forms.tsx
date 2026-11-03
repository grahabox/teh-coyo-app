import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Catalog, Item, Menu, Variant } from '../../lib/types';
import { FormDialog } from '../../components/ui/form-dialog';
import { Input } from '../../components/ui/input';
import {
  Footer,
  FormError,
  FormField,
  accessibility,
  useSave,
} from '../../components/form-helpers';
import { Select } from '../../components/forms';
import {
  itemFormSchema,
  menuGroupFormSchema,
  variantFormSchema,
  unitLabel,
  type ItemFormValues,
  type GroupFormValues,
  type VariantFormValues,
} from './catalog.schemas';

export type SavedCatalogRecord =
  | { kind: 'item'; record: Item }
  | { kind: 'group'; record: Menu }
  | { kind: 'variant'; record: Variant };
interface DialogActions {
  onClose: () => void;
  onSaved: (saved: SavedCatalogRecord) => void;
}

export function ItemDialog({ catalog, onClose, onSaved }: DialogActions & { catalog: Catalog }) {
  const formId = useId();
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { name: '', code: '', baseUnitId: '' },
  });
  const { errors } = form.formState;
  const save = useSave<ItemFormValues, Omit<Item, 'baseUnit'>>(
    'catalog/items',
    form,
    ['name', 'code', 'baseUnitId'],
    (record) => {
      onSaved({
        kind: 'item',
        record: {
          ...record,
          baseUnit: catalog.units.find((unit) => unit.id === record.baseUnitId)!,
        },
      });
    },
  );
  const code = form.register('code');
  return (
    <FormDialog
      title="Tambah barang"
      description="Daftarkan bahan atau kemasan yang digunakan. Jumlah stok belum diisi di sini."
      dirty={form.formState.isDirty}
      busy={save.busy}
      onClose={onClose}
      footer={(cancel) => (
        <Footer formId={formId} busy={save.busy} onCancel={cancel} label="Simpan barang" />
      )}
    >
      <form id={formId} noValidate onSubmit={save.submit} className="space-y-5">
        <fieldset disabled={save.busy} className="space-y-5">
          <FormField id={`${formId}-name`} label="Nama barang" error={errors.name?.message}>
            <Input
              data-dialog-focus
              placeholder="Contoh: Powder Coklat"
              maxLength={120}
              {...form.register('name')}
              {...accessibility(`${formId}-name`, errors.name?.message)}
            />
          </FormField>
          <FormField
            id={`${formId}-code`}
            label="Kode barang"
            hint="Kode unik untuk membedakan barang. Contoh: POWDER-COKLAT."
            error={errors.code?.message}
          >
            <Input
              placeholder="POWDER-COKLAT"
              maxLength={40}
              autoCapitalize="characters"
              spellCheck={false}
              {...code}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void code.onChange(event);
              }}
              {...accessibility(`${formId}-code`, errors.code?.message, true)}
            />
          </FormField>
          <FormField
            id={`${formId}-unit`}
            label="Stok dihitung dalam"
            hint="Bahan cair: mililiter. Bubuk: gram. Kemasan: buah. Liter dan kilogram tetap bisa dipakai saat menyusun resep."
            error={errors.baseUnitId?.message}
          >
            <Select
              {...form.register('baseUnitId')}
              {...accessibility(`${formId}-unit`, errors.baseUnitId?.message, true)}
            >
              <option value="">Pilih satuan pencatatan</option>
              {catalog.units
                .filter((unit) => unit.factor === '1')
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit.code)}
                  </option>
                ))}
            </Select>
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}

export function GroupDialog({ onClose, onSaved }: DialogActions) {
  const formId = useId();
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(menuGroupFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { name: '' },
  });
  const { errors } = form.formState;
  const save = useSave<GroupFormValues, Menu>('catalog/menus', form, ['name'], (record) =>
    onSaved({ kind: 'group', record }),
  );
  return (
    <FormDialog
      title="Buat kelompok minuman"
      description="Kelompok membantu merapikan menu. Contoh: Es Teh, dengan rasa Original, Coklat, atau Melon."
      dirty={form.formState.isDirty}
      busy={save.busy}
      onClose={onClose}
      footer={(cancel) => (
        <Footer formId={formId} busy={save.busy} onCancel={cancel} label="Simpan kelompok" />
      )}
    >
      <form id={formId} noValidate onSubmit={save.submit} className="space-y-5">
        <fieldset disabled={save.busy}>
          <FormField
            id={`${formId}-name`}
            label="Nama kelompok minuman"
            error={errors.name?.message}
          >
            <Input
              data-dialog-focus
              placeholder="Contoh: Es Teh"
              maxLength={120}
              {...form.register('name')}
              {...accessibility(`${formId}-name`, errors.name?.message)}
            />
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}

export function VariantDialog({
  catalog,
  menuId,
  onClose,
  onSaved,
}: DialogActions & { catalog: Catalog; menuId?: string }) {
  const formId = useId();
  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      code: '',
      menuId: menuId ?? (catalog.menus.length === 1 ? catalog.menus[0].id : ''),
    },
  });
  const { errors } = form.formState;
  const save = useSave<VariantFormValues, Omit<Variant, 'menu'>>(
    'catalog/variants',
    form,
    ['name', 'code', 'menuId'],
    (record) =>
      onSaved({
        kind: 'variant',
        record: { ...record, menu: catalog.menus.find((menu) => menu.id === record.menuId)! },
      }),
  );
  const code = form.register('code');
  return (
    <FormDialog
      title="Tambah menu minuman"
      description="Tambahkan rasa yang dijual per cup. Takaran bahan diatur terpisah di halaman Resep."
      dirty={form.formState.isDirty}
      busy={save.busy}
      onClose={onClose}
      footer={(cancel) => (
        <Footer formId={formId} busy={save.busy} onCancel={cancel} label="Simpan menu" />
      )}
    >
      <form id={formId} noValidate onSubmit={save.submit} className="space-y-5">
        <fieldset disabled={save.busy} className="space-y-5">
          <FormField id={`${formId}-name`} label="Nama rasa / menu" error={errors.name?.message}>
            <Input
              data-dialog-focus
              placeholder="Contoh: Original"
              maxLength={120}
              {...form.register('name')}
              {...accessibility(`${formId}-name`, errors.name?.message)}
            />
          </FormField>
          <FormField
            id={`${formId}-group`}
            label="Kelompok minuman"
            hint="Pilih kelompok tempat menu ini ditampilkan. Jika belum ada, buat kelompok dari daftar Menu Minuman terlebih dahulu."
            error={errors.menuId?.message}
          >
            <Select
              {...form.register('menuId')}
              {...accessibility(`${formId}-group`, errors.menuId?.message, true)}
            >
              <option value="">Pilih kelompok minuman</option>
              {catalog.menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id={`${formId}-code`}
            label="Kode menu"
            hint="Kode harus berbeda untuk setiap rasa / menu. Contoh: TEH-ORIGINAL."
            error={errors.code?.message}
          >
            <Input
              placeholder="TEH-ORIGINAL"
              maxLength={40}
              autoCapitalize="characters"
              spellCheck={false}
              {...code}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void code.onChange(event);
              }}
              {...accessibility(`${formId}-code`, errors.code?.message, true)}
            />
          </FormField>
        </fieldset>
        <FormError message={errors.root?.server?.message} />
      </form>
    </FormDialog>
  );
}
