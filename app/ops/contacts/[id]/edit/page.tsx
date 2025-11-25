'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { CompanyContact } from '@/types/ops';

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [contactData, setContactData] = useState<CompanyContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const loadContact = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const response = await fetch(`/api/ops/contacts/${contactId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load contact');
      }

      const contact = await response.json();
      setContactData(contact);
      setCompanyId(contact.company_id);
      setCompanyName(contact.company?.name || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contact';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  }, [contactId, showError]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

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
      const response = await fetch(`/api/ops/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contact');
      }

      const contact = await response.json();
      showSuccess('Contact updated successfully');
      if (companyId) {
        router.push(`/ops/companies/${companyId}`);
      } else {
        router.push('/ops/contacts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update contact';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
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
          onClick={() => companyId ? router.push(`/ops/companies/${companyId}`) : router.push('/ops/contacts')}
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
          Edit Contact{companyName ? ` - ${companyName}` : ''}
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
          {contactData && (
            <ContactForm
              initialData={contactData}
              onSubmit={handleSubmit}
              onCancel={() => companyId ? router.push(`/ops/companies/${companyId}`) : router.push('/ops/contacts')}
              loading={loading}
              error={error}
              validationErrors={validationErrors}
            />
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
