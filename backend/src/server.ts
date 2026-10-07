import 'dotenv/config';
import { createApp, defaultContext } from './app.js';
import { startBackgroundJobs } from './shared/refresh.js';

const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 3000;

const base = defaultContext();
const app = createApp(base);

startBackgroundJobs(base);
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
