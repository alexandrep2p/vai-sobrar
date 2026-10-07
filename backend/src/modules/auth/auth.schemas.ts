import { z } from 'zod';

/** auth.md §4: caracteres que contam como "especial" na senha. */
export const PASSWORD_SPECIALS = '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?~`';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  digit: boolean;
  special: boolean;
}

/** Requisitos da senha (auth.md §4); letras acentuadas e espaço não contam como letra nem especial. */
export const passwordChecks = (password: string): PasswordChecks => ({
  length: password.length >= PASSWORD_MIN,
  letter: /[A-Za-z]/.test(password),
  digit: /[0-9]/.test(password),
  special: [...password].some((c) => PASSWORD_SPECIALS.includes(c)),
});

/** Nome: espaços nas pontas removidos e repetidos colapsados; 1–100 caracteres; ao menos 2 palavras. */
export const fullNameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1)
      .max(100)
      .refine((v) => v.split(' ').length >= 2, { message: 'Informe nome e sobrenome.' }),
  );

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.-]{3,30}$/, {
    message: 'Username: 3 a 30 caracteres entre letras sem acento, números, "." e "-".',
  });

/** Email gravado e comparado em minúsculas. */
export const emailSchema = z.string().trim().toLowerCase().max(254).email();

export const newPasswordSchema = z
  .string()
  .max(PASSWORD_MAX)
  .superRefine((value, ctx) => {
    const checks = passwordChecks(value);
    const missing = (Object.keys(checks) as (keyof PasswordChecks)[]).filter((k) => !checks[k]);
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Senha não atende aos requisitos: ${missing.join(', ')}.`,
        params: { missing },
      });
    }
  });

export const registerBody = z
  .object({
    name: fullNameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: newPasswordSchema,
  })
  .strict();

export const updateProfileBody = z
  .object({ name: fullNameSchema.optional(), username: usernameSchema.optional() })
  .strict()
  .refine((body) => body.name !== undefined || body.username !== undefined, {
    message: 'Informe name e/ou username.',
  });

const currentPasswordSchema = z.string().min(1).max(PASSWORD_MAX);

export const changePasswordBody = z
  .object({ current_password: currentPasswordSchema, new_password: newPasswordSchema })
  .strict();

export const deleteAccountBody = z.object({ password: currentPasswordSchema }).strict();

export const loginBody = z
  .object({
    email: z.string().trim().toLowerCase().max(254),
    password: z.string().min(1).max(PASSWORD_MAX),
  })
  .strict();
