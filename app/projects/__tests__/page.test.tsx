import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import ProjectsPage from '../page';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import { renderWithProviders } from '@/lib/test-utils';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
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

jest.mock('@/components/dashboard/SortableTable', () => {
  return function MockSortableTable({ data, columns, onRowClick }: any) {
    return (
      <div data-testid="sortable-table">
        <table>
          <thead>
            <tr>
              {columns.map((col: any) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, idx: number) => (
              <tr key={idx} onClick={() => onRowClick?.(row)}>
                {columns.map((col: any) => (
                  <td key={String(col.key)}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
});

global.fetch = jest.fn();

describe('ProjectsPage', () => {
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

  const mockProjects = [
    {
      id: '1',
      name: 'Project A',
      description: 'Description A',
      status: 'in_progress',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      owner_id: 'user-1',
      template_id: 'template-1',
      primary_tool: 'React',
    },
    {
      id: '2',
      name: 'Project B',
      description: 'Description B',
      status: 'blueprint_ready',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
      owner_id: 'user-1',
      template_id: 'template-2',
      primary_tool: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (useNotification as jest.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });
    (useRole as jest.Mock).mockReturnValue({ role: 'admin', loading: false });

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
        },
      },
    });

    const userQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'user-1', role: 'admin' },
        error: null,
      }),
    };

    const projectsQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null,
      }),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return userQueryBuilder;
      }
      if (table === 'projects') {
        return projectsQueryBuilder;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };
    });
  });

  it('should render projects page with header and create button', async () => {
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      // Find the heading specifically (h1 or h4)
      const heading = screen.getByRole('heading', { name: /Projects/i });
      expect(heading).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument();
    });
  });

  it('should render SortableTable with projects data', async () => {
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sortable-table')).toBeInTheDocument();
      expect(screen.getByText('Project A')).toBeInTheDocument();
      expect(screen.getByText('Project B')).toBeInTheDocument();
    });
  });

  it('should filter projects by search term', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search projects/i);
    await user.type(searchInput, 'Project A');

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
      expect(screen.queryByText('Project B')).not.toBeInTheDocument();
    });
  });

  it('should filter projects by status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    // Find status select - it's a FormControl with Select
    const statusSelects = screen.getAllByRole('combobox');
    const statusSelect = statusSelects.find(select => {
      const label = select.closest('.MuiFormControl-root')?.querySelector('label');
      return label?.textContent?.toLowerCase().includes('status');
    }) || statusSelects[0];
    
    expect(statusSelect).toBeDefined();
    
    if (statusSelect) {
      await user.click(statusSelect);
      
      // Wait for options to appear
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
      
      const inProgressOption = screen.getByRole('option', { name: /in progress/i });
      await user.click(inProgressOption);

      await waitFor(() => {
        expect(screen.getByText('Project A')).toBeInTheDocument();
        expect(screen.queryByText('Project B')).not.toBeInTheDocument();
      });
    }
  });

  it('should navigate to project when row is clicked', async () => {
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sortable-table')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    // Click first data row (skip header row)
    fireEvent.click(rows[1]);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/project/1');
    });
  });

  it('should show delete button for admin users', async () => {
    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      // Delete button should be in the Actions column
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('should not show delete button for non-admin users', async () => {
    (useRole as jest.Mock).mockReturnValue({ role: 'pm', loading: false });

    renderWithProviders(<ProjectsPage />);

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBe(0);
    });
  });
});

