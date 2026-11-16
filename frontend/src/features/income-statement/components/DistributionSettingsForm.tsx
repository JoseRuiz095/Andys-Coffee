import React from 'react';
import { sileo } from 'sileo';
import { useDistributionSettings, useUpdateDistributionSettings } from '../hooks/useIncomeStatement';
import { getErrorMessage } from '../../../shared/utils/errors';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { Skeleton } from '../../../shared/components/Skeleton';
import type { DistributionSettings } from '../api/income-statement.api';
import { parsePercent } from '../utils/distribution';

const FIELDS = [
  { key: 'savingsPercent', id: 'distribution-savings', label: 'Ahorro' },
  { key: 'businessFundPercent', id: 'distribution-business', label: 'Fondo del negocio' },
  { key: 'suppliesPercent', id: 'distribution-supplies', label: 'Surtido' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

/**
 * Split of the daily net profit. Never shows (nor saves) default values: while the saved split
 * is loading or failed to load there is nothing to edit, so a failed GET can't overwrite it.
 */
export function DistributionSettingsForm({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useDistributionSettings();

  return (
    <section aria-labelledby="distribution-title">
      <h2 id="distribution-title" className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Distribución de la ganancia
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Porcentaje de la ganancia neta diaria que va a cada destino en el Estado de Resultados. Deben sumar 100%.
      </p>
      {isError ? (
        <QueryErrorState error={error} subject="la distribución" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : isLoading || !data ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <DistributionEditor key={JSON.stringify(data)} saved={data} canEdit={canEdit} />
      )}
    </section>
  );
}

function DistributionEditor({ saved, canEdit }: { saved: DistributionSettings; canEdit: boolean }) {
  const { mutate: updateSettings, isPending } = useUpdateDistributionSettings();
  const [values, setValues] = React.useState<Record<FieldKey, string>>({
    savingsPercent: String(saved.savingsPercent),
    businessFundPercent: String(saved.businessFundPercent),
    suppliesPercent: String(saved.suppliesPercent),
  });

  const parsed = {
    savingsPercent: parsePercent(values.savingsPercent),
    businessFundPercent: parsePercent(values.businessFundPercent),
    suppliesPercent: parsePercent(values.suppliesPercent),
  };
  const allValid = FIELDS.every((field) => parsed[field.key] !== null);
  const sum = FIELDS.reduce((total, field) => total + (parsed[field.key] ?? 0), 0);
  const sumIsValid = Math.abs(sum - 100) < 0.01;
  const isDirty = FIELDS.some((field) => values[field.key] !== String(saved[field.key]));
  const canSave = canEdit && allValid && sumIsValid && isDirty && !isPending;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateSettings(
      {
        savingsPercent: parsed.savingsPercent!,
        businessFundPercent: parsed.businessFundPercent!,
        suppliesPercent: parsed.suppliesPercent!,
      },
      {
        onSuccess: () => sileo.success({ title: 'Distribución guardada' }),
        onError: (err: unknown) =>
          sileo.error({ title: 'No se pudo guardar la distribución', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      },
    );
  };

  const remaining = 100 - sum;

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => {
          const invalid = parsed[field.key] === null;
          return (
            <FormField
              key={field.key}
              htmlFor={field.id}
              label={`${field.label} (%)`}
              required
              error={invalid ? 'Ingresa un valor entre 0 y 100.' : null}
            >
              <Input
                id={field.id}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values[field.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                disabled={!canEdit || isPending}
                aria-invalid={invalid ? true : undefined}
                aria-describedby={fieldDescriptionId(field.id)}
              />
            </FormField>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" role="status" style={{ color: sumIsValid ? 'var(--color-success)' : 'var(--color-danger)' }}>
          Suma: {sum.toFixed(2)}%
          {allValid && !sumIsValid && (
            <span className="ml-2 font-normal">
              {remaining > 0 ? `Faltan ${remaining.toFixed(2)}%` : `Sobran ${Math.abs(remaining).toFixed(2)}%`}
            </span>
          )}
        </p>
        {canEdit && (
          <div className="flex gap-3">
            {isDirty && (
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  setValues({
                    savingsPercent: String(saved.savingsPercent),
                    businessFundPercent: String(saved.businessFundPercent),
                    suppliesPercent: String(saved.suppliesPercent),
                  })
                }
              >
                Descartar
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!canSave}>
              {isPending ? 'Guardando...' : 'Guardar distribución'}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
