import { test, expect } from '@playwright/test';

test('fluxo completo sem microfone: nivelamento, sessão, resultado e persistência', async ({ page }) => {
  await page.goto('/?timescale=0.02#/home');

  await expect(page.getByTestId('streak')).toHaveText('Sequência: 0 dia(s)');
  await page.getByTestId('placement').click();
  for (let i = 0; i < 7; i++) {
    await page.getByTestId('self-ok').click();
  }

  await expect(page.getByTestId('start')).toBeVisible();
  await page.getByTestId('start').click();

  const result = page.getByTestId('result');
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    if (await result.isVisible()) break;

    const startTimer = page.getByTestId('start-timer');
    if (await startTimer.isVisible()) {
      await startTimer.click();
      await page.getByTestId('count-change').click();
      await page.getByTestId('count-change').click();
      await expect(page.getByTestId('next')).toBeVisible({ timeout: 5000 });
    }
    await page.locator('[data-testid="next"], [data-testid="self-ok"]').first().click();
  }

  await expect(result).toBeVisible();
  await expect(page.getByTestId('result-streak')).toHaveText('Sequência: 1 dia(s)');

  await page.getByTestId('back-home').click();
  await page.reload();
  await expect(page.getByTestId('streak')).toHaveText('Sequência: 1 dia(s)');
});

test('encerrar cedo (dedos doendo) mantém a sequência', async ({ page }) => {
  await page.goto('/?timescale=0.02#/home');
  await page.getByTestId('placement').click();
  for (let i = 0; i < 7; i++) await page.getByTestId('self-miss').click();
  await page.getByTestId('start').click();
  await page.getByTestId('end-early').click();
  await expect(page.getByTestId('result')).toBeVisible();
  await expect(page.getByTestId('result-streak')).toHaveText('Sequência: 1 dia(s)');
});

test.describe('com microfone falso do Chromium', () => {
  test.use({ permissions: ['microphone'] });

  test('o afinador liga o microfone e sai do estado de preparação', async ({ page }) => {
    await page.goto('/?timescale=0.05#/tuner');
    await expect(page.getByTestId('tuner-status')).toHaveText(/^(Toque uma corda\.|[EADGBe]:)/, { timeout: 8000 });
  });
});
