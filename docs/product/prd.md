# PRD — Vai Sobrar

## 1. Visão geral

O **Vai Sobrar** é uma aplicação web de planejamento financeiro pessoal.

O usuário registra entradas e saídas, organiza-as por categorias e métodos de pagamento e vê, mês a mês, quanto está previsto entrar, quanto está previsto sair e qual será o saldo previsto.

A aplicação é orientada à visão futura do fluxo financeiro. No MVP, não é ferramenta de conciliação bancária e não representa o saldo disponível em conta.

---

## 2. Objetivo

Responder rapidamente:

> "Considerando tudo que está planejado para este mês, quanto dinheiro deverá sobrar?"

O planejamento considera entradas, despesas, lançamentos em aberto e pagos, recorrências, compras de cartão, compras parceladas, faturas e estornos, cada um no mês em que produz impacto financeiro.

---

## 3. Princípios do produto

* O sistema trabalha com **saldo previsto**, não com saldo bancário realizado.
* O saldo previsto considera todos os valores planejados, pagos ou em aberto.
* O usuário controla suas categorias e seus métodos de pagamento; não há categorias fixas obrigatórias.
* Não existe método genérico `CRÉDITO`: cada cartão é um método específico.
* Recorrência e parcelamento são conceitos diferentes.
* O impacto financeiro de uma compra de cartão está no mês da fatura, não necessariamente no mês da compra.
* Pagar uma fatura liquida compras; não cria nova despesa.
* Estorno é crédito sobre uma compra de cartão; não é receita.
* Dados históricos são preservados: entidades usadas são desativadas, canceladas ou estornadas, não apagadas.
* Fechar um mês é uma ação explícita, cronológica e irreversível.
* O sistema não toma decisões implícitas que alterem o planejamento sem regra configurada pelo usuário.
* Cada usuário tem uma conta e vê somente os próprios dados (PD-41).

---

## 4. Escopo do MVP

### 4.1 Home — extrato mensal

Tela principal: extrato previsto do mês selecionado, com seletor de mês (passados, atual e futuros), totais (entradas, saídas, saldo previsto), lista de itens com status `Pago`/`Em aberto`, ação `+ Lançamento` e ação `Fechar mês`.

Compras, parcelas e ocorrências de cartão aparecem **individualmente** no mês da sua fatura. Parcelas mostram o número (`2/10`) e dão acesso à compra original. Não existe linha agregada por cartão nem transação com o valor total de um parcelamento. Créditos de estorno aparecem como linhas de crédito.

Detalhes: `docs/specs/home.md`.

### 4.2 Saldo previsto

```text
Saldo previsto = Entradas previstas − Saídas previstas
```

* Todos os itens do mês participam, independentemente do status.
* Créditos de estorno reduzem as saídas previstas do mês em que são reconhecidos.
* Marcar como pago não altera o saldo previsto.

```text
Salário    + R$ 8.500   Pago
Aluguel    − R$ 1.500   Pago
Internet   − R$   120   Em aberto
Saldo previsto = R$ 6.880
```

---

### 4.3 Contas e acesso

O usuário cria uma conta (nome, username, email e senha), entra com email e senha e permanece conectado até sair. Cada usuário vê e altera apenas os próprios dados. Em "Minha conta", o usuário edita nome e username, troca a senha e pode excluir a conta com todos os dados.

Detalhes: `docs/specs/auth.md` (PD-41).

---

## 5. Lançamentos

O usuário cria entradas e saídas com descrição, valor, data, categoria e método de pagamento. Cada lançamento tem status (`Em aberto` ou `Pago`) e, quando pago, data de pagamento.

* A natureza (entrada ou saída) vem **somente** da categoria.
* O mês financeiro é o mês do vencimento para métodos comuns e o mês da fatura para cartão.
* O pagamento pode ser antecipado ou atrasado sem mudar o mês financeiro.
* Lançamentos futuros são permitidos; retroativos, somente no mês corrente até hoje.
* Com o mês aberto, o vencimento de lançamentos comuns pode ser movido para frente ou para trás, desde que o mês de destino esteja aberto.
* Lançamentos podem ser apagados com o mês aberto; compras de cartão e compras parceladas (inteiras), enquanto a fatura não estiver paga (PD-38, provisório: no futuro, privilégio de super admin).

Detalhes: `docs/specs/transactions.md`.

---

## 6. Categorias

O usuário cria categorias com nome, tipo (`Entrada`/`Saída`) e estado ativo/inativo. Categorias podem ser renomeadas, desativadas e reativadas, mas nunca excluídas. O tipo não muda depois que a categoria tiver qualquer uso.

Detalhes: `docs/specs/categories.md`.

---

## 7. Métodos de pagamento

O sistema fornece PIX, Dinheiro e Débito (não editáveis nem excluíveis, mas desativáveis). O usuário cria métodos adicionais (por exemplo, vale-refeição) e cartões de crédito. Métodos nunca são excluídos; um método serve para entradas e saídas.

Detalhes: `docs/specs/payment-methods.md`.

---

## 8. Cartões de crédito

O usuário cadastra quantos cartões quiser, cada um com nome, melhor dia de compra e dia de vencimento (1 a 31; dias inexistentes no mês usam o último dia do mês).

* O melhor dia é o último dia do ciclo de compras; a fatura vence sempre **depois** do fim do ciclo, podendo vencer no mês seguinte.
* A compra pertence ao ciclo definido pela data em que aconteceu, mesmo que seja cadastrada depois do melhor dia.
* Se a fatura daquele ciclo já estiver paga, a compra vai para a próxima fatura não paga, preservando a data original da compra.
* Alterar o melhor dia ou o vencimento não altera faturas já existentes.
* Desativar o cartão impede novas compras e preserva faturas e parcelas.

```text
Melhor dia 6, vencimento 15
Compra 05/10 → fatura de outubro, vence 15/10
Compra 07/10 → fatura de novembro, vence 15/11

Melhor dia 25, vencimento 5
Compra 20/10 → fatura de outubro, vence 05/11, impacta outubro
```

Detalhes: `docs/specs/credit-cards.md`.

---

## 9. Faturas

A fatura agrupa os lançamentos de um ciclo do cartão: `Aberta` (ciclo em andamento), `Fechada` (ciclo encerrado, aguardando pagamento) e `Paga`.

* Ciclos futuros sem lançamentos são exibidos como "Sem lançamentos — R$ 0,00", sem existir no banco.
* Itens de cartão não são pagos individualmente: ficam em aberto até a fatura ser paga.
* A ação **Pagar fatura** (para fatura aberta ou fechada, ainda não paga) usa uma data e um método de pagamento diferente do próprio cartão, liquida os lançamentos pendentes e não cria despesa. Não há pagamento parcial nem desfazer pagamento.
* Fatura paga nunca é reaberta, e os seus lançamentos não podem mais ser editados.
* Fatura vencida e não paga é exibida como atrasada, sem juros ou multa.
* Créditos que superem os débitos viram saldo credor da fatura, aproveitado na fatura seguinte, sem novo lançamento.

Detalhes: `docs/specs/invoices.md`.

---

## 10. Recorrências

Recorrência mensal é a regra que gera lançamentos (ocorrências): descrição, valor, categoria, método (inclusive cartão), dia de vencimento, data inicial, data final opcional e estado (`Ativa`, `Pausada`, `Cancelada`).

* Não há ocorrência retroativa à criação.
* Alterações na regra afetam somente ocorrências ainda não geradas.
* Uma ocorrência pode ser editada individualmente (exceto a categoria) ou pulada sem cancelar a recorrência.
* Pausa e cancelamento preservam o histórico; a retomada não gera ocorrências retroativas.
* Método, categoria ou cartão inativo bloqueia novas ocorrências.
* Ocorrência paga com cartão é uma compra no cartão, não parcela.

Detalhes: `docs/specs/recurrences.md`.

---

## 11. Compras parceladas

O usuário informa uma única vez descrição, valor total, data da compra, cartão, categoria e quantidade de parcelas (2 ou mais). O sistema calcula parcelas que somam exatamente o total (centavos restantes nas últimas parcelas) e as distribui por faturas consecutivas.

Valor total, quantidade, cartão e data da compra são imutáveis. Descrição e categoria podem ser alteradas somente enquanto todas as parcelas estiverem em meses abertos e em faturas não pagas.

```text
R$ 100,00 em 3x → 33,33 · 33,33 · 33,34
```

Detalhes: `docs/specs/installments.md`.

---

## 12. Estornos

Somente compras de cartão (à vista, parceladas ou ocorrências de recorrência com cartão) podem ser estornadas, total ou parcialmente, em um ou mais estornos que somados não ultrapassem o valor original.

* O estorno não altera nem apaga a compra; é um crédito vinculado a ela.
* Em compras parceladas, o usuário escolhe a distribuição: primeiras parcelas, últimas parcelas ou proporcional.
* O crédito entra na fatura da compra ou parcela se ela ainda estiver aberta; caso contrário, na fatura do período em que o estorno ocorreu. Nunca entra em fatura fechada ou paga e nunca altera mês fechado.

```text
Compra    − R$ 500,00
Estorno   + R$ 200,00
Impacto líquido − R$ 300,00
```

Detalhes: `docs/specs/refunds.md`.

---

## 13. Fechamento do mês

* O mês fica aberto até o usuário executar **Fechar mês**, com confirmação. Ele nunca fecha sozinho.
* Só fecha com todos os lançamentos pagos, com todas as faturas daquele mês pagas e com todos os meses anteriores que tenham lançamentos já fechados.
* O mês corrente pode ser fechado antes do último dia; meses futuros não podem ser fechados.
* O fechamento é irreversível e torna o mês imutável, inclusive as faturas daquele mês.
* Fechar um mês não depende das faturas de outros meses.

Detalhes: `docs/specs/financial-periods.md`.

---

## 14. Preservação histórica

Não há exclusão de categorias, métodos, cartões, faturas nem meses fechados; lançamentos e compras parceladas só são apagados nas condições da PD-38. Alterações de configuração valem para o futuro e não reescrevem fatos históricos.

---

## 15. Fora do escopo do MVP

Saldo bancário realizado, conciliação, importação de extratos, Open Banking, sincronização bancária, múltiplas contas, transferências, orçamento por categoria, investimentos detalhados, gráficos avançados, notificações, juros e multas de cartão, limite de crédito, antecipação ou renegociação de parcelas, alteração do número de parcelas, pagamento parcial de fatura, recuperação de senha, 2FA, papéis e permissões, compartilhamento de dados entre usuários.

---

## 16. Critérios gerais de aceite

1. Criar, editar, ativar e desativar categorias `Entrada`/`Saída`, sem categoria obrigatória ou hard-coded.
2. Categoria inativa não é usada em novos lançamentos; o tipo não muda depois do uso.
3. Métodos do sistema PIX, Dinheiro e Débito; métodos personalizados; sem `CRÉDITO` genérico.
4. Criar entradas e saídas com natureza pela categoria.
5. Vencimento e data de pagamento; status de lançamentos com método comum reversível com o mês aberto; itens de cartão liquidados pela fatura; o status não altera o saldo previsto.
6. Home com meses passados, atual e futuros e saldo previsto correto.
7. Recorrências mensais com ocorrências futuras, pausa, cancelamento e ocorrência pulada, sem destruir histórico.
8. Múltiplos cartões; ciclo pelo melhor dia; vencimento sempre posterior ao fechamento.
9. Compra pertence ao ciclo da data da compra; compra para fatura já paga vai para a próxima fatura não paga.
10. Parcelamentos distribuídos por faturas consecutivas, somando exatamente o total.
11. Mês financeiro de cartão = mês da fatura.
12. Faturas com estados próprios; pagamento em uma ação, sem nova despesa.
13. Estornos totais e parciais de compras de cartão sem alterar a compra original.
14. Fechamento manual, cronológico (meses anteriores com lançamentos), sem meses futuros, irreversível e somente com todos os lançamentos pagos; mês fechado imutável.
15. Alterações de configuração não reescrevem o histórico.

---

## 17. Resultado esperado

```text
Cadastrar categorias → métodos → cartões
        ↓
Registrar entradas e saídas, recorrências e compras parceladas
        ↓
Visualizar faturas e acompanhar Pago / Em aberto
        ↓
Visualizar o saldo previsto de cada mês
        ↓
Estornar compras de cartão quando necessário
        ↓
Fechar o mês e preservar o histórico
```

O resultado central é mostrar, de forma simples e consistente, **quanto está previsto entrar, quanto está previsto sair e quanto deverá sobrar em cada mês**, mantendo separados o impacto financeiro, a liquidação e o histórico fechado.
