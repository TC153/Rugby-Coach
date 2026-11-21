import { expect, test } from '@playwright/test';

type Game = {
  state: { phase: string; ball: { carrierId: number | null }; stats: { tackled: number; tries: number } };
  advance(s: number): void;
};
const g = '(window).__game';

test('drill loads and draws', async ({ page }, info) => {
  await page.goto('/?seed=7&freeze');
  await page.evaluate(`${g}.advance(1.4)`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/${info.project.name}-1-start.png` });
  await expect(page.locator('canvas')).toBeVisible();
});

test('tap passes the ball and the defence tackles', async ({ page }, info) => {
  await page.goto('/?seed=7&freeze');
  await page.evaluate(`${g}.advance(1.2)`);
  const vp = page.viewportSize()!;
  await page.touchscreen.tap(vp.width * 0.85, vp.height * 0.5);
  await page.evaluate(`${g}.advance(0.1)`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${info.project.name}-2-pass.png` });
  await page.evaluate(`${g}.advance(0.6)`);
  const carrier = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state.ball.carrierId);
  expect(carrier).toBe(3);

  // Never pass again: the defence should stop play.
  await page.evaluate(`${g}.advance(4)`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${info.project.name}-3-stopped.png` });
  const phase = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state.phase);
  expect(['tackled', 'try', 'live']).toContain(phase);
  await expect(page.locator('#s-tackled')).toBeVisible();
});
