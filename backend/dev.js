#!/usr/bin/env node
import spawn from 'cross-spawn';
import killPort from 'kill-port';

async function startDev() {
  try {
    // Intenta cerrar el puerto 4000
    console.log('Verificando puerto 4000...');
    await killPort(4000);
    console.log('Puerto 4000 cerrado ✓');
  } catch (error) {
    // Si no hay proceso en el puerto, continúa
    console.log('Puerto 4000 está disponible ✓');
  }

  // Inicia el servidor
  console.log('Iniciando servidor...\n');
  const tsx = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    stdio: 'inherit',
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => tsx.kill(signal));
  }

  await new Promise((resolve) => {
    tsx.on('error', (error) => {
      console.error('Error al iniciar servidor:', error);
      process.exitCode = 1;
      resolve();
    });

    tsx.on('exit', (code, signal) => {
      process.exitCode = signal ? 1 : code ?? 1;
      resolve();
    });
  });
}

startDev();
