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
    const user = userEvent.setup();
    renderWithProviders(
      <CreateUserDialog
        open={true}
        onClose={mockOnClose}
        onUserCreated={mockOnUserCreated}
      />
    );

    // Leave both fields empty to test name validation
    // Submit the form directly using fireEvent.submit (button is disabled when fields are empty)
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      // Validation error appears in Alert component when form is submitted with invalid data
      // The error state is set in handleSubmit when validation fails (line 129)
      // Since name is checked first in the validation, "Name is required" should appear
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
    }, { timeout: 5000 });
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
    await user.type(nameInput, 'Test User');
    
    // Find the form element - Material-UI Box with component="form" renders as form
    const form = screen.getByRole('dialog').querySelector('form') || 
                 document.querySelector('form');
    
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      // Validation error can appear in Alert or TextField helperText
      const emailField = screen.getByLabelText(/email/i);
      const formControl = emailField.closest('.MuiFormControl-root');
      if (formControl) {
        expect(formControl).toHaveTextContent(/Email is required/i);
      } else {
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      }
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

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    
    // Wait a bit for state to update
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
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

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/user already exists/i)).toBeInTheDocument();
    });
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

