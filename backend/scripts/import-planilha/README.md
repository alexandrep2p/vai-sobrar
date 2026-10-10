# Importação única da planilha "Controle Financeiro"

Uso único. Dados pessoais: `out/` (dataset e relatório) fica fora do git.

1. Extrair e revisar (não toca no banco):

   ```bash
   python scripts/import-planilha/extract.py "C:/caminho/Controle Financeiro.xlsx"
   ```

   Gera `out/dataset.json` e `out/review.md` (contagens, fatura x célula, planos, sinalizações).

2. Simular no banco (transação desfeita no final; valida as constraints):

   ```bash
   npx tsx scripts/import-planilha/import.ts scripts/import-planilha/out/dataset.json --user-email voce@exemplo.com
   ```

3. Gravar de verdade (faça backup antes; rodar duas vezes duplica os dados):

   ```bash
   npx tsx scripts/import-planilha/import.ts scripts/import-planilha/out/dataset.json --user-email voce@exemplo.com --commit
   ```

`--today AAAA-MM-DD` fixa a data de hoje (define faturas fechadas/abertas); `--allow-existing` permite
importar para um usuário que já tem lançamentos.
