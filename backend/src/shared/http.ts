import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { isLocalDate, isYearMonth, type LocalDate, type YearMonth } from './dates.js';

/** Encaminha rejeições de handlers assíncronos para o middleware de erro (Express 4). */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ---- Schemas Zod reutilizáveis: formato, tipos e limites estruturais (architecture §6.1) ----

export const uuidSchema = z.string().uuid();

export const localDateSchema = z
  .string()
  .refine((v): v is LocalDate => isLocalDate(v), { message: 'Data inválida (YYYY-MM-DD).' })
  .transform((v) => v as LocalDate);

export const yearMonthSchema = z
  .string()
  .refine((v): v is YearMonth => isYearMonth(v), { message: 'Mês inválido (YYYY-MM).' })
  .transform((v) => v as YearMonth);

/** Valor monetário em centavos: inteiro positivo. */
export const positiveCentsSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Nome após trim, 1 a 100 caracteres. */
export const nameSchema = z.string().trim().min(1).max(100);

export const descriptionSchema = z.string().trim().min(1).max(200);

export const dayOfMonthSchema = z.number().int().min(1).max(31);

export const idParams = z.object({ id: uuidSchema });
