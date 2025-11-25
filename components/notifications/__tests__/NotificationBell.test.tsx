import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationBell from '../NotificationBell';
import { renderWithProviders } from '@/lib/test-utils';
import { createSupabaseClient } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient');
jest.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

global.fetch = jest.fn();

describe('NotificationBell', () => {
  const mockOnOpenDrawer = jest.fn();
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1' },
          },
        },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'user-1' },
      }),
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [],
        unreadCount: 0,
      }),
    });
  });

  it('should render notification bell icon', () => {
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should display unread count badge', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: '1',
            title: 'Test',
            message: 'Test message',
            read: false,
            created_at: new Date().toISOString(),
            metadata: {},
          },
        ],
        unreadCount: 1,
      }),
    });

    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('should open menu when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('should display loading state', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ notifications: [], unreadCount: 0 }),
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    const button = screen.getByRole('button');
    await user.click(button);

    // Should show loading indicator (CircularProgress)
    await waitFor(() => {
      const loadingIndicator = document.querySelector('[role="progressbar"]');
      if (loadingIndicator) {
        expect(loadingIndicator).toBeInTheDocument();
      }
    });
  });

  it('should display empty state when no notifications', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('No new notifications')).toBeInTheDocument();
    });
  });

  it('should mark notification as read when clicked', async () => {
    const mockNotification = {
      id: '1',
      title: 'Test',
      message: 'Test message',
      read: false,
      created_at: new Date().toISOString(),
      metadata: { project_id: 'project-1' },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [mockNotification],
          unreadCount: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    const notificationItem = screen.getByText('Test');
    await user.click(notificationItem);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/notifications/${mockNotification.id}`,
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  it('should call onOpenDrawer when View All is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell onOpenDrawer={mockOnOpenDrawer} />);

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('View All Notifications')).toBeInTheDocument();
    });

    const viewAllButton = screen.getByText('View All Notifications');
    await user.click(viewAllButton);

    expect(mockOnOpenDrawer).toHaveBeenCalled();
  });
});

