import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import GenerateTemplatePage from '../page';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/hooks/useRole', () => ({
  useRole: jest.fn(),
}));

jest.mock('@/components/providers/NotificationProvider', () => ({
  useNotification: jest.fn(),
}));

jest.mock('@/components/providers/OrganizationProvider', () => ({
  useOrganization: jest.fn(),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/supabaseClient', () => ({
  createSupabaseClient: jest.fn(),
}));

// Mock navigator.clipboard - use the global mock from jest.setup.js
const mockWriteText = navigator.clipboard.writeText as jest.Mock;

global.fetch = jest.fn();

describe('GenerateTemplatePage', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockShowSuccess = jest.fn();
  const mockShowError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
    
    // Reset clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
    
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useRole as jest.Mock).mockReturnValue({ role: 'admin', loading: false });
    (useNotification as jest.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });
    (useOrganization as jest.Mock).mockReturnValue({
      features: {
        ai_features_enabled: true, // Enable AI features for tests
      },
      loading: false,
      organization: null,
      subscription: null,
      package: null,
      error: null,
      refresh: jest.fn(),
    });
  });

  it('should render the AI template generator form', () => {
    render(<GenerateTemplatePage />);

    expect(screen.getByText(/AI Template Generator/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Template with AI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Template Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Description & Requirements/i)).toBeInTheDocument();
  });

  it('should show copy prompt button with tooltip', async () => {
    const user = userEvent.setup();
    render(<GenerateTemplatePage />);

    // Find the copy button (IconButton with ContentCopy icon)
    // The button is next to "Description & Requirements" text
    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find(btn => {
      const icon = btn.querySelector('[data-testid="ContentCopyIcon"]');
      return icon !== null;
    });
    
    expect(copyButton).toBeInTheDocument();

    // Hover to see tooltip
    if (copyButton) {
      await user.hover(copyButton);
      
      // Tooltip should be visible
      await waitFor(() => {
        expect(screen.getByText(/Copy prompt to use with your preferred AI tool/i)).toBeInTheDocument();
      });
    }
  });

  it('should copy prompt to clipboard when copy button is clicked', async () => {
    render(<GenerateTemplatePage />);

    // Find the copy button by its icon
    const copyIcon = screen.queryByTestId('ContentCopyIcon');
    expect(copyIcon).toBeInTheDocument();
    
    if (copyIcon) {
      const copyButton = copyIcon.closest('button');
      expect(copyButton).toBeInTheDocument();
      
      if (copyButton) {
        // Click the button
        fireEvent.click(copyButton);

        // Wait for async clipboard operation
        await waitFor(() => {
          expect(mockWriteText).toHaveBeenCalled();
        }, { timeout: 2000 });
        
        // Check success notification
        await waitFor(() => {
          expect(mockShowSuccess).toHaveBeenCalledWith(
            expect.stringContaining('Prompt copied to clipboard')
          );
        }, { timeout: 2000 });
      }
    }
  });

  it('should show error notification if clipboard write fails', async () => {
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard error'));

    render(<GenerateTemplatePage />);

    const copyIcon = screen.queryByTestId('ContentCopyIcon');
    expect(copyIcon).toBeInTheDocument();
    
    if (copyIcon) {
      const copyButton = copyIcon.closest('button');
      expect(copyButton).toBeInTheDocument();
      
      if (copyButton) {
        fireEvent.click(copyButton);

        // Wait for async clipboard operation to fail
        await waitFor(() => {
          expect(mockWriteText).toHaveBeenCalled();
        }, { timeout: 2000 });
        
        // Check error notification
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalledWith('Failed to copy prompt to clipboard');
        }, { timeout: 2000 });
      }
    }
  });

  it('should disable generate button when form is invalid', () => {
    render(<GenerateTemplatePage />);

    const generateButton = screen.getByRole('button', { name: /generate template/i });
    expect(generateButton).toBeDisabled();
  });

  it('should enable generate button when form is valid', async () => {
    const user = userEvent.setup();
    render(<GenerateTemplatePage />);

    const nameInput = screen.getByLabelText(/Template Name/i);
    // Description field doesn't have a label, find by placeholder or role
    const descriptionInput = screen.getByPlaceholderText(/Describe the type of project/i) || 
                            screen.getByRole('textbox', { name: /description/i });

    await user.type(nameInput, 'Test Template');
    await user.type(descriptionInput, 'Test description');

    const generateButton = screen.getByRole('button', { name: /generate template/i });
    expect(generateButton).not.toBeDisabled();
  });

  it('should call API when generate button is clicked', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          template: { name: 'Test Template', description: 'Test' },
          phases: [],
          field_configs: [],
        },
      }),
    });

    render(<GenerateTemplatePage />);

    const nameInput = screen.getByLabelText(/Template Name/i);
    const descriptionInput = screen.getByPlaceholderText(/Describe the type of project/i) || 
                            screen.getByRole('textbox', { name: /description/i });
    const generateButton = screen.getByRole('button', { name: /generate template/i });

    await user.type(nameInput, 'Test Template');
    await user.type(descriptionInput, 'Test description');
    await user.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/templates/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });
});

