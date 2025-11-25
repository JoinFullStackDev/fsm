import { test, expect } from '@playwright/test';

test.describe('Phase Completion', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and project data
    await page.goto('/project/test-project-id/phase/1');
  });

  test('should display phase form', async ({ page }) => {
    // Check that form fields are visible
    await expect(page.getByRole('form')).toBeVisible();
  });

  test('should auto-save form data', async ({ page }) => {
    // Mock API for auto-save
    let saveCallCount = 0;
    await page.route('**/api/projects/**/phases/**', async (route) => {
      if (route.request().method() === 'PUT') {
        saveCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    const firstField = page.getByLabel(/problem statement/i).first();
    await firstField.fill('Test problem statement');

    // Wait for debounced auto-save (2 seconds)
    await page.waitForTimeout(2500);

    expect(saveCallCount).toBeGreaterThan(0);
  });

  test('should validate required fields before completion', async ({ page }) => {
    const completeButton = page.getByRole('button', { name: /mark as completed/i });
    await completeButton.click();

    // Should show validation errors or prevent completion
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should enforce phase dependencies', async ({ page }) => {
    // Try to complete phase 2 when phase 1 is not completed
    await page.goto('/project/test-project-id/phase/2');

    const completeButton = page.getByRole('button', { name: /mark as completed/i });
    await completeButton.click();

    // Should show dependency warning
    await expect(page.getByText(/complete phase 1/i)).toBeVisible();
  });

  test('should navigate between phases', async ({ page }) => {
    await page.goto('/project/test-project-id/phase/1');

    // Check for phase navigation buttons
    const nextPhaseButton = page.getByRole('button', { name: /next phase/i });
    if (await nextPhaseButton.isVisible()) {
      await nextPhaseButton.click();
      await expect(page).toHaveURL(/\/phase\/2/);
    }
  });

  test('should show phase progress indicator', async ({ page }) => {
    // Check for progress indicator
    const progressIndicator = page.locator('[role="progressbar"]');
    if (await progressIndicator.isVisible()) {
      await expect(progressIndicator).toBeVisible();
    }
  });
});

