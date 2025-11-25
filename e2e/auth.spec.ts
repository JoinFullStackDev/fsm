import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/auth/signin');
  });

  test('should display sign-in form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    // Form validation should prevent submission
    // Check that we're still on the sign-in page
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('should navigate to sign-up page', async ({ page }) => {
    const signUpLink = page.getByRole('link', { name: /sign up/i });
    await signUpLink.click();

    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    const forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    await forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  test('should protect dashboard route', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('should protect project routes', async ({ page }) => {
    // Try to access project page without authentication
    await page.goto('/project/test-id');

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});

