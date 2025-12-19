'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container, Box, Typography, Button, TextField, Card, CardContent,
  CircularProgress, Grid, Chip, IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Strategy, CreateStrategyInput } from '@/types/workspace-extended';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';

export default function StrategyPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [formData, setFormData] = useState<Partial<CreateStrategyInput>>({
    north_star_metric: '',
    north_star_definition: '',
    vision_statement: '',
    strategic_narrative: '',
    timeline_horizon: '',
    market_position: '',
    differentiation_strategy: '',
  });

  const loadStrategy = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/strategy`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setStrategy(data);
          setFormData({
            north_star_metric: data.north_star_metric || '',
            north_star_definition: data.north_star_definition || '',
            vision_statement: data.vision_statement || '',
            strategic_narrative: data.strategic_narrative || '',
            timeline_horizon: data.timeline_horizon || '',
            market_position: data.market_position || '',
            differentiation_strategy: data.differentiation_strategy || '',
          });
        }
      }
    } catch (err) {
      showError('Failed to load strategy');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/strategy`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({ ...formData, workspace_id: undefined }),
      });

      if (!response.ok) throw new Error('Failed to save strategy');

      showSuccess('Strategy saved');
      await loadStrategy();
    } catch (err) {
      showError('Failed to save strategy');
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
              Strategy Canvas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define your product strategy and north star
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {strategy && (
              <Chip label={`Version ${strategy.version}`} color="primary" />
            )}
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
            >
              Save New Version
            </Button>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* North Star */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                North Star
              </Typography>
              <TextField
                label="North Star Metric"
                placeholder="e.g., Weekly Active Users"
                value={formData.north_star_metric}
                onChange={(e) => setFormData({ ...formData, north_star_metric: e.target.value })}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Definition"
                multiline
                rows={2}
                value={formData.north_star_definition}
                onChange={(e) => setFormData({ ...formData, north_star_definition: e.target.value })}
                fullWidth
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Vision & Narrative */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Vision & Narrative
              </Typography>
              <TextField
                label="Vision Statement"
                multiline
                rows={3}
                value={formData.vision_statement}
                onChange={(e) => setFormData({ ...formData, vision_statement: e.target.value })}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Strategic Narrative"
                multiline
                rows={4}
                value={formData.strategic_narrative}
                onChange={(e) => setFormData({ ...formData, strategic_narrative: e.target.value })}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Timeline Horizon"
                placeholder="e.g., 12 months, 3 years"
                value={formData.timeline_horizon}
                onChange={(e) => setFormData({ ...formData, timeline_horizon: e.target.value })}
                fullWidth
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Competitive Positioning */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Competitive Positioning
              </Typography>
              <TextField
                label="Market Position"
                multiline
                rows={2}
                value={formData.market_position}
                onChange={(e) => setFormData({ ...formData, market_position: e.target.value })}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Differentiation Strategy"
                multiline
                rows={3}
                value={formData.differentiation_strategy}
                onChange={(e) => setFormData({ ...formData, differentiation_strategy: e.target.value })}
                fullWidth
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

