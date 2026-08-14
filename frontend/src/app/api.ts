import axios from 'axios';

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
});