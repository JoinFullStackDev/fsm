'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Container, Typography, Button, Card, CardContent } from '@mui/material';
import { ErrorOutline as ErrorIcon, Home as HomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import Navbar from '@/components/layout/Navbar';
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
        <>
          <Navbar />
          <Box sx={{ backgroundColor: '#0A0E27', minHeight: '100vh', pb: 4 }}>
            <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
              <Card
                sx={{
                  backgroundColor: '#121633',
                  border: '1px solid rgba(255, 23, 68, 0.3)',
                  borderRadius: 3,
                  maxWidth: 600,
                  mx: 'auto',
                  mt: 4,
                }}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <ErrorIcon
                    sx={{
                      fontSize: 64,
                      color: '#FF1744',
                      mb: 2,
                    }}
                  />
                  <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                    sx={{
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #FF1744 0%, #E91E63 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2,
                    }}
                  >
                    Something went wrong
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: '#B0B0B0',
                      mb: 3,
                    }}
                  >
                    We encountered an unexpected error. Don&apos;t worry, your data is safe.
                  </Typography>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <Box
                      sx={{
                        backgroundColor: '#1A1F3A',
                        border: '1px solid rgba(255, 23, 68, 0.2)',
                        borderRadius: 2,
                        p: 2,
                        mb: 3,
                        textAlign: 'left',
                      }}
                    >
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          color: '#FF1744',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {this.state.error.toString()}
                        {this.state.error.stack && `\n\n${this.state.error.stack}`}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={this.handleReset}
                      sx={{
                        backgroundColor: '#00E5FF',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: '#00B2CC',
                          boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
                        },
                      }}
                    >
                      Try Again
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<HomeIcon />}
                      onClick={this.handleGoHome}
                      sx={{
                        borderColor: '#00E5FF',
                        color: '#00E5FF',
                        '&:hover': {
                          borderColor: '#00E5FF',
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
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
        </>
      );
    }

    return this.props.children;
  }
}

