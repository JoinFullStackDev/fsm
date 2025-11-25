'use client';

import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'dashboard' | 'project' | 'phase' | 'table' | 'card';
  count?: number;
}

export default function LoadingSkeleton({ variant = 'card', count = 3 }: LoadingSkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: count }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                <Skeleton variant="text" width="100%" height={20} sx={{ mb: 1 }} />
                <Skeleton variant="text" width="80%" height={20} />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                  <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'table') {
    return (
      <Box>
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 2, borderRadius: 1 }} />
        {Array.from({ length: count }).map((_, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Skeleton variant="rectangular" width="100%" height={72} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'card') {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: count }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Skeleton variant="text" width="70%" height={28} />
                <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant="rectangular" width="100%" height={60} sx={{ mb: 2, borderRadius: 1 }} />
      ))}
    </Box>
  );
}

