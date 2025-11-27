'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Container, Typography, Button, Card, CardContent, useTheme } from '@mui/material';
import { ErrorOutline as ErrorIcon, Home as HomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import logger from '@/lib/utils/logger';

/**
 * Props for ErrorBoundary component
 */
interface Props {
  /** Child components to wrap */
  children: ReactNode;
  /** Custom fallback UI to display when an error occurs */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Internal state for ErrorBoundary
 */
interface State {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors in child components
 * 
 * Displays a user-friendly error message and provides options to reset or navigate home.
 * Logs errors using the centralized logger utility.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<CustomErrorUI />}
 *   onError={(error, info) => {
 *     // Send to error tracking service
 *     trackError(error, info);
 *   }}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
// ErrorDisplay component that uses hooks (must be separate from class component)
function ErrorDisplay({ error, onReset, onGoHome }: { error: Error | null; onReset: () => void; onGoHome: () => void }) {
  const theme = useTheme();

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
        <Card
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            maxWidth: 600,
            mx: 'auto',
            mt: 4,
          }}
        >
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <ErrorIcon
              sx={{
                fontSize: 64,
                color: theme.palette.error.main,
                mb: 2,
              }}
            />
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                color: theme.palette.text.primary,
                mb: 2,
              }}
            >
              Something went wrong
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme.palette.text.secondary,
                mb: 3,
              }}
            >
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </Typography>
            {process.env.NODE_ENV === 'development' && error && (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.default,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 2,
                  mb: 3,
                  textAlign: 'left',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    color: theme.palette.error.main,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                  }}
                >
                  {error.toString()}
                  {error.stack && `\n\n${error.stack}`}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={onReset}
                sx={{
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.default,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    boxShadow: `0 6px 25px rgba(255, 255, 255, 0.2)`,
                  },
                }}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={onGoHome}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Go Home
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using logger
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          error={this.state.error}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

