import type { AppContext } from './context.js';
import { syncInvoiceStatuses } from '../modules/invoices/invoice-store.js';
import { generateDueOccurrences } from '../modules/recurrences/occurrences.js';
import { syncRecurrencePauses } from '../modules/recurrences/recurrences.service.js';

/**
 * Mecanismo de transição por tempo e de geração na data (architecture §11.2/§12/§26; T-23, T-30):
 * avaliação a cada acesso à API somada a uma rotina periódica no servidor (startBackgroundJobs).
 * Determinístico e idempotente: o resultado depende só do relógio e do estado persistido.
 */
export const refreshState = async (ctx: AppContext): Promise<void> => {
  const today = ctx.clock.today();
  await syncInvoiceStatuses(ctx.prisma, today);
  await syncRecurrencePauses(ctx.prisma, today);
  await generateDueOccurrences(ctx);
};

/** Rotina periódica: garante a geração de ocorrências independentemente de acesso do usuário. */
export const startBackgroundJobs = (ctx: AppContext, everyMs = 15 * 60 * 1000): NodeJS.Timeout => {
  const run = (): void => {
    refreshState(ctx).catch((error) => console.error('Falha na rotina periódica:', error));
  };
  run();
  const timer = setInterval(run, everyMs);
  timer.unref();
  return timer;
};
