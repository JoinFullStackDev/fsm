import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateUserDialog from '../CreateUserDialog';
import { renderWithProviders } from '@/lib/test-utils';
import { OrganizationProvider } from '@/components/providers/OrganizationProvider';

jest.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

// Mock OrganizationProvider
const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
};

jest.mock('@/components/providers/OrganizationProvider', () => ({
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOrganization: () => ({
    organization: mockOrganization,
    loading: false,
    error: null,
  }),
}));

global.fetch = jest.fn();

describe('CreateUserDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnUserCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'engineer',
        },
        invitationSent: true,
      }),
    });
  });

  it('should render dialog when open', () => {
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    expect(screen.getByText('Create New User')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(
      <CreateUserDialog
        open={false}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
  });

  it('should validate name field', async () => {
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    // Fill email field so we can test name validation
    const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    
    // Wait for state to update
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
    }, { timeout: 1000 });
    
    // Submit form directly - button is disabled when name is empty, so we submit form directly
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      await act(async () => {
        fireEvent.submit(form);
      });
    }

    await waitFor(() => {
      // After submission, handleSubmit runs validation and sets error state
      // Check for error in Alert component (set by handleSubmit line 129)
      const alert = screen.queryByRole('alert');
      const hasAlert = alert && (
        alert.textContent?.toLowerCase().includes('name is required') ||
        alert.textContent?.toLowerCase().includes('fix the errors') ||
        alert.textContent?.toLowerCase().includes('please fix')
      );
      
      // Validation errors also show in helperText reactively
      const nameField = screen.getByLabelText('Name *') as HTMLInputElement;
      const formControl = nameField.closest('.MuiFormControl-root');
      const helperText = formControl?.querySelector('.MuiFormHelperText-root');
      const hasHelperText = helperText && (
        helperText.textContent?.toLowerCase().includes('name is required') ||
        helperText.textContent?.toLowerCase().includes('required')
      );
      
      expect(hasAlert || hasHelperText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should validate email field', async () => {
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
    });
    
    // Submit form directly to trigger validation (button is disabled when email is empty)
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      await act(async () => {
        fireEvent.submit(form);
      });
    }

    await waitFor(() => {
      // After clicking submit, handleSubmit runs validation
      // If email is empty, error should be set
      // Check for error in Alert component
      const alert = screen.queryByRole('alert');
      const hasAlert = alert && (
        alert.textContent?.toLowerCase().includes('email is required') ||
        alert.textContent?.toLowerCase().includes('fix the errors') ||
        alert.textContent?.toLowerCase().includes('please fix')
      );
      
      // Also check helperText - it shows reactively when email is empty
      const emailField = screen.getByLabelText('Email *') as HTMLInputElement;
      const formControl = emailField.closest('.MuiFormControl-root');
      const helperText = formControl?.querySelector('.MuiFormHelperText-root');
      const hasHelperText = helperText && (
        helperText.textContent?.toLowerCase().includes('email is required') ||
        helperText.textContent?.toLowerCase().includes('required')
      );
      
      expect(hasAlert || hasHelperText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should validate email format', async () => {
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    // Use exact label text to ensure we get the right fields
    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Use fireEvent.change for more reliable input setting
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
    });
    
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
    });
    
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
    });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }, { timeout: 3000 });
  });

  it('should display success state with password', async () => {
    // Mock response with invitation sent
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'engineer',
        },
        invitationSent: true,
      }),
    });

    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /create/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Check for the success state - dialog title changes
      const successTexts = screen.queryAllByText(/User Created Successfully/i);
      expect(successTexts.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Check for success content - invitation sent message
    expect(screen.getByText(/User created successfully!/i)).toBeInTheDocument();
    await waitFor(() => {
      // Check for invitation email message
      expect(screen.getByText(/invitation email has been sent/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should handle API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'User already exists' }),
    });

    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Use fireEvent for more reliable input setting
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
    });
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
    });
    
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
    });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Error should appear in Alert component - check for error message (case insensitive)
      const errorText = screen.queryByText(/user already exists/i);
      const errorAlert = screen.queryByRole('alert');
      expect(errorText || errorAlert).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should close dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

