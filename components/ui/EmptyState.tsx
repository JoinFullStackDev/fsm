'use client';

import { Box, Typography, Button, Card, CardContent } from '@mui/material';
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
  if (variant === 'minimal') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        {icon && (
          <Box sx={{ mb: 2, color: '#B0B0B0' }}>
            {icon}
          </Box>
        )}
        <Typography variant="h6" sx={{ color: '#E0E0E0', mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 2 }}>
          {description}
        </Typography>
        {actionLabel && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
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
            {actionLabel}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Card
      sx={{
        backgroundColor: '#000',
        border: '2px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 3,
        textAlign: 'center',
      }}
    >
      <CardContent sx={{ py: 6, px: 4 }}>
        {icon && (
          <Box
            sx={{
              mb: 3,
              color: '#00E5FF',
              display: 'flex',
              justifyContent: 'center',
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
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 2,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: '#B0B0B0',
            mb: 3,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {description}
        </Typography>
        {actionLabel && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#00B2CC',
                boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

