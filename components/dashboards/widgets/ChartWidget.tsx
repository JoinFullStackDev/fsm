'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartWidgetProps {
  widgetId: string;
  dashboardId: string;
  dataset: any;
  settings?: any;
}

interface ChartData {
  data: Array<{ name: string; value?: number; [key: string]: any }>;
  xAxis?: string;
  yAxis?: string;
  series?: Array<{ key: string; label: string }>; // For multi-series charts
}

const COLORS = ['#00E5FF', '#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#4CAF50', '#FFC107', '#FF9800'];

export default function ChartWidget({ widgetId, dashboardId, dataset, settings }: ChartWidgetProps) {
  const theme = useTheme();
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<string>('');

  // Create a stable key from dataset to prevent unnecessary refetches
  // Support both single dataSource and multiple dataSources
  const dataSourceKey = dataset?.dataSources 
    ? dataset.dataSources.sort().join(',')
    : `${dataset?.dataSource || dataset?.source || ''}`;
  const fetchKey = `${widgetId}-${dashboardId}-${dataSourceKey}`;

  useEffect(() => {
    // Only fetch if the key actually changed
    if (fetchKey === lastFetchRef.current) {
      return;
    }

    // Check if we have at least one data source (single or multiple)
    const hasDataSource = dataset?.dataSource || dataset?.source || 
      (Array.isArray(dataset?.dataSources) && dataset.dataSources.length > 0);

    // Always try to load data if we have a widgetId and dashboardId
    // The API will handle the case where there's no dataSource
    if (widgetId && dashboardId) {
      lastFetchRef.current = fetchKey;
      loadData();
    } else if (!hasDataSource) {
      // If there's no dataSource, set loading to false and show message
      setLoading(false);
      setError('No data source configured. Please configure the widget in edit mode.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, widgetId, dashboardId]);

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
      
      // Handle the response - it should have { data: { data: [...], xAxis?, yAxis? } }
      if (result.data) {
        // If result.data already has the chart data structure, use it directly
        if (result.data.data && Array.isArray(result.data.data)) {
          setChartData(result.data);
        } else if (Array.isArray(result.data)) {
          // If result.data is directly an array, wrap it
          setChartData({ data: result.data });
        } else {
          // Otherwise use result.data as-is
          setChartData(result.data);
        }
      } else {
        setChartData(null);
      }
    } catch (err) {
      console.error('[ChartWidget] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
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

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {error ? (
            <>
              <Typography variant="body2" color="error">
                {error}
              </Typography>
              {(!dataset?.dataSource && !dataset?.source && (!Array.isArray(dataset?.dataSources) || dataset.dataSources.length === 0)) && (
                <Typography variant="caption" color="text.secondary">
                  Please configure a data source in edit mode
                </Typography>
              )}
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                No data available
              </Typography>
              {(!dataset?.dataSource && !dataset?.source && (!Array.isArray(dataset?.dataSources) || dataset.dataSources.length === 0)) && (
                <Typography variant="caption" color="text.secondary">
                  Configure a data source in edit mode
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const chartType = settings?.chartType || dataset.chartType || 'line';
  const height = settings?.height || 300;
  const isMultiSeries = chartData.series && chartData.series.length > 1;
  const COLORS_MULTI = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={height}>
            <LineChart data={chartData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis 
                dataKey="name" 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <YAxis 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              />
              <Legend />
              {isMultiSeries ? (
                // Multiple series
                chartData.series!.map((series, index) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={COLORS_MULTI[index % COLORS_MULTI.length]}
                    strokeWidth={2}
                    dot={{ fill: COLORS_MULTI[index % COLORS_MULTI.length], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              ) : (
                // Single series
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ fill: theme.palette.primary.main, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={height}>
            <BarChart data={chartData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis 
                dataKey="name" 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <YAxis 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              />
              <Legend />
              {isMultiSeries ? (
                // Multiple series
                chartData.series!.map((series, index) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.label}
                    fill={COLORS_MULTI[index % COLORS_MULTI.length]}
                  />
                ))
              ) : (
                // Single series
                <Bar dataKey="value" fill={theme.palette.primary.main} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        // Pie charts only support single series - use first series if multiple
        const pieData = isMultiSeries && chartData.series && chartData.series.length > 0
          ? chartData.data.map((point: any) => ({
              name: point.name,
              value: point[chartData.series![0].key] || 0,
            }))
          : chartData.data;
        
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={height}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                 label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={Math.min(height * 0.3, 100)}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={height}>
            <AreaChart data={chartData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis 
                dataKey="name" 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <YAxis 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              />
              <Legend />
              {isMultiSeries ? (
                // Multiple series
                chartData.series!.map((series, index) => (
                  <Area
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={COLORS_MULTI[index % COLORS_MULTI.length]}
                    fill={COLORS_MULTI[index % COLORS_MULTI.length]}
                    fillOpacity={0.3}
                  />
                ))
              ) : (
                // Single series
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={theme.palette.primary.main}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.3}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <Typography variant="body2" color="text.secondary">
            Unknown chart type: {chartType}
          </Typography>
        );
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
        {settings?.title && (
          <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
            {settings.title}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
          {renderChart()}
        </Box>
      </CardContent>
    </Card>
  );
}

