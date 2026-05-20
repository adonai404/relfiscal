Restaurarei o painel de configurações por empresa dentro da tela de **Movimento**, permitindo o ajuste de rótulos, visibilidade de colunas e taxas do Simples Nacional, conforme solicitado. Também removerei o acesso às configurações globais da tela inicial, centralizando a gestão na empresa selecionada.

### Alterações técnicas:

1.  **Componente `FiscalConfigForm`**: Criarei um novo componente `src/components/FiscalConfigForm.tsx` (já que o original não foi encontrado) que gerenciará:
    *   **Rótulos de Colunas**: Campos de texto para personalizar o nome de cada coluna (ICMS, PIS, COFINS, etc.).
    *   **Visibilidade**: Switches para ativar/desativar a exibição de colunas específicas.
    *   **Cálculo Automático**: Configuração da alíquota do Simples Nacional e toggle para cálculo automático.
    *   **Colunas de Imposto**: Seleção de quais colunas compõem o total de "Impostos" nos KPIs.

2.  **Integração no `Movement.tsx`**:
    *   Adicionarei um botão de engrenagem (**Settings**) no cabeçalho ou barra de ferramentas (apenas para não-clientes).
    *   Abrirei um `Dialog` contendo o `FiscalConfigForm`.
    *   Garantirei que as alterações sejam salvas via `useUpdateFiscalConfig` e invalidem o cache para atualização instantânea da tabela.

3.  **Ajuste na `Home.tsx`**:
    *   Removerei o item "Minha Conta" do grid de funcionalidades da tela inicial.
    *   O usuário ainda poderá acessar configurações de perfil se desejar através de outros meios, mas a "aba de configurações" principal solicitada para sair da home será removida.

4.  **Limitação de Acesso**:
    *   O botão de configurações dentro do Movimento será ocultado para perfis de **Cliente** (`isCustomer`), mantendo o modo apenas leitura para eles.
