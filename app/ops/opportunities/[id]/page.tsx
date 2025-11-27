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
  IconButton,
  Button,
  Chip,
  Grid,
  Tabs,
  Tab,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Contacts as ContactsIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  Notes as NotesIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { OpportunityWithCompany, CompanyWithCounts } from '@/types/ops';
import type { ProjectTemplate, User } from '@/types/project';
import CompanyContactsTab from '@/components/ops/CompanyContactsTab';
import CompanyTasksTab from '@/components/ops/CompanyTasksTab';
import CompanyActivityTab from '@/components/ops/CompanyActivityTab';

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
      id={`opportunity-tabpanel-${index}`}
      aria-labelledby={`opportunity-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OpportunityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const opportunityId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [opportunity, setOpportunity] = useState<OpportunityWithCompany | null>(null);
  const [company, setCompany] = useState<CompanyWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const supabase = createSupabaseClient();

  const loadCompany = useCallback(async (companyId: string) => {
    try {
      setCompanyLoading(true);
      const response = await fetch(`/api/ops/companies/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setCompany(data);
      }
    } catch (err) {
      // Silently fail - company details are optional
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  const loadOpportunity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/opportunities/${opportunityId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunity');
      }

      const data = await response.json();
      setOpportunity(data);
      
      // Load full company details if company exists
      if (data.company?.id) {
        loadCompany(data.company.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunity';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [opportunityId, showError, loadCompany]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      // Use the organization-scoped templates API endpoint
      const response = await fetch('/api/admin/templates');
      if (response.ok) {
        const result = await response.json();
        // Ensure we always set an array, even if result.data is not an array
        setTemplates(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err) {
      // Silently fail
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      // Use the organization-scoped admin users API endpoint
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const result = await response.json();
        // The API returns { users: [...] }, so extract users array
        setUsers(Array.isArray(result.users) ? result.users : []);
      }
    } catch (err) {
      // Silently fail
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (convertDialogOpen) {
      loadTemplates();
      loadUsers();
    }
  }, [convertDialogOpen, loadTemplates, loadUsers]);

  const handleEdit = () => {
    router.push(`/ops/opportunities/${opportunityId}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!opportunity) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/ops/opportunities/${opportunityId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete opportunity');
      }

      showSuccess('Opportunity deleted successfully');
      router.push('/ops/opportunities');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete opportunity';
      showError(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleConvert = () => {
    setSelectedTemplate('');
    setSelectedMembers([]);
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (!opportunity) return;

    try {
      setConverting(true);
      const response = await fetch(`/api/ops/opportunities/${opportunityId}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplate || null,
          member_ids: selectedMembers || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert opportunity');
      }

      const project = await response.json();
      showSuccess('Opportunity converted to project successfully');
      setConvertDialogOpen(false);
      router.push(`/project/${project.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert opportunity';
      showError(errorMessage);
    } finally {
      setConverting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'default';
      case 'qualified':
        return 'info';
      case 'proposal':
        return 'warning';
      case 'negotiation':
        return 'primary';
      case 'won':
        return 'success';
      case 'lost':
        return 'error';
      case 'archived':
        return 'default';
      default:
        return 'default';
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

  if (error || !opportunity) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Opportunity not found'}
        </Alert>
      </Container>
    );
  }

  const companyId = opportunity.company?.id;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/opportunities')}
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
          {opportunity.name}
        </Typography>
        {opportunity.status !== 'lost' && opportunity.status !== 'converted' && (
          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleConvert}
            disabled={converting}
            sx={{
              backgroundColor: '#4CAF50',
              color: '#FFF',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#45A049',
              },
            }}
          >
            {converting ? 'Converting...' : 'Convert to Project'}
          </Button>
        )}
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

      {/* Opportunity Overview Cards */}
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
              label={opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
              color={getStatusColor(opportunity.status) as any}
              size="small"
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Source
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {opportunity.source || 'Manual'}
            </Typography>
          </Paper>
        </Grid>
        {opportunity.value && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Value
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: '#4CAF50',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <AttachMoneyIcon fontSize="small" />
                {opportunity.value.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
        )}
        {opportunity.company && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.text.secondary,
                },
              }}
              onClick={() => router.push(`/ops/companies/${opportunity.company!.id}`)}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Company
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />
                <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                  {opportunity.company.name}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Tabs */}
      {companyId && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider, mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
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
              <Tab icon={<InfoIcon />} iconPosition="start" label="Overview" />
              <Tab icon={<BusinessIcon />} iconPosition="start" label="Company Details" />
              <Tab icon={<ContactsIcon />} iconPosition="start" label="Contacts" />
              <Tab icon={<AssignmentIcon />} iconPosition="start" label="Tasks" />
              <Tab icon={<HistoryIcon />} iconPosition="start" label="Activity" />
              <Tab icon={<NotesIcon />} iconPosition="start" label="Notes" />
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
                    Opportunity Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Status
                      </Typography>
                      <Chip
                        label={opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
                        color={getStatusColor(opportunity.status) as any}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Source
                      </Typography>
                      <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                        {opportunity.source || 'Manual'}
                      </Typography>
                    </Grid>
                    {opportunity.value && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                          Value
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            color: '#4CAF50',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <AttachMoneyIcon fontSize="small" />
                          {opportunity.value.toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Created
                      </Typography>
                      <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                        {new Date(opportunity.created_at).toLocaleDateString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        Updated
                      </Typography>
                      <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                        {new Date(opportunity.updated_at).toLocaleDateString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              {company && (
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                          Company Name
                        </Typography>
                        <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                          {company.name}
                        </Typography>
                      </Box>
                      {company.company_size && (
                        <Box>
                          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                            Company Size
                          </Typography>
                          <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                            {company.company_size}
                          </Typography>
                        </Box>
                      )}
                      {company.industry && (
                        <Box>
                          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                            Industry
                          </Typography>
                          <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                            {company.industry}
                          </Typography>
                        </Box>
                      )}
                      {company.website && (
                        <Box>
                          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                            Website
                          </Typography>
                          <Typography
                            variant="body1"
                            component="a"
                            href={company.website}
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
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {companyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : company ? (
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
                            href={company.website}
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
            ) : (
              <Alert severity="info">Company details not available</Alert>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <CompanyContactsTab companyId={companyId} />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <CompanyTasksTab companyId={companyId} />
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            <CompanyActivityTab companyId={companyId} />
          </TabPanel>

          <TabPanel value={activeTab} index={5}>
            {companyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : company ? (
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
            ) : (
              <Alert severity="info">Company details not available</Alert>
            )}
          </TabPanel>
        </>
      )}

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
              Delete Opportunity
            </Typography>
            <Typography sx={{ mb: 3, color: theme.palette.text.secondary }}>
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action cannot be undone.
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

      {/* Convert Confirmation Dialog */}
      <Dialog
        open={convertDialogOpen}
        onClose={() => !converting && setConvertDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          Convert to Project
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography sx={{ mb: 3, color: theme.palette.text.secondary }}>
            Convert &quot;{opportunity.name}&quot; to a project. You can optionally select a template and add team members.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Template (Optional)</InputLabel>
            <Select
              value={selectedTemplate}
              label="Template (Optional)"
              onChange={(e) => setSelectedTemplate(e.target.value)}
              disabled={converting || loadingTemplates}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    '& .MuiMenuItem-root': {
                      color: theme.palette.text.primary,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                      '&.Mui-selected': {
                        backgroundColor: theme.palette.action.hover,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      },
                    },
                  },
                },
              }}
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.divider,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.primary,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.secondary,
                },
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {loadingTemplates ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ color: theme.palette.text.primary }} />
                </MenuItem>
              ) : (
                templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Project Members (Optional)</InputLabel>
            <Select
              multiple
              value={selectedMembers}
              label="Project Members (Optional)"
              onChange={(e) => setSelectedMembers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              disabled={converting || loadingUsers}
              renderValue={(selected) => {
                const selectedUsers = users.filter(u => selected.includes(u.id));
                return selectedUsers.map(u => u.name || u.email).join(', ') || 'None selected';
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    '& .MuiMenuItem-root': {
                      color: theme.palette.text.primary,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                      '&.Mui-selected': {
                        backgroundColor: theme.palette.action.hover,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      },
                    },
                  },
                },
              }}
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.divider,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.primary,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.secondary,
                },
              }}
            >
              {loadingUsers ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ color: theme.palette.text.primary }} />
                </MenuItem>
              ) : (
                users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Checkbox
                      checked={selectedMembers.indexOf(user.id) > -1}
                      sx={{
                        color: theme.palette.text.secondary,
                        '&.Mui-checked': {
                          color: theme.palette.text.primary,
                        },
                      }}
                    />
                    <ListItemText
                      primary={user.name || user.email}
                      secondary={user.email !== user.name ? user.email : undefined}
                      primaryTypographyProps={{
                        sx: { color: theme.palette.text.primary },
                      }}
                      secondaryTypographyProps={{
                        sx: { color: theme.palette.text.secondary },
                      }}
                    />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setConvertDialogOpen(false)}
            disabled={converting}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmConvert}
            variant="contained"
            disabled={converting}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              fontWeight: 600,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {converting ? 'Converting...' : 'Convert'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
