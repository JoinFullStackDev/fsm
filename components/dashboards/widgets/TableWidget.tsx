'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
} from '@mui/material';

interface TableWidgetProps {
  widgetId: string;
  dashboardId: string;
  dataset: any;
  settings?: any;
}

interface TableData {
  columns: string[];
  rows: Record<string, any>[];
  total?: number;
}

export default function TableWidget({ widgetId, dashboardId, dataset, settings }: TableWidgetProps) {
  const theme = useTheme();
  const [data, setData] = useState<TableData | null>(null);
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

  if (!data || !data.columns || data.columns.length === 0) {
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

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {settings?.title && (
          <Typography variant="h6" gutterBottom>
            {settings.title}
          </Typography>
        )}
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: settings?.maxHeight || 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {data.columns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={data.columns.length} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No rows to display
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row, index) => (
                  <TableRow key={row.id || index} hover>
                    {data.columns.map((column) => (
                      <TableCell key={column}>{row[column] || '-'}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data.total !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing {data.rows.length} of {data.total} rows
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

