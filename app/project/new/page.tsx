'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * Backward compatibility redirect page for /project/new
 * Redirects to /projects page with query parameters to open the modal
 */
export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();

  useEffect(() => {
    // Build query parameters for redirect
    const params = new URLSearchParams();
    params.set('create', 'true');
    
    const companyId = searchParams.get('company_id');
    const templateId = searchParams.get('template_id');
    
    if (companyId) {
      params.set('company_id', companyId);
    }
    if (templateId) {
      params.set('template_id', templateId);
    }

    // Redirect to projects page with modal open
    router.replace(`/projects?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <CircularProgress sx={{ mb: 2 }} />
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
        Redirecting...
      </Typography>
    </Box>
  );
}

