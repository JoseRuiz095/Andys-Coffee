import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppRouter } from './app/router';
import { Providers } from './app/providers';
import './index.css';

// 1. Crea una instancia del cliente
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. Envuelve tu aplicación con el provider */}
    <QueryClientProvider client={queryClient}>
      <Providers>
        <AppRouter />
      </Providers>
    </QueryClientProvider>
    {/* Vercel Analytics y Speed Insights: solo envían datos en el despliegue de Vercel */}
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>
);
