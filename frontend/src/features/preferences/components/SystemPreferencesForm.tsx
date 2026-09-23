import { useState } from 'react'
import { useGeneralPreferences, useUpdateGeneralPreferences } from '../hooks/useGeneralPreferences'
import { sileo } from 'sileo'
import type { GeneralPreferences } from '../api/preferences.api'
import { getErrorMessage } from '../../../shared/utils/errors'

export function SystemPreferencesForm() {
  const { data: preferences, isLoading } = useGeneralPreferences()
  const { mutate: updatePreferences, isPending } = useUpdateGeneralPreferences()
  const [formData, setFormData] = useState<GeneralPreferences | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load the saved preferences whenever fresh data arrives (adjusting state during render).
  const [loadedPreferences, setLoadedPreferences] = useState<GeneralPreferences | undefined>(undefined)
  if (preferences && preferences !== loadedPreferences) {
    setLoadedPreferences(preferences)
    setFormData(preferences)
    setErrors({})
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData?.businessName?.trim()) {
      newErrors.businessName = 'El nombre del negocio es requerido'
    }

    const timeRegex = /^\d{2}:\d{2}$/
    if (!timeRegex.test(formData?.businessHoursOpen || '')) {
      newErrors.businessHoursOpen = 'Formato inválido (HH:MM)'
    }
    if (!timeRegex.test(formData?.businessHoursClose || '')) {
      newErrors.businessHoursClose = 'Formato inválido (HH:MM)'
    }

    if (
      timeRegex.test(formData?.businessHoursOpen || '') &&
      timeRegex.test(formData?.businessHoursClose || '')
    ) {
      const [openHour, openMin] = (formData?.businessHoursOpen || '').split(':').map(Number)
      const [closeHour, closeMin] = (formData?.businessHoursClose || '').split(':').map(Number)
      const openTime = openHour * 60 + openMin
      const closeTime = closeHour * 60 + closeMin
      if (closeTime <= openTime) {
        newErrors.businessHoursClose = 'La hora de cierre debe ser posterior a la hora de apertura'
      }
    }

    if (formData?.phone) {
      const phoneRegex = /^[\d\s\-()+]*$/
      if (formData.phone.length > 20) {
        newErrors.phone = 'El teléfono no puede exceder 20 caracteres'
      } else if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = 'Solo se permiten números, espacios, guiones, paréntesis y +'
      } else if (!/\d/.test(formData.phone)) {
        newErrors.phone = 'El teléfono debe contener al menos un dígito'
      }
    }

    if (formData?.address && formData.address.length > 250) {
      newErrors.address = 'La dirección no puede exceder 250 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm() || !formData) {
      if (Object.keys(errors).length > 0) {
        sileo.error({ title: 'Error', description: 'Corrige los errores antes de guardar' })
      }
      return
    }

    // Only send non-empty optional fields
    const dataToSend = {
      businessName: formData.businessName,
      businessHoursOpen: formData.businessHoursOpen,
      businessHoursClose: formData.businessHoursClose,
      currency: formData.currency,
      currencySymbol: formData.currencySymbol,
      ...(formData.phone && { phone: formData.phone }),
      ...(formData.address && { address: formData.address }),
    }

    updatePreferences(dataToSend as GeneralPreferences, {
      onSuccess: () => {
        sileo.success({ title: 'Guardado', description: 'Preferencias actualizadas correctamente' })
      },
      onError: (error: unknown) => {
        const message = getErrorMessage(error, 'No se pudieron guardar las preferencias')
        sileo.error({ title: 'Error', description: message })
      },
    })
  }

  if (isLoading || !formData) {
    return <div className="text-center py-8">Cargando preferencias...</div>
  }

  const currencyOptions = ['MXN', 'USD', 'CAD']
  const symbolOptions: Record<string, string[]> = {
    MXN: ['$', 'Mex$', 'MXN'],
    USD: ['$', 'US$', 'USD'],
    CAD: ['$', 'C$', 'CAD'],
  }
  const defaultSymbols: Record<string, string> = {
    MXN: '$',
    USD: '$',
    CAD: '$',
  }

  const handleCurrencyChange = (newCurrency: string) => {
    setFormData({
      ...formData,
      currency: newCurrency,
      currencySymbol: defaultSymbols[newCurrency] || formData.currencySymbol,
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Preferencias Generales
      </h2>

      <div
        className="rounded-2xl border p-5 shadow-sm space-y-4"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {/* Nombre del negocio */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Nombre del negocio
          </label>
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            style={{
              borderColor: errors.businessName ? 'var(--color-danger)' : 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-input-text)',
            }}
          />
          {errors.businessName && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.businessName}
            </p>
          )}
        </div>

        {/* Horario */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Hora de apertura
            </label>
            <input
              type="time"
              value={formData.businessHoursOpen}
              onChange={(e) => setFormData({ ...formData, businessHoursOpen: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: errors.businessHoursOpen ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-input-text)',
              }}
            />
            {errors.businessHoursOpen && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {errors.businessHoursOpen}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Hora de cierre
            </label>
            <input
              type="time"
              value={formData.businessHoursClose}
              onChange={(e) => setFormData({ ...formData, businessHoursClose: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: errors.businessHoursClose ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-input-text)',
              }}
            />
            {errors.businessHoursClose && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {errors.businessHoursClose}
              </p>
            )}
          </div>
        </div>

        {/* Moneda y Símbolo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Moneda
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-input-text)',
              }}
            >
              {currencyOptions.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Símbolo
            </label>
            <select
              value={formData.currencySymbol}
              onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-input-text)',
              }}
            >
              {(symbolOptions[formData.currency] || symbolOptions['MXN']).map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Teléfono (opcional)
          </label>
          <input
            type="tel"
            inputMode="tel"
            maxLength={20}
            value={formData.phone || ''}
            onChange={(e) => {
              // Only allow digits, spaces, hyphens, parentheses and +
              const filtered = e.target.value.replace(/[^\d\s\-()+]/g, '')
              setFormData({ ...formData, phone: filtered })
            }}
            placeholder="Ej: (55) 1234-5678"
            className="w-full px-3 py-2 border rounded-lg"
            style={{
              borderColor: errors.phone ? 'var(--color-danger)' : 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-input-text)',
            }}
          />
          {errors.phone && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.phone}
            </p>
          )}
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Dirección (opcional)
          </label>
          <textarea
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg"
            style={{
              borderColor: errors.address ? 'var(--color-danger)' : 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-input-text)',
            }}
          />
          {errors.address && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.address}
            </p>
          )}
        </div>

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full mt-6 px-4 py-2 rounded-lg text-white font-semibold transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {isPending ? 'Guardando...' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  )
}
