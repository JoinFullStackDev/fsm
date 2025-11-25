'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import ContactForm from '@/components/ops/ContactForm';

export default function NewCompanyContactPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load company name for display
    const loadCompany = async () => {
      try {
        const response = await fetch(`/api/ops/companies/${companyId}`);
        if (response.ok) {
          const data = await response.json();
          setCompanyName(data.name);
        }
      } catch (err) {
        // Ignore errors, just show form
      } finally {
        setLoadingCompany(false);
      }
    };
    loadCompany();
  }, [companyId]);

  const handleSubmit = async (formData: any) => {
    setError(null);
    setValidationErrors({});

    // Client-side validation
    if (!formData.first_name || formData.first_name.trim().length === 0) {
      setValidationErrors({ first_name: 'First name is required' });
      return;
    }
    if (!formData.last_name || formData.last_name.trim().length === 0) {
      setValidationErrors({ last_name: 'Last name is required' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ops/companies/${companyId}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }

      const contact = await response.json();
      showSuccess('Contact created successfully');
      router.push(`/ops/companies/${companyId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create contact';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCompany) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push(`/ops/companies/${companyId}`)}
          sx={{
            color: '#00E5FF',
            border: '1px solid',
            borderColor: '#00E5FF',
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Add Contact{companyName ? ` to ${companyName}` : ''}
        </Typography>
      </Box>

      <Card
        sx={{
          backgroundColor: '#000',
          border: '2px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
        }}
      >
        <CardContent>
          <ContactForm
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/ops/companies/${companyId}`)}
            loading={loading}
            error={error}
            validationErrors={validationErrors}
          />
        </CardContent>
      </Card>
    </Container>
  );
}

