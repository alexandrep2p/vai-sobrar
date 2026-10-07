# T-69 — API de autenticação

* **Fase:** 3 — API do backend
* **Depende de:** T-68
* **Status:** Concluída

## Objetivo

Cadastro, login, logout e consulta do usuário, com sessão em cookie e proteção das rotas.

## Documentos fonte

* `docs/decisions/business-decisions.md` (PD-41)
* `docs/specs/auth.md`
* `docs/architecture/architecture.md` §22 e §23

## Escopo

* Migration `users` + `sessions` (unicidade `lower(email)`/`lower(username)`, CHECK do username).
* Hash de senha (`scrypt`), token de sessão (hash SHA-256 no banco), cookie `vs_session`.
* `POST /api/auth/register|login|logout`, `GET /api/auth/me`; middleware `requireAuth`.
* Códigos `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `USERNAME_TAKEN`, `TOO_MANY_ATTEMPTS`; limite de tentativas.

## Fora de escopo

* Isolamento dos dados (T-70); Minha conta (T-72).

## Critérios de aceite

* CA-AUTH-01..08 (o 07 vale para `/api/auth/me`; as demais rotas passam a exigir sessão na T-70).

## Testes obrigatórios

* `tests/api/auth.int.spec.ts`: validação, unicidade, login, cookie, logout, sessão adulterada, limite de tentativas.

## Regras para o agente

* Implemente **somente** o escopo desta task.
* As regras de negócio vêm exclusivamente dos documentos fonte listados. Não invente regras.
* Se encontrar ambiguidade ou contradição nos documentos, **interrompa** aquela parte, descreva a dúvida e peça definição (`architecture.md` §24).
* Valores monetários sempre em centavos inteiros.

## Definição de pronto

* Critérios de aceite atendidos.
* Testes obrigatórios escritos e passando.
* Build sem erros.
* Nenhuma regra de negócio nova ou divergente da documentação.

## Decisões técnicas registradas

* Migration `auth_users_sessions`: tabelas `users`/`sessions`, índices únicos `lower(email)`/`lower(username)`, CHECKs de formato do username, tamanho do nome e email em minúsculas.
* Senha: `scrypt` do `node:crypto` (N=2^15, r=8, p=1, salt 16 bytes, formato `scrypt$N$r$p$salt$hash`, `timingSafeEqual`); a senha é normalizada em NFC. Email inexistente verifica contra um hash descartável.
* Sessão: token `randomBytes(32)` em base64url no cookie `vs_session` (`httpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age` de 1 ano, `Secure` por `COOKIE_SECURE`); o banco guarda o SHA-256. `requireAuth` renova `last_used_at` e o cookie no máximo a cada 24 h. Cookie lido manualmente, sem `cookie-parser`.
* Limite: `express-rate-limit` com `skipSuccessfulRequests` (só falhas contam), 10 a cada 15 min por IP; `createApp(ctx, { authRateLimit })` permite desligar nos testes. `TRUST_PROXY` configura o `trust proxy` do Express em produção.
* `cors()` removido (mesma origem). Novos códigos: `UNAUTHENTICATED`/`INVALID_CREDENTIALS` (401), `EMAIL_TAKEN`/`USERNAME_TAKEN` (409), `TOO_MANY_ATTEMPTS` (429).
* Username verificado com `mode: insensitive` (o formato não admite `_`/`%`); email comparado exato, já em minúsculas; P2002 traduzido como fallback de corrida.
