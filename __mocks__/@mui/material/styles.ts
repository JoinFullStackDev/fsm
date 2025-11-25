// Mock for Material-UI styles to avoid Emotion cache issues in tests
import React from 'react';

const actual = jest.requireActual('@mui/material/styles');

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Simplified ThemeProvider that just passes through children
  // This avoids Emotion cache issues in jsdom test environment
  return React.createElement(React.Fragment, null, children);
};

// Re-export everything else
export * from '@mui/material/styles';

