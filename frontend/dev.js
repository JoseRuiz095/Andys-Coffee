#!/usr/bin/env node
import spawn from 'cross-spawn';
import killPort from 'kill-port';

async function startDev() {
  try {
    // Intenta cerrar el puerto 5173
    console.log('Verificando puerto 5173...');
    await killPort(5173);
    console.log('Puerto 5173 cerrado ✓');
  } catch (error) {
    // Si no hay proceso en el puerto, continúa
    console.log('Puerto 5173 está disponible ✓');
  }

  // Inicia Vite
  console.log('Iniciando Vite...\n');
  const vite = spawn('npx', ['vite'], {
    stdio: 'inherit',
  });

  vite.on('error', (error) => {
    console.error('Error al iniciar Vite:', error);
    process.exit(1);
  });
}

startDev();
