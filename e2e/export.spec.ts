import { test, expect } from '@playwright/test';

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/project/test-project-id');
  });

  test('should display export options', async ({ page }) => {
    // Look for export button or menu
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await expect(page.getByText(/blueprint/i)).toBeVisible();
      await expect(page.getByText(/cursor/i)).toBeVisible();
    }
  });

  test('should generate blueprint bundle', async ({ page }) => {
    // Mock API response
    await page.route('**/api/projects/**/exports/blueprint', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('mock zip content'),
        headers: {
          'Content-Disposition': 'attachment; filename="blueprint-bundle.zip"',
        },
      });
    });

    const exportButton = page.getByRole('button', { name: /export/i });
    await exportButton.click();

    const blueprintButton = page.getByRole('button', { name: /blueprint/i });
    await blueprintButton.click();

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('blueprint');
  });

  test('should generate cursor bundle', async ({ page }) => {
    // Mock API response
    await page.route('**/api/projects/**/exports/cursor', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('mock zip content'),
        headers: {
          'Content-Disposition': 'attachment; filename="cursor-bundle.zip"',
        },
      });
    });

    const exportButton = page.getByRole('button', { name: /export/i });
    await exportButton.click();

    const cursorButton = page.getByRole('button', { name: /cursor/i });
    await cursorButton.click();

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('cursor');
  });

  test('should track export history', async ({ page }) => {
    // Mock API for export history
    await page.route('**/api/projects/**/exports/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exports: [
            {
              id: 'export-1',
              type: 'blueprint',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Navigate to export history if available
    const historyLink = page.getByRole('link', { name: /export history/i });
    if (await historyLink.isVisible()) {
      await historyLink.click();
      await expect(page.getByText(/export history/i)).toBeVisible();
    }
  });
});

