'use client';
import type { WidgetDataset, WidgetSettings } from '@/types/database';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, useTheme } from '@mui/material';
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from '@mui/icons-material';

interface MetricWidgetProps {
  widgetId: string;
  dashboardId: string;
  dataset: WidgetDataset;
  settings?: WidgetSettings;
}

interface MetricData {
  value: number;
  label: string;
  change?: number;
  changeLabel?: string;
}

export default function MetricWidget({ widgetId, dashboardId, dataset, settings }: MetricWidgetProps) {
  const theme = useTheme();
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<string>('');

  // Create a stable key from dataset to prevent unnecessary refetches
  const dataSourceKey = `${dataset?.dataSource || dataset?.source || ''}`;
  const fetchKey = `${widgetId}-${dashboardId}-${dataSourceKey}`;

  useEffect(() => {
    // Only fetch if the key actually changed
    if (fetchKey === lastFetchRef.current) {
      return;
    }

    if (dataset?.dataSource || dataset?.source) {
      lastFetchRef.current = fetchKey;
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}/data`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load widget data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No data available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const displayValue = settings?.format === 'currency' 
    ? `$${data.value.toLocaleString()}`
    : settings?.format === 'percentage'
    ? `${data.value}%`
    : data.value.toLocaleString();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {data.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            {displayValue}
          </Typography>
          {data.change !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {data.change >= 0 ? (
                <TrendingUpIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
              )}
              <Typography
                variant="body2"
                sx={{
                  color: data.change >= 0 ? theme.palette.success.main : theme.palette.error.main,
                }}
              >
                {Math.abs(data.change)}%
              </Typography>
            </Box>
          )}
        </Box>
        {data.changeLabel && (
          <Typography variant="caption" color="text.secondary">
            {data.changeLabel}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

