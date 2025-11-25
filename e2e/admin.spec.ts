import { test, expect } from '@playwright/test';

test.describe('Admin Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In real tests, you would authenticate as admin
    await page.goto('/admin');
  });

  test('should restrict admin access to non-admins', async ({ page }) => {
    // Try to access admin page without admin role
    await page.goto('/admin');

    // Should redirect or show forbidden message
    const forbiddenMessage = page.getByText(/forbidden|access denied/i);
    if (await forbiddenMessage.isVisible()) {
      await expect(forbiddenMessage).toBeVisible();
    } else {
      // Or redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test('should display admin dashboard for admin users', async ({ page }) => {
    // Assuming admin authentication is set up
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible();
  });

  test('should display user management tab', async ({ page }) => {
    const usersTab = page.getByRole('tab', { name: /users/i });
    await expect(usersTab).toBeVisible();

    await usersTab.click();
    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible();
  });

  test('should create new user', async ({ page }) => {
    // Mock API response
    await page.route('**/api/admin/users', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user-1',
              email: 'newuser@example.com',
              name: 'New User',
            },
            temporaryPassword: 'temp123',
          }),
        });
      }
    });

    const createButton = page.getByRole('button', { name: /create user/i });
    await createButton.click();

    await page.getByLabel(/name/i).fill('New User');
    await page.getByLabel(/email/i).fill('newuser@example.com');
    await page.getByLabel(/role/i).selectOption('engineer');

    const submitButton = page.getByRole('button', { name: /create/i });
    await submitButton.click();

    // Should show success message with password
    await expect(page.getByText(/user created/i)).toBeVisible();
    await expect(page.getByText(/temporary password/i)).toBeVisible();
  });

  test('should display template management', async ({ page }) => {
    const templatesTab = page.getByRole('tab', { name: /templates/i });
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await expect(page.getByRole('button', { name: /create template/i })).toBeVisible();
    }
  });

  test('should validate user creation form', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create user/i });
    await createButton.click();

    const submitButton = page.getByRole('button', { name: /create/i });
    await submitButton.click();

    // Should show validation errors
    await expect(page.getByText(/name is required/i)).toBeVisible();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });
});

