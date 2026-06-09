import { test, expect } from "@playwright/test";

/**
 * Verifica que, ao abrir a aba Movimento e acionar a impressão, a seção de
 * Documentação (em especial a tabela de débitos e a lista de parcelamento)
 * é renderizada por completo no layout de impressão — sem cortes.
 *
 * Pré-requisitos para rodar:
 *   - Definir E2E_BASE_URL apontando para um preview já autenticado, OU
 *     subir `bun run preview` localmente e exportar E2E_COMPANY_ID.
 *   - Exportar E2E_COMPANY_ID com o id da empresa que possui documentação
 *     publicada contendo "Relação dos Débitos" e "Parcelamento".
 *
 * Execução:
 *   E2E_BASE_URL=https://<preview>.lovable.app \
 *   E2E_COMPANY_ID=<uuid> \
 *     bunx playwright test e2e/movement-print.spec.ts
 */

const COMPANY_ID = process.env.E2E_COMPANY_ID;

test.describe("Movimento — impressão da Documentação", () => {
  test.skip(!COMPANY_ID, "Defina E2E_COMPANY_ID para rodar este teste.");

  test("imprime tabela de débitos e parcelamento sem cortes", async ({ page }) => {
    // 1. Abre a aba Movimento da empresa
    await page.goto(`/movimento?company=${COMPANY_ID}`);
    await page.waitForLoadState("networkidle");

    // 2. Garante que a página principal carregou
    await expect(page.getByText("Movimento Fiscal").first()).toBeVisible();

    // 3. Intercepta window.print para não abrir o diálogo nativo do SO,
    //    mas mantém a transição para o media query "print" via emulateMedia.
    await page.evaluate(() => {
      // @ts-expect-error noop para testes
      window.print = () => {};
    });

    // 4. Clica no botão "Imprimir"
    const printBtn = page.getByRole("button", { name: /imprimir/i });
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    // 5. Emula o media print para que as regras @media print apliquem
    await page.emulateMedia({ media: "print" });

    // 6. A seção de docs deve estar visível
    const docsSection = page.locator(".print-docs");
    await expect(docsSection).toBeVisible();
    await expect(docsSection.getByText("Documentação")).toBeVisible();

    // 7. Cabeçalho da tabela de débitos
    const docsContent = page.locator(".print-docs-content");
    await expect(docsContent.getByText(/Relação dos Débitos/i)).toBeVisible();
    await expect(
      docsContent.getByRole("cell", { name: /Período de Apuração/i }),
    ).toBeVisible();

    // 8. TODAS as linhas da tabela de débitos precisam estar no DOM e visíveis.
    //    Se o navegador estiver cortando a última linha por causa de
    //    `page-break-inside: avoid` em conteúdo maior que uma página,
    //    a célula não terá altura/largura > 0.
    const debitRows = docsContent.locator("table tbody tr");
    const rowCount = await debitRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < rowCount; i++) {
      const row = debitRows.nth(i);
      await expect(row).toBeVisible();
      const box = await row.boundingBox();
      expect(box, `linha ${i} sem boundingBox`).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeGreaterThan(0);
    }

    // 9. A seção de Parcelamento (depois da tabela) precisa também estar
    //    visível e completa.
    await expect(docsContent.getByText(/Parcelamento/i)).toBeVisible();
    const parcelLabels = [
      /Valor total consolidado/i,
      /Número de parcelas/i,
      /Valor da primeira parcela/i,
      /Valor das demais parcelas/i,
    ];
    for (const label of parcelLabels) {
      const el = docsContent.getByText(label);
      await expect(el).toBeVisible();
      const box = await el.boundingBox();
      expect(box, `${label} sem boundingBox`).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
    }

    // 10. Snapshot opcional para revisão visual manual
    await page.screenshot({
      path: "e2e/__screenshots__/movement-print.png",
      fullPage: true,
    });
  });
});