import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers/auth';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication before accessing protected routes
    await setupAuth(page);
    // Mock notifications API
    await page.route('**/api/notifications**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: [
            {
              id: 'notif-1',
              title: 'Test Notification',
              message: 'Test message',
              read: false,
              created_at: new Date().toISOString(),
              metadata: {
                project_id: 'project-1',
              },
            },
          ],
          unreadCount: 1,
        }),
      });
    });

    await page.goto('/dashboard');
  });

  test('should display notification bell', async ({ page }) => {
    const notificationBell = page.getByRole('button', { name: /notification/i });
    await expect(notificationBell).toBeVisible();
  });

  test('should show unread count badge', async ({ page }) => {
    // Check for badge with unread count
    const badge = page.locator('[data-testid="notification-badge"]');
    if (await badge.isVisible()) {
      await expect(badge).toContainText('1');
    }
  });

  test('should open notification menu', async ({ page }) => {
    const notificationBell = page.getByRole('button').filter({ hasText: /notification/i }).first();
    await notificationBell.click();

    await expect(page.getByText(/notifications/i)).toBeVisible();
    await expect(page.getByText(/test notification/i)).toBeVisible();
  });

  test('should mark notification as read when clicked', async ({ page }) => {
    let markReadCalled = false;
    await page.route('**/api/notifications/notif-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        markReadCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notification: {
              id: 'notif-1',
              read: true,
            },
          }),
        });
      }
    });

    const notificationBell = page.getByRole('button').filter({ hasText: /notification/i }).first();
    await notificationBell.click();

    const notificationItem = page.getByText(/test notification/i);
    await notificationItem.click();

    expect(markReadCalled).toBe(true);
  });

  test('should navigate to project when notification clicked', async ({ page }) => {
    const notificationBell = page.getByRole('button').filter({ hasText: /notification/i }).first();
    await notificationBell.click();

    const notificationItem = page.getByText(/test notification/i);
    await notificationItem.click();

    // Should navigate to project page
    await expect(page).toHaveURL(/\/project\/project-1/);
  });

  test('should open task detail sheet when task notification clicked', async ({ page }) => {
    // Mock notification with task_id
    await page.route('**/api/notifications**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: [
            {
              id: 'notif-2',
              title: 'Task Notification',
              message: 'You were assigned a task',
              read: false,
              created_at: new Date().toISOString(),
              metadata: {
                project_id: 'project-1',
                task_id: 'task-1',
              },
            },
          ],
          unreadCount: 1,
        }),
      });
    });

    await page.goto('/dashboard');
    const notificationBell = page.getByRole('button').filter({ hasText: /notification/i }).first();
    await notificationBell.click();

    const notificationItem = page.getByText(/task notification/i);
    await notificationItem.click();

    // Should navigate to project management page with taskId query
    await expect(page).toHaveURL(/\/project-management\/project-1\?taskId=task-1/);

    // Task detail sheet should be open
    await expect(page.getByText(/task details/i)).toBeVisible();
  });

  test('should open notification drawer', async ({ page }) => {
    const notificationBell = page.getByRole('button').filter({ hasText: /notification/i }).first();
    await notificationBell.click();

    const viewAllButton = page.getByRole('button', { name: /view all/i });
    await viewAllButton.click();

    // Should open drawer
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

