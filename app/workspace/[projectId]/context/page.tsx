'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  MenuBook as MenuBookIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { WorkspaceDecision, WorkspaceDebt, DebtHeatmapData } from '@/types/workspace';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function ContextLibraryPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<WorkspaceDecision[]>([]);
  const [debtItems, setDebtItems] = useState<WorkspaceDebt[]>([]);
  const [heatmap, setHeatmap] = useState<DebtHeatmapData | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);

  // Form state for new decision
  const [newDecision, setNewDecision] = useState({
    title: '',
    context: '',
    decision: '',
    rationale: '',
  });

  // Form state for new debt
  const [newDebt, setNewDebt] = useState({
    title: '',
    description: '',
    debt_type: 'technical' as const,
    severity: 'medium' as const,
  });

  const loadData = useCallback(async () => {
    try {
      const [decisionsRes, debtRes, heatmapRes] = await Promise.all([
        fetch(`/api/workspaces/${projectId}/decisions`),
        fetch(`/api/workspaces/${projectId}/debt`),
        fetch(`/api/workspaces/${projectId}/debt/heatmap`),
      ]);

      if (decisionsRes.ok) {
        const decisionsData = await decisionsRes.json();
        setDecisions(decisionsData);
      }

      if (debtRes.ok) {
        const debtData = await debtRes.json();
        setDebtItems(debtData);
      }

      if (heatmapRes.ok) {
        const heatmapData = await heatmapRes.json();
        setHeatmap(heatmapData);
      }
    } catch (err) {
      showError('Failed to load context library data');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDecision = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/decisions`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify(newDecision),
      });

      if (!response.ok) {
        throw new Error('Failed to create decision');
      }

      showSuccess('Decision logged successfully');
      setDecisionDialogOpen(false);
      setNewDecision({ title: '', context: '', decision: '', rationale: '' });
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create decision');
    }
  };

  const handleCreateDebt = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/debt`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify(newDebt),
      });

      if (!response.ok) {
        throw new Error('Failed to create debt item');
      }

      showSuccess('Debt item logged successfully');
      setDebtDialogOpen(false);
      setNewDebt({ title: '', description: '', debt_type: 'technical', severity: 'medium' });
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create debt item');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading Context Library...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/workspace/${projectId}`)}
          sx={{ mb: 2 }}
        >
          Back to Workspace
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <MenuBookIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Context Library
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Decisions and debt tracking
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Heatmap Summary */}
      {heatmap && heatmap.total_count > 0 && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Debt Overview</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Debt</Typography>
                <Typography variant="h5">{heatmap.total_count}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Avg Age</Typography>
                <Typography variant="h5">{heatmap.average_age_days}d</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Critical</Typography>
                <Typography variant="h5" color="error.main">{heatmap.by_severity.critical}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Open</Typography>
                <Typography variant="h5">{heatmap.by_status.open}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Decisions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Decisions ({decisions.length})</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setDecisionDialogOpen(true)}
                size="small"
              >
                Add
              </Button>
            </Box>

            {decisions.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No decisions logged yet
              </Typography>
            ) : (
              <List>
                {decisions.map((decision, idx) => (
                  <Box key={decision.id}>
                    {idx > 0 && <Divider sx={{ my: 1 }} />}
                    <ListItem disablePadding sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <ListItemText
                        primary={decision.title}
                        secondary={`${new Date(decision.decision_date).toLocaleDateString()} • ${decision.decision.substring(0, 100)}${decision.decision.length > 100 ? '...' : ''}`}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Debt Items */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Debt Items ({debtItems.length})</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setDebtDialogOpen(true)}
                size="small"
              >
                Add
              </Button>
            </Box>

            {debtItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No debt items logged yet
              </Typography>
            ) : (
              <List>
                {debtItems.map((debt, idx) => (
                  <Box key={debt.id}>
                    {idx > 0 && <Divider sx={{ my: 1 }} />}
                    <ListItem disablePadding sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={debt.severity}
                          size="small"
                          color={
                            debt.severity === 'critical' ? 'error' :
                            debt.severity === 'high' ? 'warning' :
                            'default'
                          }
                        />
                        <Chip label={debt.debt_type} size="small" variant="outlined" />
                      </Box>
                      <ListItemText
                        primary={debt.title}
                        secondary={`${debt.description.substring(0, 80)}${debt.description.length > 80 ? '...' : ''}`}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onClose={() => setDecisionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Log Decision</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Decision Title"
            value={newDecision.title}
            onChange={(e) => setNewDecision({ ...newDecision, title: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Context"
            multiline
            rows={2}
            value={newDecision.context}
            onChange={(e) => setNewDecision({ ...newDecision, context: e.target.value })}
            helperText="What was the situation?"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Decision"
            multiline
            rows={2}
            value={newDecision.decision}
            onChange={(e) => setNewDecision({ ...newDecision, decision: e.target.value })}
            helperText="What did you decide?"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Rationale"
            multiline
            rows={3}
            value={newDecision.rationale}
            onChange={(e) => setNewDecision({ ...newDecision, rationale: e.target.value })}
            helperText="Why did you make this decision?"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateDecision}
            disabled={!newDecision.title || !newDecision.decision}
          >
            Save Decision
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debt Dialog */}
      <Dialog open={debtDialogOpen} onClose={() => setDebtDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Log Debt Item</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={newDebt.title}
            onChange={(e) => setNewDebt({ ...newDebt, title: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={newDebt.description}
            onChange={(e) => setNewDebt({ ...newDebt, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Debt Type"
                value={newDebt.debt_type}
                onChange={(e) => setNewDebt({ ...newDebt, debt_type: e.target.value as any })}
              >
                <MenuItem value="technical">Technical</MenuItem>
                <MenuItem value="product">Product</MenuItem>
                <MenuItem value="design">Design</MenuItem>
                <MenuItem value="operational">Operational</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Severity"
                value={newDebt.severity}
                onChange={(e) => setNewDebt({ ...newDebt, severity: e.target.value as any })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDebtDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateDebt}
            disabled={!newDebt.title || !newDebt.description}
          >
            Save Debt Item
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
