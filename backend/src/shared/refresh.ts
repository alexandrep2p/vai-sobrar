import { tenantContext, type AppContext, type BaseContext } from './context.js';
import { syncInvoiceStatuses } from '../modules/invoices/invoice-store.js';
import { generateDueOccurrences } from '../modules/recurrences/occurrences.js';
import { syncRecurrencePauses } from '../modules/recurrences/recurrences.service.js';

/**
 * Mecanismo de transição por tempo e de geração na data (architecture §11.2/§12/§26; T-23, T-30):
 * avaliação a cada acesso à API somada a uma rotina periódica no servidor (startBackgroundJobs).
 * Determinístico e idempotente: o resultado depende só do relógio e do estado persistido.
 * Atua somente sobre os dados do usuário do contexto (PD-40).
 */
export const refreshState = async (ctx: AppContext): Promise<void> => {
  const today = ctx.clock.today();
  await syncInvoiceStatuses(ctx.prisma, today);
  await syncRecurrencePauses(ctx.prisma, today);
  await generateDueOccurrences(ctx);
};

/** Executa `refreshState` para cada usuário; a falha de um não interrompe os demais. */
export const refreshAllUsers = async (base: BaseContext): Promise<void> => {
  const users = await base.prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  for (const { id } of users) {
    try {
      await refreshState(tenantContext(base, id));
    } catch (error) {
      console.error(`Falha na rotina periódica do usuário ${id}:`, error);
    }
  }
};

/** Rotina periódica: garante a geração de ocorrências independentemente de acesso do usuário. */
export const startBackgroundJobs = (
  base: BaseContext,
  everyMs = 15 * 60 * 1000,
): NodeJS.Timeout => {
  const run = (): void => {
    refreshAllUsers(base).catch((error) => console.error('Falha na rotina periódica:', error));
  };
  run();
  const timer = setInterval(run, everyMs);
  timer.unref();
  return timer;
};
