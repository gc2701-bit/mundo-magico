/* Sprint 5 (Task 5.1) del sitio nuevo en Next.js — cuenta de cliente. Corre
 * contra un build real (ver playwright.next.config.js), igual que
 * familia.spec.js.
 *
 * Turnstile no completa la verificación en este entorno (un subdominio de
 * Cloudflare no resuelve por DNS acá — mismo hallazgo ya documentado para
 * el panel admin en Sprint 4), así que estos tests cubren lo que no
 * depende de un token real: el gate de sesión, la validación cliente que
 * bloquea ANTES de llegar a Supabase, y la navegación entre pestañas.
 *
 * `.first()` en los locators de .cuenta-nav: desde Sprint 2 del rediseño
 * de frontend, Nav.tsx lo renderiza dos veces (fila de escritorio + barra
 * inferior de mobile) — ver el mismo comentario en carrito.spec.js.
 */
const { test, expect } = require('@playwright/test');

test('el ícono de cuenta abre el modal de alta al no tener sesión', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cuenta-nav').first().click();
  await expect(page.locator('.cart-acc').first()).toHaveClass(/is-on/);
  await expect(page.locator('.cart-acc.is-on .cart-acc-tab.is-on')).toHaveText('Crear cuenta');
});

test('crear cuenta sin completar nada muestra el error de nombre, sin llamar a Supabase', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cuenta-nav').first().click();
  await page.getByRole('button', { name: 'Crear cuenta y continuar' }).click();
  await expect(page.locator('.cart-acc-error')).toHaveText('Falta tu nombre.');
});

test('pasar a "Ya tengo cuenta" cambia de pestaña y de formulario', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cuenta-nav').first().click();
  await page.getByRole('button', { name: 'Ya tengo cuenta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión y continuar' })).toBeVisible();

  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.getByRole('button', { name: 'Mandar link' })).toBeVisible();
});

test('Escape cierra el modal de cuenta', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cuenta-nav').first().click();
  await expect(page.locator('.cart-acc').first()).toHaveClass(/is-on/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.cart-acc').first()).not.toHaveClass(/is-on/);
});
