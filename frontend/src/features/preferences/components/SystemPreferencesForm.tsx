import { useState } from 'react'
import { sileo } from 'sileo'
import { useGeneralPreferences, useUpdateGeneralPreferences } from '../hooks/useGeneralPreferences'
import type { GeneralPreferences } from '../api/preferences.api'
import { getErrorMessage } from '../../../shared/utils/errors'
import { Button } from '../../../shared/components/Button'
import { Input } from '../../../shared/components/Input'
import { Select } from '../../../shared/components/Select'
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { Skeleton } from '../../../shared/components/Skeleton'
import { CURRENCY_OPTIONS, SYMBOL_OPTIONS, validateGeneralPreferences, type GeneralPreferencesErrors } from '../utils/generalPreferences'

const sectionClass = 'rounded-2xl border p-5'
const sectionStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }

/** "Datos del negocio": identity, operating hours (they drive the cash auto-close) and currency. */
export function SystemPreferencesForm({ canEdit }: { canEdit: boolean }) {
  const { data: preferences, isLoading, isError, error, refetch, isFetching } = useGeneralPreferences()

  if (isError) {
    return <QueryErrorState error={error} subject="los datos del negocio" onRetry={() => void refetch()} isRetrying={isFetching} />
  }
  if (isLoading || !preferences) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    )
  }
  // Keyed by the saved data: after saving (or a refetch) the form starts from what is stored.
  return <GeneralPreferencesEditor key={JSON.stringify(preferences)} saved={preferences} canEdit={canEdit} />
}

function GeneralPreferencesEditor({ saved, canEdit }: { saved: GeneralPreferences; canEdit: boolean }) {
  const { mutate: updatePreferences, isPending } = useUpdateGeneralPreferences()
  const [formData, setFormData] = useState<GeneralPreferences>(saved)
  const [errors, setErrors] = useState<GeneralPreferencesErrors>({})
  const [showCurrency, setShowCurrency] = useState(false)

  const isDirty = JSON.stringify(formData) !== JSON.stringify(saved)
  const set = <K extends keyof GeneralPreferences>(key: K, value: GeneralPreferences[K]) => setFormData((prev) => ({ ...prev, [key]: value }))

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || isPending) return
    const nextErrors = validateGeneralPreferences(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      sileo.error({ title: 'Revisa los campos marcados', description: 'Corrige los errores antes de guardar.' })
      return
    }

    // Same payload as before: optional fields go only when they have a value.
    const dataToSend: GeneralPreferences = {
      businessName: formData.businessName,
      businessHoursOpen: formData.businessHoursOpen,
      businessHoursClose: formData.businessHoursClose,
      currency: formData.currency,
      currencySymbol: formData.currencySymbol,
      ...(formData.phone && { phone: formData.phone }),
      ...(formData.address && { address: formData.address }),
    }

    updatePreferences(dataToSend, {
      onSuccess: () => sileo.success({ title: 'Datos del negocio guardados' }),
      onError: (err: unknown) =>
        sileo.error({ title: 'No se pudieron guardar los datos', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
    })
  }

  const fieldProps = (key: keyof GeneralPreferences, id: string) => ({
    id,
    disabled: !canEdit || isPending,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': fieldDescriptionId(id),
  })

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4">
      {!canEdit && <PermissionNotice action="cambiar los datos del negocio" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={sectionClass} style={sectionStyle} aria-labelledby="business-identity-title">
          <h2 id="business-identity-title" className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Identidad
          </h2>
          <div className="space-y-4">
            <FormField htmlFor="business-name" label="Nombre del negocio" required error={errors.businessName} hint="Se muestra en la pantalla de inicio de sesión.">
              <Input {...fieldProps('businessName', 'business-name')} type="text" value={formData.businessName} onChange={(e) => set('businessName', e.target.value)} />
            </FormField>
            <FormField
              htmlFor="business-phone"
              label="Teléfono"
              error={errors.phone}
              hint="Una vez guardados, el teléfono y la dirección no se pueden dejar vacíos desde aquí."
            >
              <Input
                {...fieldProps('phone', 'business-phone')}
                type="tel"
                inputMode="tel"
                maxLength={20}
                value={formData.phone || ''}
                // Only digits, spaces, hyphens, parentheses and +.
                onChange={(e) => set('phone', e.target.value.replace(/[^\d\s\-()+]/g, ''))}
                placeholder="Ej. (55) 1234-5678"
              />
            </FormField>
            <FormField htmlFor="business-address" label="Dirección" error={errors.address}>
              <textarea
                {...fieldProps('address', 'business-address')}
                value={formData.address || ''}
                onChange={(e) => set('address', e.target.value)}
                rows={2}
                maxLength={250}
                className="w-full rounded-md border px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              />
            </FormField>
          </div>
        </section>

        <section className={sectionClass} style={sectionStyle} aria-labelledby="business-hours-title">
          <h2 id="business-hours-title" className="mb-1 text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Horario de operación
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            La hora de cierre define el cierre automático de caja y a qué día contable pertenecen las ventas y los gastos.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormField htmlFor="business-open" label="Apertura" required error={errors.businessHoursOpen}>
              <Input {...fieldProps('businessHoursOpen', 'business-open')} type="time" value={formData.businessHoursOpen} onChange={(e) => set('businessHoursOpen', e.target.value)} />
            </FormField>
            <FormField htmlFor="business-close" label="Cierre" required error={errors.businessHoursClose}>
              <Input {...fieldProps('businessHoursClose', 'business-close')} type="time" value={formData.businessHoursClose} onChange={(e) => set('businessHoursClose', e.target.value)} />
            </FormField>
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setShowCurrency((v) => !v)}
              aria-expanded={showCurrency}
              aria-controls="business-currency"
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {showCurrency ? '▾' : '▸'} Moneda (avanzado)
            </button>
            {showCurrency && (
              <div id="business-currency" className="mt-3 space-y-3">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Por ahora los montos del sistema siempre se muestran en pesos mexicanos; el símbolo se usa en los avisos de caja.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField htmlFor="business-currency-code" label="Moneda" required>
                    <Select
                      {...fieldProps('currency', 'business-currency-code')}
                      value={formData.currency}
                      onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value, currencySymbol: '$' }))}
                    >
                      {CURRENCY_OPTIONS.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField htmlFor="business-currency-symbol" label="Símbolo" required>
                    <Select {...fieldProps('currencySymbol', 'business-currency-symbol')} value={formData.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)}>
                      {(SYMBOL_OPTIONS[formData.currency] || SYMBOL_OPTIONS.MXN).map((symbol) => (
                        <option key={symbol} value={symbol}>
                          {symbol}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {canEdit && (
        <div className="flex justify-end gap-3">
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFormData(saved)
                setErrors({})
              }}
              disabled={isPending}
            >
              Descartar
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!isDirty || isPending}>
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </form>
  )
}
