import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { BusinessError, type ErrorBody } from './errors.js';

const body = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof BusinessError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    res.status(400).json(body('VALIDATION_ERROR', 'Dados de entrada inválidos.', details));
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(body('INVALID_JSON', 'Corpo da requisição não é um JSON válido.'));
    return;
  }

  console.error(err);
  res.status(500).json(body('INTERNAL_ERROR', 'Erro interno do servidor.'));
};
