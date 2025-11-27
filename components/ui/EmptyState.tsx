'use client';

import { Box, Typography, Button, Paper, useTheme } from '@mui/material';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'minimal';
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const theme = useTheme();

  if (variant === 'minimal') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        {icon && (
          <Box sx={{ mb: 2, color: theme.palette.text.secondary, display: 'flex', justifyContent: 'center' }}>
            {icon}
          </Box>
        )}
        <Typography 
          variant="h6" 
          sx={{ 
            color: theme.palette.text.primary, 
            mb: 1, 
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
          }}
        >
          {title}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: theme.palette.text.secondary, 
            mb: 2,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          {description}
        </Typography>
        {actionLabel && onAction && (
          <Button
            variant="outlined"
            onClick={onAction}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        textAlign: 'center',
        p: 6,
        maxWidth: 600,
        mx: 'auto',
      }}
    >
      {icon && (
        <Box
          sx={{
            mb: 3,
            color: theme.palette.text.secondary,
            display: 'flex',
            justifyContent: 'center',
            opacity: 0.7,
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 2,
          fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.text.secondary,
          mb: 4,
          maxWidth: 500,
          mx: 'auto',
          lineHeight: 1.6,
        }}
      >
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="outlined"
          onClick={onAction}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}

