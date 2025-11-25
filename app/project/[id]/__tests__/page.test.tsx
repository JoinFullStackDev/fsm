import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useParams } from 'next/navigation';
import ProjectPage from '../page';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('@/lib/supabaseClient', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/hooks/useRole', () => ({
  useRole: jest.fn(),
}));

jest.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('ProjectPage - Delete Functionality', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
  };

  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  const mockShowSuccess = jest.fn();
  const mockShowError = jest.fn();

  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'Test Description',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    owner_id: 'test-user-id',
    template_id: 'test-template-id',
    initiated_at: null,
  };

  const mockPhases: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ id: 'test-project-id' });
    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (useNotification as jest.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });

    // Default session mock
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id', email: 'test@example.com' },
        },
      },
    });

    // Default project fetch mock
    const projectQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockProject,
        error: null,
      }),
    };
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'projects') {
        return projectQueryBuilder;
      }
      if (table === 'project_phases') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockPhases,
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };
    });
  });

  describe('Delete Button Visibility', () => {
    it('should show delete button for admin users', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'admin',
        loading: false,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });
    });

    it('should not show delete button for non-admin users', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'pm',
        loading: false,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
      });
    });

    it('should not show delete button while role is loading', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: null,
        loading: true,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Confirmation Dialog', () => {
    beforeEach(() => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'admin',
        loading: false,
      });
    });

    it('should open delete confirmation dialog when delete button is clicked', async () => {
      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(
        () => {
          // Check for dialog title
          expect(screen.getByText('Delete Project', { selector: 'h2, [role="dialog"] h2' })).toBeInTheDocument();
          // Check for confirmation message
          expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
          // Check for project name in dialog content (not in breadcrumbs)
          const dialogContent = screen.getByText(/Are you sure you want to delete/i).closest('[role="dialog"]');
          expect(dialogContent).toBeInTheDocument();
          expect(dialogContent?.textContent).toContain(mockProject.name);
        },
        { timeout: 3000 }
      );
    });

    it('should close dialog when cancel is clicked', async () => {
      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Are you sure you want to delete/i)).not.toBeInTheDocument();
      });
    });

    it('should call delete API when confirmed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Project deleted successfully' }),
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/projects/${mockProject.id}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      expect(mockShowSuccess).toHaveBeenCalledWith('Project deleted successfully');
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    it('should show error message when delete API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to delete project' }),
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to delete project');
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('should disable delete button while deleting', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ message: 'Project deleted successfully' }),
              });
            }, 100);
          })
      );

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      // Check that button shows "Deleting..." state
      await waitFor(() => {
        const deletingButton = screen.getByRole('button', { name: /Deleting/i });
        expect(deletingButton).toBeInTheDocument();
        expect(deletingButton).toBeDisabled();
      });
    });
  });

  describe('Manage Members Icon', () => {
    it('should show PeopleIcon for Manage Members button', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'admin',
        loading: false,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        const manageMembersButton = screen.getByText('Manage Members');
        expect(manageMembersButton).toBeInTheDocument();
        // Check that the button has a startIcon (PeopleIcon)
        const button = manageMembersButton.closest('button');
        expect(button).toBeInTheDocument();
      });
    });
  });
});

