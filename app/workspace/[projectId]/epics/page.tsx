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
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
  Badge,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  AccountTree as AccountTreeIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  CloudUpload as CloudUploadIcon,
  ContentCopy as ContentCopyIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  Palette as PaletteIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { EpicDraft, ClaritySpec, IssueDefinition } from '@/types/workspace';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function EpicBuilderPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [epics, setEpics] = useState<EpicDraft[]>([]);
  const [specs, setSpecs] = useState<ClaritySpec[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<string>('');
  const [selectedEpic, setSelectedEpic] = useState<EpicDraft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ anchor: HTMLElement; epicId: string } | null>(null);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [epicsRes, specsRes] = await Promise.all([
        fetch(`/api/workspaces/${projectId}/epics`),
        fetch(`/api/workspaces/${projectId}/clarity`),
      ]);

      if (!epicsRes.ok || !specsRes.ok) {
        throw new Error('Failed to load data');
      }

      const [epicsData, specsData] = await Promise.all([
        epicsRes.json(),
        specsRes.json(),
      ]);

      const activeEpics = epicsData.filter((e: EpicDraft) => e.status !== 'archived');
      setEpics(activeEpics);
      setSpecs(specsData.filter((s: ClaritySpec) => s.status !== 'archived'));

      // Auto-select first epic if available
      if (activeEpics.length > 0 && !selectedEpic) {
        setSelectedEpic(activeEpics[0]);
        setEditTitle(activeEpics[0].title);
        setEditDescription(activeEpics[0].description || '');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError, selectedEpic]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!selectedSpec) {
      showError('Please select a clarity spec');
      return;
    }

    try {
      setGenerating(true);
      setGenerateDialogOpen(false);

      // Create empty epic first
      const createRes = await fetch(`/api/workspaces/${projectId}/epics`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          workspace_id: projectId,
          clarity_spec_id: selectedSpec,
          title: 'Generating Epic...',
        }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to create epic');
      }

      const newEpic = await createRes.json();

      // Generate from spec
      const generateRes = await fetch(
        `/api/workspaces/${projectId}/epics/${newEpic.id}/generate-from-spec`,
        {
          method: 'POST',
          headers: getCsrfHeaders(),
          body: JSON.stringify({}),
        }
      );

      if (!generateRes.ok) {
        throw new Error('Failed to generate epic');
      }

      const generatedEpic = await generateRes.json();
      
      showSuccess('Epic generated successfully!');
      setSelectedEpic(generatedEpic);
      setEditTitle(generatedEpic.title);
      setEditDescription(generatedEpic.description || '');
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEpic) return;

    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/epics/${selectedEpic.id}`,
        {
          method: 'PATCH',
          headers: getCsrfHeaders(),
          body: JSON.stringify({
            title: editTitle,
            description: editDescription,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const updated = await response.json();
      setSelectedEpic(updated);
      setEditMode(false);
      showSuccess('Changes saved');
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleCreateTasks = async (epicId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/epics/${epicId}/create-tasks`,
        {
          method: 'POST',
          headers: getCsrfHeaders(),
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create tasks');
      }

      const result = await response.json();
      showSuccess(`Created ${result.task_count} tasks successfully!`);
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create tasks');
    }
  };

  const handleDeleteEpic = async (epicId: string) => {
    if (!confirm('Archive this epic? It can be restored later.')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/epics/${epicId}`,
        {
          method: 'DELETE',
          headers: getCsrfHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to archive epic');
      }

      showSuccess('Epic archived');
      if (selectedEpic?.id === epicId) {
        setSelectedEpic(null);
      }
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading Epic Builder...</Typography>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountTreeIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Epic Builder
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {epics.length} epic{epics.length === 1 ? '' : 's'} • {specs.length} clarity spec{specs.length === 1 ? '' : 's'} available
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            onClick={() => setGenerateDialogOpen(true)}
            disabled={generating || specs.length === 0}
          >
            Generate Epic
          </Button>
        </Box>
      </Box>

      {/* No specs warning */}
      {specs.length === 0 && (
        <Alert severity="info" action={
          <Button color="inherit" onClick={() => router.push(`/workspace/${projectId}/clarity`)}>
            Create Clarity Spec
          </Button>
        }>
          Create a Clarity Spec first to generate epics from structured requirements
        </Alert>
      )}

      {/* Layout: Sidebar + Document View */}
      <Box sx={{ display: 'flex', gap: 3, minHeight: '70vh' }}>
        {/* Sidebar - Epic List */}
        <Paper
          sx={{
            width: 300,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, px: 1 }}>
            Epics
          </Typography>

          {epics.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No epics yet
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {epics.map((epic) => (
                <Paper
                  key={epic.id}
                  onClick={() => {
                    setSelectedEpic(epic);
                    setEditTitle(epic.title);
                    setEditDescription(epic.description || '');
                    setEditMode(false);
                  }}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: `2px solid ${
                      selectedEpic?.id === epic.id
                        ? theme.palette.primary.main
                        : 'transparent'
                    }`,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {epic.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={epic.risk_level} size="small" />
                    {epic.tasks_generated && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Tasks"
                        size="small"
                        color="success"
                      />
                    )}
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Main Document View */}
        {selectedEpic ? (
          <Paper
            sx={{
              flex: 1,
              p: 4,
              borderRadius: 2,
              maxWidth: '100%',
              overflow: 'auto',
            }}
          >
            {/* Document Header */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                {editMode ? (
                  <TextField
                    fullWidth
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    variant="standard"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '2rem',
                        fontWeight: 600,
                      },
                    }}
                  />
                ) : (
                  <Typography variant="h3" sx={{ fontWeight: 600, flex: 1 }}>
                    {selectedEpic.title}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                  {editMode ? (
                    <>
                      <IconButton onClick={() => setEditMode(false)} color="default">
                        <CloseIcon />
                      </IconButton>
                      <IconButton onClick={handleSaveEdit} color="primary">
                        <CheckIcon />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => setEditMode(true)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="More actions">
                        <IconButton
                          onClick={(e) =>
                            setMenuAnchor({ anchor: e.currentTarget, epicId: selectedEpic.id })
                          }
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>

              {/* Metadata chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
                <Chip
                  label={selectedEpic.risk_level.toUpperCase()}
                  color={
                    selectedEpic.risk_level === 'low'
                      ? 'success'
                      : selectedEpic.risk_level === 'medium'
                      ? 'warning'
                      : 'error'
                  }
                />
                {selectedEpic.effort_estimate && (
                  <Chip label={`Effort: ${selectedEpic.effort_estimate}`} variant="outlined" />
                )}
                {selectedEpic.value_tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
                {selectedEpic.tasks_generated && (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${selectedEpic.generated_task_ids.length} Tasks Created`}
                    color="success"
                  />
                )}
              </Stack>

              {/* Description */}
              {editMode ? (
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  variant="outlined"
                  placeholder="Epic description..."
                />
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    backgroundColor: theme.palette.background.default,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                    {selectedEpic.description || 'No description provided'}
                  </Typography>
                </Paper>
              )}
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
              {!selectedEpic.tasks_generated && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AssignmentIcon />}
                  onClick={() => handleCreateTasks(selectedEpic.id)}
                >
                  Create {(selectedEpic.frontend_issues.length || 0) + (selectedEpic.backend_issues.length || 0) + (selectedEpic.design_issues?.length || 0)} Tasks in Project
                </Button>
              )}
              {selectedEpic.tasks_generated && (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push(`/project-management/${projectId}`)}
                >
                  View Tasks in Project
                </Button>
              )}
              <Button variant="outlined" startIcon={<CloudUploadIcon />} disabled>
                Export to GitLab (Coming Soon)
              </Button>
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Issues Sections */}
            {/* Frontend Issues */}
            {selectedEpic.frontend_issues.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <CodeIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Frontend Issues
                  </Typography>
                  <Chip
                    label={`${selectedEpic.frontend_issues.length} issues`}
                    size="small"
                    color="primary"
                  />
                </Box>
                <Stack spacing={2}>
                  {selectedEpic.frontend_issues.map((issue, idx) => (
                    <IssueCard key={idx} issue={issue} index={idx + 1} type="frontend" />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Backend Issues */}
            {selectedEpic.backend_issues.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <CodeIcon sx={{ color: theme.palette.success.main }} />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Backend Issues
                  </Typography>
                  <Chip
                    label={`${selectedEpic.backend_issues.length} issues`}
                    size="small"
                    color="success"
                  />
                </Box>
                <Stack spacing={2}>
                  {selectedEpic.backend_issues.map((issue, idx) => (
                    <IssueCard key={idx} issue={issue} index={idx + 1} type="backend" />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Design Issues */}
            {selectedEpic.design_issues && selectedEpic.design_issues.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <PaletteIcon sx={{ color: theme.palette.secondary.main }} />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Design Issues
                  </Typography>
                  <Chip
                    label={`${selectedEpic.design_issues.length} issues`}
                    size="small"
                    color="secondary"
                  />
                </Box>
                <Stack spacing={2}>
                  {selectedEpic.design_issues.map((issue, idx) => (
                    <IssueCard key={idx} issue={issue} index={idx + 1} type="design" />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Definition of Done */}
            {selectedEpic.definition_of_done.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                  Definition of Done
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: theme.palette.background.default }}>
                  {selectedEpic.definition_of_done.map((item, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 20, color: theme.palette.success.main, mt: 0.25 }} />
                      <Typography variant="body2">{item}</Typography>
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}
          </Paper>
        ) : (
          <Paper
            sx={{
              flex: 1,
              p: 8,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 100, color: theme.palette.text.disabled, mb: 3 }} />
            <Typography variant="h5" sx={{ mb: 2 }}>
              {epics.length === 0 ? 'Generate Your First Epic' : 'Select an Epic'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {epics.length === 0
                ? 'Transform your clarity spec into actionable engineering work with AI'
                : 'Select an epic from the sidebar to view and edit'}
            </Typography>
            {specs.length > 0 && (
              <Button
                variant="contained"
                size="large"
                onClick={() => setGenerateDialogOpen(true)}
              >
                Generate Epic from Clarity Spec
              </Button>
            )}
          </Paper>
        )}
      </Box>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Epic from Clarity Spec</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            AI will analyze your clarity spec and generate a comprehensive epic with frontend, backend, and design issues
          </Typography>
          <TextField
            select
            fullWidth
            label="Select Clarity Spec Version"
            value={selectedSpec}
            onChange={(e) => setSelectedSpec(e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="">Choose a version...</option>
            {specs.map((spec) => (
              <option key={spec.id} value={spec.id}>
                v{spec.version} - {spec.status} {spec.ai_readiness_score ? `(Readiness: ${spec.ai_readiness_score.toFixed(1)}/10)` : ''}
              </option>
            ))}
          </TextField>
          {selectedSpec && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This will generate a comprehensive epic with detailed frontend and backend issues. Generation takes 10-30 seconds.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleGenerate} disabled={!selectedSpec}>
            Generate Epic
          </Button>
        </DialogActions>
      </Dialog>

      {/* More Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.anchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (menuAnchor) handleCreateTasks(menuAnchor.epicId);
          setMenuAnchor(null);
        }}>
          <ListItemIcon>
            <AssignmentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Create Tasks</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          // TODO: Implement duplicate
          setMenuAnchor(null);
        }}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate Epic</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuAnchor) handleDeleteEpic(menuAnchor.epicId);
            setMenuAnchor(null);
          }}
          sx={{ color: theme.palette.error.main }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Archive Epic</ListItemText>
        </MenuItem>
      </Menu>
    </Container>
  );
}

// Issue Card Component
function IssueCard({
  issue,
  index,
  type,
}: {
  issue: IssueDefinition;
  index: number;
  type: 'frontend' | 'backend' | 'design';
}) {
  const theme = useTheme();

  const typeColor = {
    frontend: theme.palette.primary.main,
    backend: theme.palette.success.main,
    design: theme.palette.secondary.main,
  }[type];

  const priorityColor = {
    high: theme.palette.error.main,
    medium: theme.palette.warning.main,
    low: theme.palette.info.main,
  }[issue.priority || 'medium'];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderLeft: `4px solid ${typeColor}`,
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            {index}. {issue.title}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label={issue.priority || 'medium'}
              size="small"
              sx={{
                backgroundColor: priorityColor,
                color: 'white',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: '0.7rem',
              }}
            />
            {issue.estimated_hours && (
              <Chip
                label={`${issue.estimated_hours}h`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.7, color: theme.palette.text.secondary }}>
        {issue.description}
      </Typography>

      {issue.acceptance_criteria && issue.acceptance_criteria.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Acceptance Criteria:
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {issue.acceptance_criteria.map((criteria, idx) => (
              <Typography
                key={idx}
                component="li"
                variant="body2"
                sx={{ mb: 0.5, color: theme.palette.text.secondary }}
              >
                {criteria}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
