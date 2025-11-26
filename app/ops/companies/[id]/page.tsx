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
  Chip,
  Grid,
  Divider,
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
  Info as InfoIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
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
  const theme = useTheme();
  const companyId = params.id as string;
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
  const tabs = [
    { label: 'Overview', icon: <InfoIcon />, index: 0 },
    { label: 'Company Details', icon: <BusinessIcon />, index: 1 },
    { label: 'Activity', icon: <HistoryIcon />, index: 2 },
    { label: 'Projects', icon: <FolderIcon />, index: 3 },
    { label: 'Opportunities', icon: <TrendingUpIcon />, index: 4 },
    { label: 'Contacts', icon: <ContactsIcon />, index: 5 },
    { label: 'Tasks', icon: <AssignmentIcon />, index: 6 },
    { label: 'Notes', icon: <NotesIcon />, index: 7 },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/companies')}
          sx={{
            color: theme.palette.text.primary,
            border: '1px solid',
            borderColor: theme.palette.divider,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          sx={{
            flex: 1,
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          {company.name}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleEdit}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
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
            borderColor: theme.palette.error.main,
            color: theme.palette.error.main,
            '&:hover': {
              borderColor: theme.palette.error.dark,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Delete
        </Button>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Status
            </Typography>
            <Chip
              label={company.status.charAt(0).toUpperCase() + company.status.slice(1)}
              size="small"
              color={company.status === 'active' ? 'success' : 'default'}
            />
          </Paper>
        </Grid>
        {company.company_size && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Company Size
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                {company.company_size}
              </Typography>
            </Paper>
          </Grid>
        )}
        {company.industry && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Industry
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                {company.industry}
              </Typography>
            </Paper>
          </Grid>
        )}
        {company.revenue_band && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Revenue Band
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                {company.revenue_band}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                color: theme.palette.text.primary,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.text.primary,
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

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                Company Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Company Name
                  </Typography>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                    {company.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Status
                  </Typography>
                  <Chip
                    label={company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                    size="small"
                    color={company.status === 'active' ? 'success' : 'default'}
                  />
                </Grid>
                {company.company_size && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                      Company Size
                    </Typography>
                    <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                      {company.company_size}
                    </Typography>
                  </Grid>
                )}
                {company.industry && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                      Industry
                    </Typography>
                    <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                      {company.industry}
                    </Typography>
                  </Grid>
                )}
                {company.revenue_band && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                      Revenue Band
                    </Typography>
                    <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                      {company.revenue_band}
                    </Typography>
                  </Grid>
                )}
                {company.website && (
                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                      Website
                    </Typography>
                    <Typography
                      variant="body1"
                      component="a"
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: theme.palette.text.primary,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {company.website}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                Connections
              </Typography>
              <Grid container spacing={2}>
                {company.contacts_count !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Box>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Contacts
                      </Typography>
                      <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                        {company.contacts_count || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {company.opportunities_count !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Box>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Opportunities
                      </Typography>
                      <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                        {company.opportunities_count || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {company.projects_count !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Box>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Projects
                      </Typography>
                      <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                        {company.projects_count || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Paper
          sx={{
            p: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              mb: 3,
            }}
          >
            Company Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                  Company Name
                </Typography>
                <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                  {company.name}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                  Status
                </Typography>
                <Chip
                  label={company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                  size="small"
                  color={company.status === 'active' ? 'success' : 'default'}
                />
              </Box>
            </Grid>
            {company.company_size && (
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Company Size
                  </Typography>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                    {company.company_size}
                  </Typography>
                </Box>
              </Grid>
            )}
            {company.industry && (
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Industry
                  </Typography>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                    {company.industry}
                  </Typography>
                </Box>
              </Grid>
            )}
            {company.revenue_band && (
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Revenue Band
                  </Typography>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                    {company.revenue_band}
                  </Typography>
                </Box>
              </Grid>
            )}
            {company.website && (
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Website
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LanguageIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                    <Typography
                      variant="body1"
                      component="a"
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: theme.palette.text.primary,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {company.website}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}
            {(company.address_street || company.address_city || company.address_state || company.address_zip) && (
              <Grid item xs={12}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                    Address
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <LocationIcon sx={{ fontSize: 16, color: theme.palette.text.secondary, mt: 0.5 }} />
                    <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
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
                </Box>
              </Grid>
            )}
            {(company.contacts_count !== undefined || company.opportunities_count !== undefined || company.projects_count !== undefined) && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography
                  variant="h6"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    mb: 2,
                  }}
                >
                  Connections
                </Typography>
                <Grid container spacing={2}>
                  {company.contacts_count !== undefined && (
                    <Grid item xs={12} sm={4}>
                      <Box>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                          Contacts
                        </Typography>
                        <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                          {company.contacts_count || 0}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {company.opportunities_count !== undefined && (
                    <Grid item xs={12} sm={4}>
                      <Box>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                          Opportunities
                        </Typography>
                        <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                          {company.opportunities_count || 0}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {company.projects_count !== undefined && (
                    <Grid item xs={12} sm={4}>
                      <Box>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                          Projects
                        </Typography>
                        <Typography variant="h5" sx={{ color: theme.palette.text.primary }}>
                          {company.projects_count || 0}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            )}
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <CompanyActivityTab companyId={companyId} />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <CompanyProjectsTab companyId={companyId} />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <CompanyOpportunitiesTab companyId={companyId} />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <CompanyContactsTab companyId={companyId} />
      </TabPanel>

      <TabPanel value={activeTab} index={6}>
        <CompanyTasksTab companyId={companyId} />
      </TabPanel>

      <TabPanel value={activeTab} index={7}>
        <Paper
          sx={{
            p: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              mb: 3,
            }}
          >
            Notes
          </Typography>
          {company.notes && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <NotesIcon sx={{ fontSize: 16 }} />
                General Notes
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.default,
                  border: `1px solid ${theme.palette.divider}`,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                  {company.notes}
                </Typography>
              </Paper>
            </Box>
          )}
          {company.account_notes && (
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <WorkIcon sx={{ fontSize: 16 }} />
                Account Notes
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.default,
                  border: `1px solid ${theme.palette.divider}`,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                  {company.account_notes}
                </Typography>
              </Paper>
            </Box>
          )}
          {!company.notes && !company.account_notes && (
            <Alert severity="info">No notes available for this company</Alert>
          )}
        </Paper>
      </TabPanel>

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
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.error.main, fontWeight: 600 }}>
              Delete Company
            </Typography>
            <Typography sx={{ mb: 3, color: theme.palette.text.secondary }}>
              Are you sure you want to delete &quot;{company.name}&quot;? This will also delete all associated contacts, opportunities, projects, and tasks. This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                sx={{ color: theme.palette.text.secondary }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                variant="contained"
                disabled={deleting}
                sx={{
                  backgroundColor: theme.palette.error.main,
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: theme.palette.error.dark,
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(255, 23, 68, 0.3)',
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
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
