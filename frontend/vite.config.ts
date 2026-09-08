import path from "path"
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendEnv = loadEnv('development', path.resolve(__dirname, '../backend'), '');
  const backendProxyUrl = env.BACKEND_PROXY_URL || 'http://127.0.0.1:4000';
  const publicSupabaseUrl = env.VITE_SUPABASE_URL || backendEnv.SUPABASE_URL;

  return {
    plugins: [tailwindcss(), react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
      allowedHosts: ['localhost', '127.0.0.1'],
      proxy: {
        '/api': {
          target: backendProxyUrl,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicSupabaseUrl || ''),
    },
  };
});

