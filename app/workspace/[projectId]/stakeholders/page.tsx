'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type {
  Stakeholder,
  PowerInterestMatrix,
  CreateStakeholderInput,
  UpdateStakeholderInput,
  PowerLevel,
  InterestLevel,
  AlignmentStatus,
} from '@/types/workspace-extended';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function StakeholdersPage() {
  const params = useParams();
  const router = useRouter();
  const theme = useTheme();
  const projectId = params.projectId as string;

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [matrix, setMatrix] = useState<PowerInterestMatrix | null>(null);
  const [matrixStats, setMatrixStats] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [formData, setFormData] = useState<Partial<CreateStakeholderInput>>({
    name: '',
    role: '',
    department: '',
    email: '',
    power_level: 'medium',
    interest_level: 'medium',
    alignment_status: 'neutral',
    key_concerns: [],
    key_interests: [],
  });

  useEffect(() => {
    fetchStakeholders();
    fetchMatrix();
  }, [projectId]);

  const fetchStakeholders = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/stakeholders`);
      if (response.ok) {
        const data = await response.json();
        setStakeholders(data.stakeholders);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/stakeholders/matrix`);
      if (response.ok) {
        const data = await response.json();
        setMatrix(data.matrix);
        setMatrixStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching matrix:', error);
    }
  };

  const handleOpenDialog = (stakeholder?: Stakeholder) => {
    if (stakeholder) {
      setEditingStakeholder(stakeholder);
      setFormData({
        name: stakeholder.name,
        role: stakeholder.role || '',
        department: stakeholder.department || '',
        email: stakeholder.email || '',
        power_level: stakeholder.power_level || 'medium',
        interest_level: stakeholder.interest_level || 'medium',
        alignment_status: stakeholder.alignment_status,
        key_concerns: stakeholder.key_concerns,
        key_interests: stakeholder.key_interests,
      });
    } else {
      setEditingStakeholder(null);
      setFormData({
        name: '',
        role: '',
        department: '',
        email: '',
        power_level: 'medium',
        interest_level: 'medium',
        alignment_status: 'neutral',
        key_concerns: [],
        key_interests: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingStakeholder(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingStakeholder) {
        const response = await fetch(
          `/api/workspaces/${projectId}/stakeholders/${editingStakeholder.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          }
        );
        if (response.ok) {
          await fetchStakeholders();
          await fetchMatrix();
          handleCloseDialog();
        }
      } else {
        const response = await fetch(`/api/workspaces/${projectId}/stakeholders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, workspace_id: projectId }),
        });
        if (response.ok) {
          await fetchStakeholders();
          await fetchMatrix();
          handleCloseDialog();
        }
      }
    } catch (error) {
      console.error('Error saving stakeholder:', error);
    }
  };

  const handleDelete = async (stakeholderId: string) => {
    if (!confirm('Are you sure you want to delete this stakeholder?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/stakeholders/${stakeholderId}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        await fetchStakeholders();
        await fetchMatrix();
      }
    } catch (error) {
      console.error('Error deleting stakeholder:', error);
    }
  };

  const getAlignmentColor = (status: AlignmentStatus) => {
    switch (status) {
      case 'champion': return theme.palette.success.main;
      case 'supporter': return theme.palette.success.light;
      case 'neutral': return theme.palette.grey[500];
      case 'skeptical': return theme.palette.warning.main;
      case 'blocker': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  const renderStakeholderCard = (stakeholder: Stakeholder) => (
    <Card key={stakeholder.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6">{stakeholder.name}</Typography>
            {stakeholder.role && (
              <Typography variant="body2" color="text.secondary">
                {stakeholder.role}
                {stakeholder.department && ` • ${stakeholder.department}`}
              </Typography>
            )}
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={stakeholder.alignment_status}
                size="small"
                sx={{ bgcolor: getAlignmentColor(stakeholder.alignment_status), color: 'white' }}
              />
              {stakeholder.power_level && (
                <Chip label={`Power: ${stakeholder.power_level}`} size="small" variant="outlined" />
              )}
              {stakeholder.interest_level && (
                <Chip label={`Interest: ${stakeholder.interest_level}`} size="small" variant="outlined" />
              )}
            </Box>
            {stakeholder.key_concerns.length > 0 && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                <strong>Concerns:</strong> {stakeholder.key_concerns.join(', ')}
              </Typography>
            )}
          </Box>
          <Box>
            <IconButton size="small" onClick={() => handleOpenDialog(stakeholder)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDelete(stakeholder.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderMatrixQuadrant = (title: string, stakeholders: Stakeholder[], description: string) => (
    <Grid item xs={12} md={6}>
      <Paper sx={{ p: 2, height: '100%', minHeight: 300 }}>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Box>
          {stakeholders.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No stakeholders in this quadrant
            </Typography>
          ) : (
            stakeholders.map(stakeholder => (
              <Chip
                key={stakeholder.id}
                label={stakeholder.name}
                size="small"
                sx={{
                  m: 0.5,
                  bgcolor: getAlignmentColor(stakeholder.alignment_status),
                  color: 'white',
                }}
                onClick={() => handleOpenDialog(stakeholder)}
              />
            ))
          )}
        </Box>
      </Paper>
    </Grid>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/workspace/${projectId}`)}
          sx={{ fontWeight: 600 }}
        >
          Back to Workspace
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => router.push(`/workspace/${projectId}/stakeholders/updates`)}
          >
            Updates & Communication
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Stakeholder
          </Button>
        </Box>
      </Box>

      <Typography variant="h4" gutterBottom>
        Stakeholder Hub
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage stakeholder relationships, track alignment, and maintain effective communication.
      </Typography>

      {matrixStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography variant="h4">{matrixStats.total_stakeholders}</Typography>
                <Typography variant="caption">Total Stakeholders</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2.4}>
            <Card sx={{ bgcolor: theme.palette.success.light }}>
              <CardContent>
                <Typography variant="h4">{matrixStats.alignment_distribution.champion}</Typography>
                <Typography variant="caption">Champions</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2.4}>
            <Card sx={{ bgcolor: theme.palette.success.main }}>
              <CardContent>
                <Typography variant="h4">{matrixStats.alignment_distribution.supporter}</Typography>
                <Typography variant="caption">Supporters</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2.4}>
            <Card sx={{ bgcolor: theme.palette.warning.light }}>
              <CardContent>
                <Typography variant="h4">{matrixStats.alignment_distribution.skeptical}</Typography>
                <Typography variant="caption">Skeptical</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2.4}>
            <Card sx={{ bgcolor: theme.palette.error.light }}>
              <CardContent>
                <Typography variant="h4">{matrixStats.alignment_distribution.blocker}</Typography>
                <Typography variant="caption">Blockers</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab label="Power/Interest Matrix" />
        <Tab label="All Stakeholders" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {matrix && (
          <Grid container spacing={2}>
            {renderMatrixQuadrant(
              'Manage Closely',
              matrix.high_power_high_interest,
              'High power, high interest - Key players requiring close engagement'
            )}
            {renderMatrixQuadrant(
              'Keep Satisfied',
              matrix.high_power_low_interest,
              'High power, low interest - Keep satisfied but avoid over-communication'
            )}
            {renderMatrixQuadrant(
              'Keep Informed',
              matrix.low_power_high_interest,
              'Low power, high interest - Keep adequately informed'
            )}
            {renderMatrixQuadrant(
              'Monitor',
              matrix.low_power_low_interest,
              'Low power, low interest - Monitor with minimal effort'
            )}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {stakeholders.map(renderStakeholderCard)}
      </TabPanel>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingStakeholder ? 'Edit Stakeholder' : 'Add New Stakeholder'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Power Level</InputLabel>
                <Select
                  value={formData.power_level}
                  label="Power Level"
                  onChange={(e) => setFormData({ ...formData, power_level: e.target.value as PowerLevel })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Interest Level</InputLabel>
                <Select
                  value={formData.interest_level}
                  label="Interest Level"
                  onChange={(e) => setFormData({ ...formData, interest_level: e.target.value as InterestLevel })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Alignment Status</InputLabel>
                <Select
                  value={formData.alignment_status}
                  label="Alignment Status"
                  onChange={(e) => setFormData({ ...formData, alignment_status: e.target.value as AlignmentStatus })}
                >
                  <MenuItem value="champion">Champion</MenuItem>
                  <MenuItem value="supporter">Supporter</MenuItem>
                  <MenuItem value="neutral">Neutral</MenuItem>
                  <MenuItem value="skeptical">Skeptical</MenuItem>
                  <MenuItem value="blocker">Blocker</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingStakeholder ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

