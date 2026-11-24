import { expect, test } from '@playwright/test';

type Game = {
  state: { phase: string; stats: { phase: number }; ruck: { clearOut: number; play: string; decidedAt: number | null } | null; ball: { carrierId: number | null } };
};
const g = '(window).__game';
const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __game: Game }).__game.state);

test('drill opens on a ruck with the call panel', async ({ page }, info) => {
  await page.goto('/?seed=7&freeze');
  await page.evaluate(`${g}.advance(1.6)`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${info.project.name}-1-ruck.png` });
  await expect(page.locator('#ruck-panel')).toBeVisible();
  const s = await state(page);
  expect(s.phase).toBe('ruck');
  expect(s.ruck!.clearOut).toBe(2);
  expect(s.ruck!.play).toBe('one');
});

test('choose a call in the panel and the ball comes out', async ({ page }, info) => {
  await page.goto('/?seed=7&freeze');
  await page.locator('[data-co="3"]').click();
  await page.locator('[data-play="two"]').click();
  let s = await state(page);
  expect(s.ruck!.clearOut).toBe(3);
  expect(s.ruck!.play).toBe('two');
  await page.evaluate(`${g}.advance(2.0)`);
  await page.locator('#rk-go').click();
  s = await state(page);
  expect(s.ruck!.decidedAt).not.toBeNull();
  await page.evaluate(`${g}.advance(4.5)`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${info.project.name}-2-out.png` });
  s = await state(page);
  // Either still in open play, or tackled into the next ruck.
  expect(s.phase !== 'ruck' || s.stats.phase >= 2).toBe(true);
});

test('open play: arrows show who you can pass to', async ({ page }, info) => {
  await page.goto('/?seed=11&freeze');
  await page.evaluate(`${g}.call()`);
  await page.evaluate(`${g}.advance(5.5)`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${info.project.name}-3-open.png` });
});
