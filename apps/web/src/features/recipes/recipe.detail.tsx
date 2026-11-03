import { useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calculator } from 'lucide-react';
import { api } from '../../lib/api';
import type { Preview, Recipe, Unit } from '../../lib/types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { ErrorNotice, Select } from '../../components/forms';
import { applyFormError, FormError, FormField, accessibility } from '../../components/form-helpers';
import { unitLabel } from '../catalog/catalog.schemas';
import { compatibleUnits, targetSchema } from './recipe.schemas';

export function RecipeDetail({ recipeId, onBack }: { recipeId: string; onBack: () => void }) {
  const recipe = useQuery({
    queryKey: ['recipe-detail', recipeId],
    queryFn: () => api<Recipe>(`recipes/${recipeId}/detail`),
  });
  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft size={18} />
        Kembali ke daftar
      </Button>
      {recipe.isPending && <p role="status">Memuat resep…</p>}
      <ErrorNotice error={recipe.error} />
      {recipe.error && (
        <Button variant="outline" onClick={() => void recipe.refetch()}>
          Coba lagi
        </Button>
      )}
      {recipe.data && <RecipeReadOnly key={recipe.data.id} recipe={recipe.data} />}
    </div>
  );
}

function RecipeReadOnly({ recipe }: { recipe: Recipe }) {
  const serving = recipe.kind === 'SERVING';
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="break-words text-xl font-bold">{recipe.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {serving ? 'Takaran per Cup' : 'Produksi DC'} ·{' '}
            {recipe.scopeLocation?.name ?? 'Semua DC (diatur pusat)'}
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Draft · belum aktif
        </span>
      </div>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Resep ini hanya dapat dilihat dan disimulasikan. Edit, publikasi, dan pemakaian stok belum
        tersedia.
      </p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <Card className="min-w-0 space-y-4">
          <h3 className="font-bold">
            {serving
              ? 'Takaran untuk 1 cup'
              : `Bahan untuk ${recipe.outputQuantity} ${recipe.outputUnitCode}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {serving
              ? `${recipe.menuVariant?.menu?.name ?? 'Menu'} · ${recipe.menuVariant?.name}`
              : `Barang hasil: ${recipe.outputItem?.name}`}
          </p>
          {!recipe.components.length ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Belum ada bahan. Draft ini belum bisa disimulasikan. Untuk melengkapi saat ini, buat
              draft baru; resep lama tidak ditimpa.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recipe.components.map((line) => (
                <li
                  key={line.stockItemId}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{line.stockItem.name}</p>
                    <small className="text-muted-foreground">{line.stockItem.code}</small>
                  </div>
                  <span className="shrink-0 font-semibold">
                    {line.quantity} {line.unitCode}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Komposisi standar, bukan bukti pemakaian atau hasil produksi aktual.
          </p>
        </Card>
        {recipe.components.length > 0 && <RecipeSimulation recipe={recipe} />}
      </div>
    </>
  );
}

function RecipeSimulation({ recipe }: { recipe: Recipe }) {
  const id = useId();
  const units = useQuery({
    queryKey: ['catalog-units'],
    queryFn: () => api<Unit[]>('catalog/units'),
  });
  const form = useForm<{ targetQuantity: string; targetUnitCode: string }>({
    resolver: zodResolver(targetSchema(recipe.kind)),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { targetQuantity: recipe.outputQuantity, targetUnitCode: recipe.outputUnitCode },
  });
  const [result, setResult] = useState<Preview | null>(null);
  const inFlight = useRef(false);
  const preview = useMutation({
    mutationFn: (input: { targetQuantity: string; targetUnitCode: string }) =>
      api<Preview>(`recipes/${recipe.id}/preview`, input),
  });
  const current = form.watch();
  const matching =
    result &&
    result.targetQuantity === current.targetQuantity.trim() &&
    result.targetUnitCode === current.targetUnitCode &&
    !preview.isPending;
  const errors = form.formState.errors;
  const serving = recipe.kind === 'SERVING';
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-bold">
          <Calculator size={19} />
          Hitung Kebutuhan Bahan
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {serving ? 'Berapa cup yang ingin dihitung?' : 'Berapa banyak yang ingin diproduksi?'}
        </p>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(async (input) => {
          if (inFlight.current) return;
          inFlight.current = true;
          form.clearErrors('root.server');
          setResult(null);
          try {
            setResult(await preview.mutateAsync(input));
          } catch (error) {
            applyFormError(error, form, ['targetQuantity', 'targetUnitCode']);
          } finally {
            inFlight.current = false;
          }
        })}
      >
        <fieldset disabled={preview.isPending} className="space-y-4">
          <FormField
            id={`${id}-target`}
            label={serving ? 'Jumlah cup' : 'Target produksi'}
            error={errors.targetQuantity?.message}
          >
            <Input
              inputMode={serving ? 'numeric' : 'decimal'}
              {...form.register('targetQuantity')}
              {...accessibility(`${id}-target`, errors.targetQuantity?.message)}
            />
          </FormField>
          {!serving && (
            <FormField
              id={`${id}-unit`}
              label="Satuan target"
              error={errors.targetUnitCode?.message}
            >
              <Select
                {...form.register('targetUnitCode')}
                {...accessibility(`${id}-unit`, errors.targetUnitCode?.message)}
              >
                {compatibleUnits(units.data ?? [], recipe.outputItem?.baseUnit.dimension).map(
                  (unit) => (
                    <option key={unit.id} value={unit.code}>
                      {unitLabel(unit.code)}
                    </option>
                  ),
                )}
              </Select>
            </FormField>
          )}
        </fieldset>
        <FormError message={errors.root?.server?.message} />
        <Button type="submit" disabled={preview.isPending || !units.data}>
          {preview.isPending ? 'Menghitung…' : 'Hitung kebutuhan'}
        </Button>
      </form>
      <ErrorNotice error={units.error} />
      {units.error && (
        <Button variant="outline" onClick={() => void units.refetch()}>
          Muat ulang satuan
        </Button>
      )}
      {result && !matching && !preview.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Target sudah berubah. Hitung kembali untuk memperbarui hasil.
        </p>
      )}
      {matching && (
        <div role="status" className="space-y-3 rounded-xl bg-emerald-50 p-4">
          <h4 className="text-sm font-bold">
            Kebutuhan untuk {result.targetQuantity} {serving ? 'cup' : result.targetUnitCode}
          </h4>
          {result.components.map((line) => (
            <p key={line.name} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">{line.name}</span>
              <strong className="shrink-0">
                {line.quantity} {line.unitCode}
                {line.rounded ? ' ≈' : ''}
              </strong>
            </p>
          ))}
          {result.components.some((line) => line.rounded) && (
            <p className="text-xs">≈ Dibulatkan hingga 6 desimal.</p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Simulasi ini tidak mengubah stok. Hasil produksi dan pemakaian aktual tetap harus dicatat
        terpisah.
      </p>
    </Card>
  );
}
