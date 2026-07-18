import { buildApp } from './app';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    app.log.info(`Server listening on http://0.0.0.0:3000`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }
}

start();