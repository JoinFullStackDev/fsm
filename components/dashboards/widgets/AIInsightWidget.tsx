'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography, Box, CircularProgress, Button, useTheme,
} from '@mui/material';
import { Lightbulb as LightbulbIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';

interface AIInsightWidgetProps {
  widgetId: string;
  dashboardId: string;
  dataset: any;
  settings?: any;
}

export default function AIInsightWidget({ widgetId, dashboardId, dataset, settings }: AIInsightWidgetProps) {
  const theme = useTheme();
  const [insight, setInsight] = useState<string | null>(settings?.cachedInsight || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    // Initialize with cached insight if available - ALWAYS use cache if it exists
    if (settings?.cachedInsight) {
      setInsight(settings.cachedInsight);
      hasGeneratedRef.current = true; // Mark as initialized to prevent regeneration
      return;
    }

    // ONLY auto-generate if:
    // 1. autoGenerate is EXPLICITLY true (not just "not false")
    // 2. There's NO cached insight
    // 3. We haven't already initialized
    if (
      dataset.autoGenerate === true &&
      !hasGeneratedRef.current &&
      !settings?.cachedInsight
    ) {
      hasGeneratedRef.current = true;
      generateInsight(true); // Pass true to indicate this is initial generation
    } else {
      // Mark as initialized even if we're not generating
      hasGeneratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const generateInsight = async (saveToCache: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/dashboard/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_id: dashboardId,
          insight_type: dataset.insight_type || 'project_health',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insight');
      }

      const result = await response.json();
      const generatedInsight = result.insights;
      setInsight(generatedInsight);
      
      // If this is an initial generation or user clicked refresh, cache it
      if (saveToCache) {
        // Update widget settings to cache the insight
        await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataset,
            settings: { ...settings, cachedInsight: generatedInsight },
            position: {}, // Keep existing position
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LightbulbIcon color="primary" />
            <Typography variant="h6">
              {settings?.title || 'AI Insight'}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => generateInsight(true)}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Regenerate'}
          </Button>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}

          {insight && !loading && (
            <Box
              sx={{
                '& p': { marginBottom: 1 },
                '& ul, & ol': { marginLeft: 2, marginBottom: 1 },
                '& h1, & h2, & h3': { marginTop: 2, marginBottom: 1 },
              }}
            >
              <ReactMarkdown>{insight}</ReactMarkdown>
            </Box>
          )}

          {!insight && !loading && !error && (
            <Typography variant="body2" color="text.secondary">
              Click &quot;Regenerate&quot; to generate AI insights
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

