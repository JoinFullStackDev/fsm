'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Button,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  FolderOpen as FolderIcon,
  TrendingUp as TrendingUpIcon,
  Contacts as ContactsIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyWithCounts } from '@/types/ops';
import CompanyActivityTab from '@/components/ops/CompanyActivityTab';
import CompanyProjectsTab from '@/components/ops/CompanyProjectsTab';
import CompanyOpportunitiesTab from '@/components/ops/CompanyOpportunitiesTab';
import CompanyContactsTab from '@/components/ops/CompanyContactsTab';
import CompanyTasksTab from '@/components/ops/CompanyTasksTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`company-tabpanel-${index}`}
      aria-labelledby={`company-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [company, setCompany] = useState<CompanyWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Handle special routes like "new" or "edit"
  useEffect(() => {
    if (companyId === 'new' || companyId === 'edit') {
      router.replace('/ops/companies');
      return;
    }
  }, [companyId, router]);

  const loadCompany = useCallback(async () => {
    // Don't load if it's a special route
    if (companyId === 'new' || companyId === 'edit') {
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/companies/${companyId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load company');
      }

      const data = await response.json();
      setCompany(data);

      // Set initial tab based on whether company has projects
      if (data.projects_count > 0) {
        // Projects tab is at index 1 (after Activity)
        // But we'll start at Activity (index 0) by default
        setActiveTab(0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load company';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId, showError]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleEdit = () => {
    router.push(`/ops/companies/${companyId}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!company) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/ops/companies/${companyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete company');
      }

      showSuccess('Company deleted successfully');
      router.push('/ops/companies');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete company';
      showError(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !company) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Company not found'}
        </Alert>
      </Container>
    );
  }

  // Determine which tabs to show
  const hasProjects = (company.projects_count || 0) > 0;
  const tabs = [
    { label: 'Activity', icon: <HistoryIcon />, index: 0 },
    ...(hasProjects ? [{ label: 'Projects', icon: <FolderIcon />, index: 1 }] : []),
    { label: 'Opportunities', icon: <TrendingUpIcon />, index: hasProjects ? 2 : 1 },
    { label: 'Contacts', icon: <ContactsIcon />, index: hasProjects ? 3 : 2 },
    { label: 'Tasks', icon: <AssignmentIcon />, index: hasProjects ? 4 : 3 },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/companies')}
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
          sx={{
            flex: 1,
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {company.name}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleEdit}
          sx={{
            borderColor: '#00E5FF',
            color: '#00E5FF',
            '&:hover': {
              borderColor: '#00B2CC',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
          sx={{
            borderColor: '#FF1744',
            color: '#FF1744',
            '&:hover': {
              borderColor: '#D50000',
              backgroundColor: 'rgba(255, 23, 68, 0.1)',
            },
          }}
        >
          Delete
        </Button>
      </Box>

      {/* Company Details */}
      {(company.company_size || company.industry || company.revenue_band || company.website || 
        company.address_street || company.account_notes) && (
        <Paper
          sx={{
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: '#00E5FF',
              fontWeight: 600,
              mb: 2,
            }}
          >
            Company Information
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {company.company_size && (
              <Box>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Company Size
                </Typography>
                <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                  {company.company_size}
                </Typography>
              </Box>
            )}
            {company.industry && (
              <Box>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Industry
                </Typography>
                <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                  {company.industry}
                </Typography>
              </Box>
            )}
            {company.revenue_band && (
              <Box>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Revenue Band
                </Typography>
                <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                  {company.revenue_band}
                </Typography>
              </Box>
            )}
            {company.website && (
              <Box>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Website
                </Typography>
                <Link
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: '#00E5FF',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {company.website}
                </Link>
              </Box>
            )}
            {(company.address_street || company.address_city || company.address_state || company.address_zip) && (
              <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Address
                </Typography>
                <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                  {[
                    company.address_street,
                    company.address_city,
                    company.address_state,
                    company.address_zip,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  {company.address_country && `, ${company.address_country}`}
                </Typography>
              </Box>
            )}
            {company.account_notes && (
              <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 0.5 }}>
                  Account Notes
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: '#E0E0E0',
                    whiteSpace: 'pre-wrap',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    p: 2,
                    borderRadius: 1,
                  }}
                >
                  {company.account_notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      <Paper
        sx={{
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#B0B0B0',
                fontWeight: 500,
                textTransform: 'none',
                minHeight: 72,
                '&.Mui-selected': {
                  color: '#00E5FF',
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#00E5FF',
                height: 3,
              },
            }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.index}
                icon={tab.icon}
                iconPosition="start"
                label={tab.label}
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          <TabPanel value={activeTab} index={0}>
            <CompanyActivityTab companyId={companyId} />
          </TabPanel>
          {hasProjects && (
            <TabPanel value={activeTab} index={1}>
              <CompanyProjectsTab companyId={companyId} />
            </TabPanel>
          )}
          <TabPanel value={activeTab} index={hasProjects ? 2 : 1}>
            <CompanyOpportunitiesTab companyId={companyId} />
          </TabPanel>
          <TabPanel value={activeTab} index={hasProjects ? 3 : 2}>
            <CompanyContactsTab companyId={companyId} />
          </TabPanel>
          <TabPanel value={activeTab} index={hasProjects ? 4 : 3}>
            <CompanyTasksTab companyId={companyId} />
          </TabPanel>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
          onClick={() => setDeleteDialogOpen(false)}
        >
          <Paper
            sx={{
              p: 3,
              maxWidth: 400,
              backgroundColor: '#000',
              border: '1px solid rgba(0, 229, 255, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2, color: '#E0E0E0' }}>
              Delete Company
            </Typography>
            <Typography sx={{ mb: 3, color: '#B0B0B0' }}>
              Are you sure you want to delete &quot;{company.name}&quot;? This will also delete all associated contacts, opportunities, projects, and tasks. This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                sx={{ color: '#B0B0B0' }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                color="error"
                variant="contained"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Container>
  );
}

