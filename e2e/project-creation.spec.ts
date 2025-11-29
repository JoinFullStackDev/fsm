import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers/auth';

test.describe('Project Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication before accessing protected routes
    await setupAuth(page);
    await page.goto('/dashboard');
  });

  test('should display create project button', async ({ page }) => {
    // Assuming dashboard shows create project button
    const createButton = page.getByRole('button', { name: /create project/i });
    await expect(createButton).toBeVisible();
  });

  test('should open project creation dialog', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });
    await createButton.click();

    // Check that dialog/form is visible
    await expect(page.getByRole('heading', { name: /create project/i })).toBeVisible();
    await expect(page.getByLabel(/project name/i)).toBeVisible();
  });

  test('should validate project name', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });
    await createButton.click();

    const submitButton = page.getByRole('button', { name: /create/i });
    await submitButton.click();

    // Should show validation error
    await expect(page.getByText(/project name is required/i)).toBeVisible();
  });

  test('should create project with valid data', async ({ page }) => {
    // Mock API response
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'project-1',
            name: 'Test Project',
            description: 'Test Description',
          }),
        });
      }
    });

    const createButton = page.getByRole('button', { name: /create project/i });
    await createButton.click();

    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByLabel(/description/i).fill('Test Description');

    const submitButton = page.getByRole('button', { name: /create/i });
    await submitButton.click();

    // Should navigate to project page or show success message
    await expect(page).toHaveURL(/\/project\/project-1/);
  });

  test('should allow selecting template', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });
    await createButton.click();

    // Check if template selector is visible
    const templateSelect = page.getByLabel(/template/i);
    if (await templateSelect.isVisible()) {
      await templateSelect.click();
      // Should show template options
      await expect(page.getByRole('option')).toBeVisible();
    }
  });
});

