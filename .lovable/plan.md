# Planejamento: Implementar módulo de Planejamento Tributário / Lucro Presumido

## Objetivo
Criar uma interface detalhada e funcional para apuração mensal e trimestral de impostos para empresas no Lucro Presumido.

## Arquitetura de UI
1. **Cabeçalho:** Informações da empresa e parâmetros de cálculo (campos editáveis).
2. **Tabela Mensal:** 12 meses (Janeiro - Dezembro) com colunas solicitadas para cálculos automáticos.
3. **Impostos Trimestrais:** Bloco inferior para apuração trimestral (BC CSLL/IRPJ, retenções, impostos a pagar).
4. **Resumo:** Códigos de receita em destaque.

## Detalhes Técnicos
- **Estado Local:** Utilizar `useState` complexo ou `useReducer` para gerenciar a tabela de dados mensal, permitindo edições e recalculos automáticos.
- **Cálculos:** Implementar as fórmulas especificadas para PIS, COFINS, ICMS (com crédito), CSLL e IRPJ (com adicional).
- **Formatadores:** Helper functions para formatar valores como BRL (R$ 1.234,56) e percentuais (0,65%).
- **Persistência:** Utilizar o campo `data` (JSONB) na tabela `tax_planning` para salvar o estado completo da simulação.

## Estrutura de Componentes
- `LucroPresumidoForm`: Componente principal que renderiza toda a lógica de apuração.
- `TaxPlanningDetail`: Nova página que carrega o planejamento existente e exibe o `LucroPresumidoForm`.

## Plano de Execução
1. Criar `LucroPresumidoForm.tsx`.
2. Atualizar `TaxPlanning.tsx` para redirecionar para a página de edição/detalhe ao clicar em um planejamento.
3. Implementar a lógica de cálculo dentro do componente para oferecer feedback em tempo real.
