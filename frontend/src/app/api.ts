import axios from 'axios';
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
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const csrfClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
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

apiClient.interceptors.response.use(
  (response) => {
    releaseCsrfRequest(response.config);
    return response;
  },
  (error) => {
    releaseCsrfRequest(error.config);
    if (error.response?.status === 401) {
      authStore.clearSession();
    }
    return Promise.reject(error);
  },
);