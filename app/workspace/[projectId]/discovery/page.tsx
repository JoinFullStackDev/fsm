'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container, Box, Typography, Button, Tabs, Tab,  Card, CardContent,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Grid, Menu, MenuItem as MenuItemButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Science as ScienceIcon,
  Feedback as FeedbackIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { UserInsight, Experiment, Feedback } from '@/types/workspace-extended';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function DiscoveryHubPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [insights, setInsights] = useState<UserInsight[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'insight' | 'experiment' | 'feedback'>('insight');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; item: any; type: string} | null>(null);

  // Form states
  const [insightForm, setInsightForm] = useState({
    title: '',
    insight_type: 'interview' as any,
    summary: '',
    source: '',
  });

  const [experimentForm, setExperimentForm] = useState({
    title: '',
    hypothesis: '',
    experiment_type: 'ab_test' as any,
    description: '',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    title: '',
    content: '',
    feedback_type: 'feature_request' as any,
    priority: 'medium' as any,
    source: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [insightsRes, experimentsRes, feedbackRes] = await Promise.all([
        fetch(`/api/workspaces/${projectId}/discovery/insights`),
        fetch(`/api/workspaces/${projectId}/discovery/experiments`),
        fetch(`/api/workspaces/${projectId}/discovery/feedback`),
      ]);

      if (insightsRes.ok) setInsights(await insightsRes.json());
      if (experimentsRes.ok) setExperiments(await experimentsRes.json());
      if (feedbackRes.ok) setFeedback(await feedbackRes.json());
    } catch (err) {
      showError('Failed to load discovery data');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (type: 'insight' | 'experiment' | 'feedback', item?: any) => {
    setDialogType(type);
    setEditingItem(item || null);
    
    if (item) {
      if (type === 'insight') {
        setInsightForm({
          title: item.title,
          insight_type: item.insight_type,
          summary: item.summary || '',
          source: item.source || '',
        });
      } else if (type === 'experiment') {
        setExperimentForm({
          title: item.title,
          hypothesis: item.hypothesis,
          experiment_type: item.experiment_type,
          description: item.description || '',
        });
      } else {
        setFeedbackForm({
          title: item.title,
          content: item.content,
          feedback_type: item.feedback_type,
          priority: item.priority,
          source: item.source || '',
        });
      }
    } else {
      setInsightForm({ title: '', insight_type: 'interview', summary: '', source: '' });
      setExperimentForm({ title: '', hypothesis: '', experiment_type: 'ab_test', description: '' });
      setFeedbackForm({ title: '', content: '', feedback_type: 'feature_request', priority: 'medium', source: '' });
    }
    
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      let url = '';
      let body: any = {};
      let method = 'POST';

      if (dialogType === 'insight') {
        url = editingItem
          ? `/api/workspaces/${projectId}/discovery/insights/${editingItem.id}`
          : `/api/workspaces/${projectId}/discovery/insights`;
        body = { ...insightForm, workspace_id: undefined };
        method = editingItem ? 'PATCH' : 'POST';
      } else if (dialogType === 'experiment') {
        url = editingItem
          ? `/api/workspaces/${projectId}/discovery/experiments/${editingItem.id}`
          : `/api/workspaces/${projectId}/discovery/experiments`;
        body = { ...experimentForm, workspace_id: undefined };
        method = editingItem ? 'PATCH' : 'POST';
      } else {
        url = editingItem
          ? `/api/workspaces/${projectId}/discovery/feedback/${editingItem.id}`
          : `/api/workspaces/${projectId}/discovery/feedback`;
        body = { ...feedbackForm, workspace_id: undefined };
        method = editingItem ? 'PATCH' : 'POST';
      }

      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save');

      showSuccess(editingItem ? 'Updated successfully' : 'Created successfully');
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      showError('Failed to save');
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const endpoints = {
        insight: `insights`,
        experiment: `experiments`,
        feedback: `feedback`,
      };
      const endpoint = endpoints[type as keyof typeof endpoints];
      
      const response = await fetch(`/api/workspaces/${projectId}/discovery/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete');

      showSuccess('Deleted successfully');
      await loadData();
      setMenuAnchor(null);
    } catch (err) {
      showError('Failed to delete');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Discovery Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              User research, experiments, and feedback
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`Insights (${insights.length})`} icon={<InsightsIcon />} iconPosition="start" />
          <Tab label={`Experiments (${experiments.length})`} icon={<ScienceIcon />} iconPosition="start" />
          <Tab label={`Feedback (${feedback.length})`} icon={<FeedbackIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('insight')} sx={{ mb: 3 }}>
            Add Insight
          </Button>
          <Grid container spacing={2}>
            {insights.map((insight) => (
              <Grid item xs={12} md={6} key={insight.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6">{insight.title}</Typography>
                        <Chip label={insight.insight_type} size="small" sx={{ mt: 1, mb: 1 }} />
                        {insight.summary && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {insight.summary}
                          </Typography>
                        )}
                        {insight.pain_points.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>Pain Points:</Typography>
                            {insight.pain_points.slice(0, 2).map((p, i) => (
                              <Chip key={i} label={p} size="small" sx={{ ml: 0.5, mt: 0.5 }} />
                            ))}
                          </Box>
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuAnchor({ element: e.currentTarget, item: insight, type: 'insight' })}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('experiment')} sx={{ mb: 3 }}>
            Add Experiment
          </Button>
          <Grid container spacing={2}>
            {experiments.map((exp) => (
              <Grid item xs={12} md={6} key={exp.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6">{exp.title}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                          <Chip label={exp.experiment_type.replace('_', ' ')} size="small" />
                          <Chip label={exp.status} size="small" color={exp.status === 'completed' ? 'success' : 'default'} />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          <strong>Hypothesis:</strong> {exp.hypothesis}
                        </Typography>
                        {exp.hypothesis_validated !== null && (
                          <Chip
                            label={exp.hypothesis_validated ? 'Validated' : 'Invalidated'}
                            size="small"
                            color={exp.hypothesis_validated ? 'success' : 'error'}
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuAnchor({ element: e.currentTarget, item: exp, type: 'experiment' })}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {tabValue === 2 && (
        <Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('feedback')} sx={{ mb: 3 }}>
            Add Feedback
          </Button>
          <Grid container spacing={2}>
            {feedback.map((fb) => (
              <Grid item xs={12} key={fb.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6">{fb.title}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                          <Chip label={fb.feedback_type.replace('_', ' ')} size="small" />
                          <Chip label={fb.priority} size="small" color={fb.priority === 'high' ? 'error' : 'default'} />
                          <Chip label={fb.status} size="small" color={fb.status === 'shipped' ? 'success' : 'default'} />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {fb.content}
                        </Typography>
                        {fb.source && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Source: {fb.source}
                          </Typography>
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuAnchor({ element: e.currentTarget, item: fb, type: 'feedback' })}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Menu */}
      <Menu anchorEl={menuAnchor?.element} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleOpenDialog(menuAnchor.type as any, menuAnchor.item);
          setMenuAnchor(null);
        }}>
          Edit
        </MenuItemButton>
        <MenuItemButton onClick={() => {
          if (menuAnchor) handleDelete(menuAnchor.type, menuAnchor.item.id);
        }}>
          Delete
        </MenuItemButton>
      </Menu>

      {/* Dialogs */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit' : 'Add'} {dialogType === 'insight' ? 'Insight' : dialogType === 'experiment' ? 'Experiment' : 'Feedback'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogType === 'insight' && (
              <>
                <TextField
                  label="Title"
                  value={insightForm.title}
                  onChange={(e) => setInsightForm({ ...insightForm, title: e.target.value })}
                  fullWidth
                  required
                />
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={insightForm.insight_type}
                    onChange={(e) => setInsightForm({ ...insightForm, insight_type: e.target.value as any })}
                    label="Type"
                  >
                    <MenuItem value="interview">Interview</MenuItem>
                    <MenuItem value="feedback">Feedback</MenuItem>
                    <MenuItem value="survey">Survey</MenuItem>
                    <MenuItem value="support_ticket">Support Ticket</MenuItem>
                    <MenuItem value="usability_test">Usability Test</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Summary"
                  value={insightForm.summary}
                  onChange={(e) => setInsightForm({ ...insightForm, summary: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                />
                <TextField
                  label="Source"
                  value={insightForm.source}
                  onChange={(e) => setInsightForm({ ...insightForm, source: e.target.value })}
                  fullWidth
                />
              </>
            )}

            {dialogType === 'experiment' && (
              <>
                <TextField
                  label="Title"
                  value={experimentForm.title}
                  onChange={(e) => setExperimentForm({ ...experimentForm, title: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Hypothesis"
                  value={experimentForm.hypothesis}
                  onChange={(e) => setExperimentForm({ ...experimentForm, hypothesis: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  required
                />
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={experimentForm.experiment_type}
                    onChange={(e) => setExperimentForm({ ...experimentForm, experiment_type: e.target.value as any })}
                    label="Type"
                  >
                    <MenuItem value="ab_test">A/B Test</MenuItem>
                    <MenuItem value="prototype">Prototype</MenuItem>
                    <MenuItem value="landing_page">Landing Page</MenuItem>
                    <MenuItem value="concierge">Concierge</MenuItem>
                    <MenuItem value="wizard_of_oz">Wizard of Oz</MenuItem>
                    <MenuItem value="interview">Interview</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Description"
                  value={experimentForm.description}
                  onChange={(e) => setExperimentForm({ ...experimentForm, description: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                />
              </>
            )}

            {dialogType === 'feedback' && (
              <>
                <TextField
                  label="Title"
                  value={feedbackForm.title}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Content"
                  value={feedbackForm.content}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                  required
                />
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={feedbackForm.feedback_type}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback_type: e.target.value as any })}
                    label="Type"
                  >
                    <MenuItem value="feature_request">Feature Request</MenuItem>
                    <MenuItem value="bug_report">Bug Report</MenuItem>
                    <MenuItem value="complaint">Complaint</MenuItem>
                    <MenuItem value="praise">Praise</MenuItem>
                    <MenuItem value="question">Question</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={feedbackForm.priority}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, priority: e.target.value as any })}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Source"
                  value={feedbackForm.source}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, source: e.target.value })}
                  fullWidth
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

