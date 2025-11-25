import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateUserDialog from '../CreateUserDialog';
import { renderWithProviders } from '@/lib/test-utils';

jest.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
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
        temporaryPassword: 'temp123',
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
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    // Wait for state to update
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
    }, { timeout: 1000 });
    
    // Submit form directly - button is disabled when name is empty, so we submit form directly
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      fireEvent.submit(form);
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
      const nameField = screen.getByLabelText(/name/i);
      const nameInput = nameField as HTMLInputElement;
      const formControl = nameInput.closest('.MuiFormControl-root');
      const helperText = formControl?.querySelector('.MuiFormHelperText-root');
      const hasHelperText = helperText && (
        helperText.textContent?.toLowerCase().includes('name is required') ||
        helperText.textContent?.toLowerCase().includes('required')
      );
      
      expect(hasAlert || hasHelperText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should validate email field', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Test User');
    
    // Submit form directly to trigger validation (button is disabled when email is empty)
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      fireEvent.submit(form);
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
      const emailField = screen.getByLabelText(/email/i);
      const emailInput = emailField as HTMLInputElement;
      const formControl = emailInput.closest('.MuiFormControl-root');
      const helperText = formControl?.querySelector('.MuiFormHelperText-root');
      const hasHelperText = helperText && (
        helperText.textContent?.toLowerCase().includes('email is required') ||
        helperText.textContent?.toLowerCase().includes('required')
      );
      
      expect(hasAlert || hasHelperText).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'invalid-email');

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Clear inputs first to avoid concatenation issues
    await user.clear(nameInput);
    await user.clear(emailInput);
    
    // Type values separately with a small delay
    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    
    // Wait for state to update and verify values
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
    });
    
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
    });
    
    await user.click(submitButton);

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
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /create/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      // Check for the success state - dialog title changes
      expect(screen.getByText(/User Created Successfully/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check for success content
    expect(screen.getByText(/User has been created successfully/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Temporary Password/i).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('temp123')).toBeInTheDocument();
  });

  it('should handle API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'User already exists' }),
    });

    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Clear inputs first
    await user.clear(nameInput);
    await user.clear(emailInput);
    
    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    
    // Wait for values to be set
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
      expect(emailInput).toHaveValue('test@example.com');
    });
    
    await user.click(submitButton);

    await waitFor(() => {
      // Error should appear in Alert component
      expect(screen.getByText(/user already exists/i)).toBeInTheDocument();
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

