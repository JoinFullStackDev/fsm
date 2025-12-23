'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Psychology as PsychologyIcon,
  AddCircle as AddCircleIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { ClaritySpec } from '@/types/workspace';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function ClarityCanvasPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [specs, setSpecs] = useState<ClaritySpec[]>([]);
  const [currentSpec, setCurrentSpec] = useState<ClaritySpec | null>(null);
  const [versionMenuAnchor, setVersionMenuAnchor] = useState<null | HTMLElement>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<ClaritySpec>>({
    problem_statement: '',
    jobs_to_be_done: [],
    user_pains: [],
    business_goals: [],
    success_metrics: [],
    constraints: [],
    assumptions: [],
    desired_outcomes: [],
    mental_model_notes: '',
    stakeholder_notes: '',
  });

  // Load specs
  const loadSpecs = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/clarity`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load clarity specs');
      }
      const data = await response.json();
      setSpecs(data);
      
      // Set current spec: prefer the active version (status 'ready'), otherwise latest
      if (data.length > 0) {
        // Find the active spec (status 'ready') or fall back to latest version
        const activeSpec = data.find((spec: ClaritySpec) => spec.status === 'ready') || data[0];
        setCurrentSpec(activeSpec);
        setFormData({
          problem_statement: activeSpec.problem_statement || '',
          jobs_to_be_done: activeSpec.jobs_to_be_done || [],
          user_pains: activeSpec.user_pains || [],
          business_goals: activeSpec.business_goals || [],
          success_metrics: activeSpec.success_metrics || [],
          constraints: activeSpec.constraints || [],
          assumptions: activeSpec.assumptions || [],
          desired_outcomes: activeSpec.desired_outcomes || [],
          mental_model_notes: activeSpec.mental_model_notes || '',
          stakeholder_notes: activeSpec.stakeholder_notes || '',
        });
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load specs');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadSpecs();
  }, [loadSpecs]);

  // Auto-save (debounced)
  useEffect(() => {
    if (!currentSpec) return;

    const timer = setTimeout(async () => {
      try {
        setSaving(true);
        const response = await fetch(`/api/workspaces/${projectId}/clarity/${currentSpec.id}`, {
          method: 'PATCH',
          headers: getCsrfHeaders(),
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to save');
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, currentSpec, projectId]);

  const handleCreateNewVersion = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/clarity`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create new version');
      }

      const newSpec = await response.json();
      showSuccess('New version created');
      await loadSpecs();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create version');
    }
  };

  const handleAnalyze = async () => {
    if (!currentSpec) return;

    try {
      setAnalyzing(true);
      const response = await fetch(`/api/workspaces/${projectId}/clarity/${currentSpec.id}/analyze`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze');
      }

      const result = await response.json();
      setCurrentSpec(result.spec);
      showSuccess('Analysis complete');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddArrayItem = (field: keyof ClaritySpec, value: string) => {
    if (!value.trim()) return;
    const currentArray = (formData[field] as string[]) || [];
    setFormData({
      ...formData,
      [field]: [...currentArray, value.trim()],
    });
  };

  const handleRemoveArrayItem = (field: keyof ClaritySpec, index: number) => {
    const currentArray = (formData[field] as string[]) || [];
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index),
    });
  };

  // Handle version selection - switch to a different version
  const handleVersionSelect = (spec: ClaritySpec) => {
    setCurrentSpec(spec);
    setFormData({
      problem_statement: spec.problem_statement || '',
      jobs_to_be_done: spec.jobs_to_be_done || [],
      user_pains: spec.user_pains || [],
      business_goals: spec.business_goals || [],
      success_metrics: spec.success_metrics || [],
      constraints: spec.constraints || [],
      assumptions: spec.assumptions || [],
      desired_outcomes: spec.desired_outcomes || [],
      mental_model_notes: spec.mental_model_notes || '',
      stakeholder_notes: spec.stakeholder_notes || '',
    });
    setVersionMenuAnchor(null);
  };

  // Set a version as the active version
  const handleSetAsActive = async (specId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/clarity/${specId}/promote`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({ status: 'ready' }),
      });

      if (!response.ok) {
        throw new Error('Failed to set as active');
      }

      showSuccess('Version set as active');
      await loadSpecs();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to set as active');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading Clarity Canvas...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/workspace/${projectId}`)}
            sx={{ mb: 2 }}
          >
            Back to Workspace
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PsychologyIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Clarity Canvas
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {saving ? (
                  <Typography variant="body2" color="text.secondary">Saving...</Typography>
                ) : specs.length > 0 ? (
                  <>
                    {/* Version selector button */}
                    <Button
                      size="small"
                      onClick={(e) => setVersionMenuAnchor(e.currentTarget)}
                      endIcon={<HistoryIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      Version {currentSpec?.version || 1}
                    </Button>
                    {currentSpec?.status === 'ready' && (
                      <Chip size="small" label="Active" color="success" sx={{ height: 20 }} />
                    )}
                    {currentSpec?.status === 'draft' && (
                      <Chip size="small" label="Draft" sx={{ height: 20 }} />
                    )}
                    {currentSpec?.status === 'in_review' && (
                      <Chip size="small" label="In Review" color="warning" sx={{ height: 20 }} />
                    )}
                    {currentSpec?.status === 'archived' && (
                      <Chip size="small" label="Archived" color="error" sx={{ height: 20 }} />
                    )}
                    
                    {/* Version dropdown menu */}
                    <Menu
                      anchorEl={versionMenuAnchor}
                      open={Boolean(versionMenuAnchor)}
                      onClose={() => setVersionMenuAnchor(null)}
                      PaperProps={{ sx: { minWidth: 300 } }}
                    >
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Version History ({specs.length} {specs.length === 1 ? 'version' : 'versions'})
                        </Typography>
                      </Box>
                      <Divider />
                      {specs.map((spec) => (
                        <MenuItem
                          key={spec.id}
                          selected={spec.id === currentSpec?.id}
                          onClick={() => handleVersionSelect(spec)}
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            py: 1.5,
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: spec.id === currentSpec?.id ? 600 : 400 }}>
                              Version {spec.version}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(spec.created_at).toLocaleDateString()} at{' '}
                              {new Date(spec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {spec.status === 'ready' && (
                              <Chip size="small" label="Active" color="success" sx={{ height: 20 }} />
                            )}
                            {spec.status === 'draft' && (
                              <Chip size="small" label="Draft" sx={{ height: 20 }} />
                            )}
                            {spec.status === 'in_review' && (
                              <Chip size="small" label="Review" color="warning" sx={{ height: 20 }} />
                            )}
                            {spec.status === 'archived' && (
                              <Chip size="small" label="Archived" color="error" sx={{ height: 20 }} />
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                      <Divider />
                      <MenuItem onClick={() => { setVersionMenuAnchor(null); handleCreateNewVersion(); }}>
                        <AddCircleIcon sx={{ mr: 1, fontSize: 18 }} />
                        Create New Version
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">No versions yet</Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {specs.length > 0 && (
            <>
              {/* Show "Set as Active" button if viewing non-active version */}
              {currentSpec && currentSpec.status !== 'ready' && currentSpec.status !== 'archived' && (
                <Button
                  variant="outlined"
                  color="success"
                  onClick={() => handleSetAsActive(currentSpec.id)}
                >
                  Set as Active
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={handleAnalyze}
                disabled={analyzing}
                startIcon={analyzing ? <CircularProgress size={16} /> : <PsychologyIcon />}
              >
                {analyzing ? 'Analyzing...' : 'AI Analysis'}
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateNewVersion}
              >
                New Version
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* No specs yet */}
      {specs.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PsychologyIcon sx={{ fontSize: 80, color: theme.palette.text.disabled, mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>
            Start Your First Clarity Spec
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Define the problem, capture business intent, and identify outcomes before building solutions
          </Typography>
          <Button variant="contained" onClick={handleCreateNewVersion}>
            Create Clarity Spec
          </Button>
        </Paper>
      )}

      {/* Readiness Score */}
      {currentSpec && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: theme.palette.background.default }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Readiness Score: {currentSpec.ai_readiness_score?.toFixed(1) || 'Not analyzed'}/10
            </Typography>
            {currentSpec.ai_readiness_score && (
              <Chip
                label={
                  currentSpec.ai_readiness_score >= 8 ? 'Ready' :
                  currentSpec.ai_readiness_score >= 6 ? 'Good Progress' :
                  'Needs Work'
                }
                color={
                  currentSpec.ai_readiness_score >= 8 ? 'success' :
                  currentSpec.ai_readiness_score >= 6 ? 'warning' :
                  'error'
                }
              />
            )}
          </Box>
          {currentSpec.ai_readiness_score && (
            <LinearProgress
              variant="determinate"
              value={(currentSpec.ai_readiness_score / 10) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          )}
          
          {/* Warnings */}
          {currentSpec.ai_risk_warnings && currentSpec.ai_risk_warnings.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                Risk Warnings
              </Typography>
              {currentSpec.ai_risk_warnings.map((warning, idx) => (
                <Alert key={idx} severity="warning" sx={{ mb: 1 }}>
                  {warning}
                </Alert>
              ))}
            </Box>
          )}

          {/* Suggestions */}
          {currentSpec.ai_suggestions && currentSpec.ai_suggestions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LightbulbIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
                Suggestions
              </Typography>
              {currentSpec.ai_suggestions.map((suggestion, idx) => (
                <Alert key={idx} severity="info" sx={{ mb: 1 }}>
                  {suggestion}
                </Alert>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Form Sections */}
      {currentSpec && (
        <>
          {/* Problem Framing */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Problem Framing
            </Typography>
            
            <TextField
              fullWidth
              label="Problem Statement"
              multiline
              rows={4}
              value={formData.problem_statement || ''}
              onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
              helperText="What problem are you solving? Be specific and clear."
              sx={{ mb: 3 }}
            />

            <ArrayField
              label="Jobs to Be Done"
              items={formData.jobs_to_be_done || []}
              onAdd={(value) => handleAddArrayItem('jobs_to_be_done', value)}
              onRemove={(idx) => handleRemoveArrayItem('jobs_to_be_done', idx)}
              placeholder="What are users trying to accomplish?"
            />

            <ArrayField
              label="User Pains"
              items={formData.user_pains || []}
              onAdd={(value) => handleAddArrayItem('user_pains', value)}
              onRemove={(idx) => handleRemoveArrayItem('user_pains', idx)}
              placeholder="What frustrations do users experience?"
            />
          </Paper>

          {/* Business Intent */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Business Intent
            </Typography>

            <ArrayField
              label="Business Goals"
              items={formData.business_goals || []}
              onAdd={(value) => handleAddArrayItem('business_goals', value)}
              onRemove={(idx) => handleRemoveArrayItem('business_goals', idx)}
              placeholder="e.g., Increase revenue by 20%, Reduce churn"
            />

            <ArrayField
              label="Success Metrics"
              items={formData.success_metrics || []}
              onAdd={(value) => handleAddArrayItem('success_metrics', value)}
              onRemove={(idx) => handleRemoveArrayItem('success_metrics', idx)}
              placeholder="e.g., Conversion rate increases by 15%"
            />

            <ArrayField
              label="Constraints"
              items={formData.constraints || []}
              onAdd={(value) => handleAddArrayItem('constraints', value)}
              onRemove={(idx) => handleRemoveArrayItem('constraints', idx)}
              placeholder="e.g., Budget limit of $50k, Must launch by Q2"
            />

            <ArrayField
              label="Assumptions"
              items={formData.assumptions || []}
              onAdd={(value) => handleAddArrayItem('assumptions', value)}
              onRemove={(idx) => handleRemoveArrayItem('assumptions', idx)}
              placeholder="What are we assuming to be true?"
            />
          </Paper>

          {/* Outcomes */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Desired Outcomes
            </Typography>

            <ArrayField
              label="Outcomes"
              items={formData.desired_outcomes || []}
              onAdd={(value) => handleAddArrayItem('desired_outcomes', value)}
              onRemove={(idx) => handleRemoveArrayItem('desired_outcomes', idx)}
              placeholder="What will change when this is complete?"
            />

            <TextField
              fullWidth
              label="Mental Model Notes"
              multiline
              rows={4}
              value={formData.mental_model_notes || ''}
              onChange={(e) => setFormData({ ...formData, mental_model_notes: e.target.value })}
              helperText="Shared understanding and key insights"
              sx={{ mt: 3 }}
            />

            <TextField
              fullWidth
              label="Stakeholder Notes"
              multiline
              rows={3}
              value={formData.stakeholder_notes || ''}
              onChange={(e) => setFormData({ ...formData, stakeholder_notes: e.target.value })}
              helperText="Notes from stakeholder discussions"
              sx={{ mt: 3 }}
            />
          </Paper>
        </>
      )}
    </Container>
  );
}

// Array field component for reusable list editing
function ArrayField({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAdd(inputValue);
      setInputValue('');
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        {label}
      </Typography>
      
      {/* Existing items */}
      {items.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.5,
                backgroundColor: theme.palette.background.default,
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1, pt: 0.5 }}>
                {idx + 1}. {item}
              </Typography>
              <IconButton size="small" onClick={() => onRemove(idx)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Add new item */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAdd();
            }
          }}
          placeholder={placeholder}
        />
        <Button
          variant="outlined"
          onClick={handleAdd}
          startIcon={<AddCircleIcon />}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
