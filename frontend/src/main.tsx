import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './app/queryClient';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppRouter } from './app/router';
import { Providers } from './app/providers';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
