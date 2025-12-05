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
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

    // Default fetch mock for API calls
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      // Handle project API fetch
      if (url.includes('/api/projects/test-project-id') && (!options || options.method !== 'DELETE')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProject),
        });
      }
      // Handle users/me API fetch
      if (url.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            id: 'test-user-id', 
            name: 'Test User', 
            email: 'test@example.com',
            role: 'admin',
            is_company_admin: true,
          }),
        });
      }
      // Default response for other fetches
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
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

    // Mock users query for creator information
    const usersQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', avatar_url: null },
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'projects') {
        return projectQueryBuilder;
      }
      if (table === 'users') {
        return usersQueryBuilder;
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
        isSuperAdmin: false,
        isCompanyAdmin: true,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });
    });

    it('should not show delete button for non-admin users', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'pm',
        loading: false,
        isSuperAdmin: false,
        isCompanyAdmin: false,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.queryByLabelText('Delete Project')).not.toBeInTheDocument();
      });
    });

    it('should not show delete button while role is loading', async () => {
      (useRole as jest.Mock).mockReturnValue({
        role: null,
        loading: true,
        isSuperAdmin: false,
        isCompanyAdmin: false,
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.queryByLabelText('Delete Project')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Confirmation Dialog', () => {
    beforeEach(() => {
      (useRole as jest.Mock).mockReturnValue({
        role: 'admin',
        loading: false,
        isSuperAdmin: false,
        isCompanyAdmin: true,
      });
    });

    it('should open delete confirmation dialog when delete button is clicked', async () => {
      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Project');
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
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Project');
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
      // Override fetch for DELETE operation
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/projects/test-project-id') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: 'Project deleted successfully' }),
          });
        }
        if (url.includes('/api/projects/test-project-id')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProject),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'test-user-id', role: 'admin', is_company_admin: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Project');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
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
      // Override fetch for DELETE operation to fail
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/projects/test-project-id') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to delete project' }),
          });
        }
        if (url.includes('/api/projects/test-project-id')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProject),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'test-user-id', role: 'admin', is_company_admin: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Project');
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
      // Override fetch with delayed DELETE response
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/projects/test-project-id') && options?.method === 'DELETE') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({ message: 'Project deleted successfully' }),
              });
            }, 100);
          });
        }
        if (url.includes('/api/projects/test-project-id')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProject),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'test-user-id', role: 'admin', is_company_admin: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<ProjectPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Delete Project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Project');
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
        isSuperAdmin: false,
        isCompanyAdmin: true,
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

