import axios from 'axios';
import { sileo } from 'sileo';
import { authStore } from '../features/auth/store/auth.store';

/**
 * Cliente de Axios para comunicarse con la API del backend.
 *
 * La 'baseURL' está configurada como '/api'. Esto le dice a Axios que
 * anteponga '/api' a todas las rutas de las peticiones (ej. '/auth/login' se convierte en '/api/auth/login').
 *
 * En desarrollo, el servidor de Vite interceptará estas peticiones gracias a la
 * configuración de 'proxy' en `vite.config.ts` y las redirigirá a tu backend
 * en 'http://localhost:4000', evitando problemas de CORS.
 *
 * En producción, tu servidor (como Nginx o Vercel) deberá estar configurado
 * para redirigir las peticiones de '/api' al servidor del backend.
 */

/**
 * A request that hangs would keep its button on "Procesando..." forever and, being mutations
 * serialized below, block every later one. Retrying a timed-out sale is safe: it reuses its
 * idempotency key until the server confirms it.
 */
export const REQUEST_TIMEOUT_MS = 20_000;
/** Photo uploads on a slow connection need longer. */
export const UPLOAD_TIMEOUT_MS = 120_000;

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

const csrfClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

let csrfQueue = Promise.resolve();
const releaseByConfig = new WeakMap<object, () => void>();

apiClient.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let release!: () => void;
    const previousRequest = csrfQueue;
    csrfQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousRequest;
    releaseByConfig.set(config, release);

    try {
      const { data } = await csrfClient.get<{ token: string }>('/auth/csrf');
      config.headers.set('X-CSRF-TOKEN', data.token);
    } catch (error) {
      release();
      releaseByConfig.delete(config);
      throw error;
    }
  }
  return config;
});

function releaseCsrfRequest(config?: object) {
  if (!config) return;
  const release = releaseByConfig.get(config);
  if (release) {
    release();
    releaseByConfig.delete(config);
  }
}

/**
 * A 401 means the session expired only when there was one and the request wasn't the login
 * itself (wrong credentials also answer 401, shown inline by the form). After the first one the
 * session is gone, so the polling queries failing at the same time don't repeat the notice.
 */
/** Fired on a 403 while logged in (see useSessionValidator). */
export const PERMISSIONS_STALE_EVENT = 'auth:permissions-stale';

export function isSessionExpiry(status: number | undefined, url: string | undefined, hadSession: boolean) {
  return status === 401 && hadSession && !url?.includes('/auth/login');
}

apiClient.interceptors.response.use(
  (response) => {
    releaseCsrfRequest(response.config);
    return response;
  },
  (error) => {
    releaseCsrfRequest(error.config);
    const hadSession = authStore.getState().user !== null;
    // A 403 on a live session usually means the role or its permissions changed since the user
    // was loaded: the session validator re-reads them so the UI stops offering that action.
    if (error.response?.status === 403 && hadSession) {
      window.dispatchEvent(new Event(PERMISSIONS_STALE_EVENT));
    }
    if (isSessionExpiry(error.response?.status, error.config?.url, hadSession)) {
      authStore.clearSession();
      sileo.error({
        title: 'Sesión expirada',
        description: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
      });
    }
    return Promise.reject(error);
  },
);
