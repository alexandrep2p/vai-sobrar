# Feature Spec — Contas e acesso

## 1. Objetivo

Permitir que cada pessoa crie uma conta, entre com email e senha e use o Vai Sobrar com dados próprios, que nenhum outro usuário vê ou altera (PD-41).

---

## 2. Escopo

Contempla cadastro, login, sessão, logout, proteção da API, isolamento dos dados por usuário, edição de perfil (nome e username), troca de senha e exclusão da conta.

Não contempla: recuperação de senha, confirmação de cadastro por email ou SMS, 2FA, papéis e permissões, compartilhamento de dados entre usuários, alteração de email.

---

## 3. Estrutura

```text
User
├── id
├── name
├── username
├── email
├── password_hash
├── created_at
└── updated_at

Session (registro técnico)
├── id
├── user_id
├── token_hash
├── created_at
└── last_used_at
```

* A senha nunca é gravada nem devolvida; o banco guarda somente o hash.
* O token da sessão fica em um cookie que o JavaScript da página não lê; o banco guarda somente o hash do token.

---

## 4. Campos e validação

| Campo | Regra | Exemplo aceito | Exemplo rejeitado |
|---|---|---|---|
| Nome | 1 a 100 caracteres após remover espaços nas pontas; **ao menos 2 palavras**; qualquer caractere; espaços repetidos viram um só ao salvar | `Carlos Abreu` | `Carlos` |
| Username | 3 a 30 caracteres; apenas `A–Z`, `a–z`, `0–9`, `.` e `-` (sem acento); único sem diferenciar maiúsculas; guarda a grafia digitada | `Carlos.Abreu` | `ca`, `carlos_abreu`, `joão` |
| Email | formato de email; único sem diferenciar maiúsculas; gravado em minúsculas; imutável | `ana@x.com` | `ana@` |
| Senha | 8 a 128 caracteres; ao menos uma letra (`A–Z`/`a–z`), um número e um especial da lista abaixo | `abc123!@` | `abcdefgh`, `abc12345` |
| Confirmação | igual à senha (validada na tela) | | |

Caracteres especiais aceitos para o requisito:

```text
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ? ~ `
```

* Espaço e letras acentuadas são permitidos na senha, mas não contam como especial nem como letra.
* Abaixo do campo de senha, a tela mostra ao vivo cada requisito (8+ caracteres, letra, número, especial) como atendido ou não.

---

## 5. Cadastro

1. O usuário informa nome, username, email, senha e confirmação.
2. O sistema valida os campos (§4), a unicidade do email e do username.
3. A conta é criada junto com os métodos do sistema dela (PIX, Dinheiro, Débito — `payment-methods.md` §3).
4. O usuário **não** entra automaticamente: vai para a tela de login, com o email já preenchido.

---

## 6. Login, sessão e logout

* O login é feito com email (sem diferenciar maiúsculas) e senha.
* Email inexistente e senha errada produzem a mesma resposta: "Email ou senha inválidos".
* A sessão **não expira por tempo**: o usuário continua conectado até clicar em "Sair" (ou limpar os cookies do navegador).
* Cada dispositivo/navegador tem a sua sessão; várias podem estar ativas ao mesmo tempo. "Sair" encerra somente a sessão atual.
* Tentativas malsucedidas em excesso de login, cadastro ou confirmação da senha atual (trocar senha, excluir conta) a partir do mesmo endereço são bloqueadas temporariamente (restrição técnica, `architecture.md` §22).

---

## 7. Isolamento dos dados

* Todas as entidades financeiras (categorias, métodos, cartões, faturas, lançamentos, parcelamentos, recorrências, estornos e meses) pertencem a um usuário.
* Um usuário não lista, não consulta, não altera e não referencia dados de outro. Para ele, o dado de outro usuário simplesmente não existe (resposta "não encontrado").
* Regras de unicidade e de meses valem dentro dos dados de cada usuário: dois usuários podem ter a categoria "Mercado"; o fechamento de setembro de um não afeta o setembro do outro.

---

## 8. Minha conta

### 8.1 Editar perfil

* Apenas nome e username podem ser alterados, com as regras e a unicidade do §4.
* Não exige senha.
* O email não pode ser alterado.

### 8.2 Trocar senha

* Exige a senha atual, a nova senha e a confirmação. A nova senha segue o §4.
* Senha atual errada → rejeitado.
* Ao trocar, todas as **outras** sessões do usuário são encerradas; a sessão atual continua.

### 8.3 Excluir conta

* Exige a senha atual e uma confirmação explícita de que a ação é irreversível.
* Apaga definitivamente o usuário, todas as sessões e todos os dados financeiros dele, inclusive meses fechados e faturas pagas.
* Depois da exclusão, o email e o username ficam livres para um novo cadastro.

---

## 9. API

| Método e rota | Acesso | Efeito |
|---|---|---|
| `POST /api/auth/register` | público | cria a conta; não abre sessão |
| `POST /api/auth/login` | público | abre a sessão (cookie) |
| `POST /api/auth/logout` | público | encerra a sessão atual, se houver |
| `GET /api/auth/me` | autenticado | dados do usuário (id, nome, username, email) |
| `PUT /api/auth/me` | autenticado | edita nome e/ou username |
| `POST /api/auth/me/password` | autenticado | troca a senha |
| `DELETE /api/auth/me` | autenticado | exclui a conta |

Todas as demais rotas de `/api` exigem sessão válida; sem ela, a resposta é `UNAUTHENTICATED`.

### 9.1 Erros

| Código | HTTP | Quando |
|---|---|---|
| `UNAUTHENTICATED` | 401 | rota protegida sem sessão válida |
| `INVALID_CREDENTIALS` | 401 | login com email inexistente ou senha errada |
| `EMAIL_TAKEN` | 409 | email já cadastrado |
| `USERNAME_TAKEN` | 409 | username já cadastrado |
| `INVALID_CURRENT_PASSWORD` | 422 | senha atual errada ao trocar senha ou excluir conta |
| `TOO_MANY_ATTEMPTS` | 429 | excesso de tentativas malsucedidas (login, cadastro, senha atual) |
| `VALIDATION_ERROR` | 400 | campo fora das regras do §4 |

---

## 10. Telas

* **Login** (`/login`) e **Cadastro** (`/cadastro`): fora do menu principal, acessíveis só para quem não está conectado; links entre as duas.
* As demais telas exigem login; sem sessão, o usuário vai para o login e, ao entrar, volta para a tela que tentou abrir.
* Menu lateral: nome e username do usuário, "Minha conta" e "Sair".
* **Minha conta** (`/conta`): perfil, trocar senha e excluir conta.
* Mobile first, como as demais telas (PD-37: botão de confirmar desabilitado enquanto o formulário é inválido ou envia).

---

## 11. Regras de negócio

* **RN-AUTH-01** — Somente usuários autenticados acessam a aplicação e a API (exceto cadastro e login).
* **RN-AUTH-02** — Cadastro com nome, username, email, senha e confirmação, validados conforme o §4.
* **RN-AUTH-03** — Email e username são únicos sem diferenciar maiúsculas.
* **RN-AUTH-04** — O cadastro não abre sessão; o usuário faz login em seguida.
* **RN-AUTH-05** — Login por email e senha, com mensagem de erro genérica.
* **RN-AUTH-06** — A sessão não expira por tempo; várias sessões simultâneas; "Sair" encerra só a atual.
* **RN-AUTH-07** — Cada usuário vê e altera apenas os próprios dados.
* **RN-AUTH-08** — Cada conta recebe os próprios métodos do sistema ao ser criada.
* **RN-AUTH-09** — Perfil: só nome e username são editáveis; email é imutável.
* **RN-AUTH-10** — Trocar senha exige a senha atual e encerra as outras sessões.
* **RN-AUTH-11** — Excluir conta exige a senha atual e apaga todos os dados do usuário.

---

## 12. Critérios de aceitação

* **CA-AUTH-01** — Cadastro válido → conta criada, sem sessão; login com o mesmo email e senha → conectado.
* **CA-AUTH-02** — Nome com uma palavra → rejeitado.
* **CA-AUTH-03** — Username com `_`, acento, menos de 3 ou mais de 30 caracteres → rejeitado.
* **CA-AUTH-04** — Senha sem letra, sem número, sem especial ou com menos de 8 caracteres → rejeitado; o checklist mostra o requisito pendente.
* **CA-AUTH-05** — Existindo `ana@x.com` e `Carlos.Abreu`, cadastrar `ANA@x.com` ou `carlos.abreu` → rejeitado.
* **CA-AUTH-06** — Senha errada e email inexistente → mesma mensagem.
* **CA-AUTH-07** — Sem sessão, qualquer rota protegida → `UNAUTHENTICATED`; na tela, redireciona ao login.
* **CA-AUTH-08** — Depois de "Sair", a sessão antiga não acessa mais a API.
* **CA-AUTH-09** — Usuário B não vê nem altera categoria, método, cartão, fatura, lançamento, parcelamento, recorrência ou estorno do usuário A; tentar → "não encontrado".
* **CA-AUTH-10** — A e B podem ter categoria com o mesmo nome; o fechamento de um mês por A não fecha o de B.
* **CA-AUTH-11** — Novo usuário vê somente PIX, Dinheiro e Débito, sem dados de outros.
* **CA-AUTH-12** — Trocar senha com a senha atual errada → rejeitado; com a certa → outra sessão do usuário cai, a atual continua.
* **CA-AUTH-13** — Editar nome e username respeita as regras do cadastro; o email não é editável.
* **CA-AUTH-14** — Excluir conta com a senha certa → todos os dados apagados; o mesmo email pode se cadastrar de novo.

---

## 13. Testes obrigatórios

* validação de cada campo do cadastro e unicidade sem diferenciar maiúsculas;
* login, logout, sessão inválida ou adulterada, várias sessões;
* rotas protegidas sem sessão;
* isolamento entre dois usuários em todas as entidades e no fechamento de mês;
* geração de ocorrências de recorrência por usuário;
* editar perfil, trocar senha (outras sessões encerradas) e excluir conta (dados apagados);
* telas: checklist da senha, guards de rota, redirecionamento em 401, Minha conta.
