import 'dotenv/config';
import { createApp, defaultContext } from './app.js';
import { startBackgroundJobs } from './shared/refresh.js';
import { seedSystemMethods } from './shared/seed.js';

const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 3000;

const ctx = defaultContext();
const app = createApp(ctx);

seedSystemMethods(ctx.prisma)
  .then(() => {
    startBackgroundJobs(ctx);
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao iniciar o servidor:', error);
    process.exit(1);
  });
