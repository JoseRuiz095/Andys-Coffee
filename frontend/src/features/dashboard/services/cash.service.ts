import { apiClient } from '../../../app/api'

export interface CashSession {
  id: string
  openingAmount: string | number
  expectedAmount: string | number
  status: string
  openedAt: string
  cashRegister: {
    id: string
    name: string
  }
  openedBy: {
    id: string
    name: string
  }
}

export async function getActiveCashSession(): Promise<CashSession | null> {
  const { data } = await apiClient.get<{ session: CashSession | null }>(
    '/cash-register/sessions/active',
  )
  return data.session
}

export async function openCashSession(openingAmount: number): Promise<CashSession> {
  const { data } = await apiClient.post<{ session: CashSession }>(
    '/cash-register/sessions',
    { openingAmount },
  )
  return data.session
}

export async function closeCashSession(): Promise<CashSession | null> {
  const { data } = await apiClient.post<{ session: CashSession | null }>(
    '/cash-register/sessions/close',
  )
  return data.session
}
