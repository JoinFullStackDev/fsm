'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  ChatBubble as ChatIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  FileDownload as ExportIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  total_views: number;
  total_searches: number;
  total_ai_queries: number;
  helpful_ratings: number;
  unhelpful_ratings: number;
  total_exports: number;
  top_articles: Array<{
    article_id: string;
    article_title: string;
    views: number;
  }>;
  search_queries: Array<{
    query: string;
    count: number;
  }>;
  daily_stats: Array<{
    date: string;
    views: number;
    searches: number;
    ai_queries: number;
    helpful: number;
    unhelpful: number;
    exports: number;
  }>;
  period: {
    start: string;
    end: string;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function KnowledgeBaseAnalyticsPage() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // days

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const response = await fetch(
        `/api/global/admin/kb/analytics?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/global/admin/kb')} sx={{ mb: 2 }}>
          Back to KB Admin
        </Button>
        <Alert severity="error">{error || 'Failed to load analytics'}</Alert>
      </Box>
    );
  }

  // Prepare chart data
  const actionTypeData = [
    { name: 'Views', value: data.total_views, icon: <ViewIcon /> },
    { name: 'Searches', value: data.total_searches, icon: <SearchIcon /> },
    { name: 'AI Queries', value: data.total_ai_queries, icon: <ChatIcon /> },
    { name: 'Helpful', value: data.helpful_ratings, icon: <ThumbUpIcon /> },
    { name: 'Unhelpful', value: data.unhelpful_ratings, icon: <ThumbDownIcon /> },
    { name: 'Exports', value: data.total_exports, icon: <ExportIcon /> },
  ];

  const pieData = [
    { name: 'Views', value: data.total_views },
    { name: 'Searches', value: data.total_searches },
    { name: 'AI Queries', value: data.total_ai_queries },
    { name: 'Helpful', value: data.helpful_ratings },
    { name: 'Unhelpful', value: data.unhelpful_ratings },
    { name: 'Exports', value: data.total_exports },
  ].filter((item) => item.value > 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/global/admin/kb')} sx={{ mb: 1 }}>
            Back to KB Admin
          </Button>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: '1.75rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Knowledge Base Analytics
          </Typography>
        </Box>
        <TextField
          select
          label="Date Range"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="7">Last 7 days</MenuItem>
          <MenuItem value="30">Last 30 days</MenuItem>
          <MenuItem value="90">Last 90 days</MenuItem>
          <MenuItem value="365">Last year</MenuItem>
        </TextField>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {actionTypeData.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {item.name}
                  </Typography>
                  <Box sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>
                    {item.icon}
                  </Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                  {item.value.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Daily Stats Line Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Activity Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data.daily_stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line type="monotone" dataKey="views" stroke="#0088FE" name="Views" strokeWidth={2} />
                <Line type="monotone" dataKey="searches" stroke="#00C49F" name="Searches" strokeWidth={2} />
                <Line type="monotone" dataKey="ai_queries" stroke="#FFBB28" name="AI Queries" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Action Type Distribution Pie Chart */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Action Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Ratings Bar Chart */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              User Ratings
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[{ name: 'Ratings', helpful: data.helpful_ratings, unhelpful: data.unhelpful_ratings }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="helpful" fill="#00C49F" name="Helpful" />
                <Bar dataKey="unhelpful" fill="#FF8042" name="Unhelpful" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Top Search Queries Bar Chart */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Top Search Queries
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.search_queries.slice(0, 10).reverse()}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="query" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Articles Table */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Top Articles by Views
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Article</TableCell>
                    <TableCell align="right">Views</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.top_articles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                        <Typography color="text.secondary">No article views in this period</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.top_articles.map((article, index) => (
                      <TableRow key={article.article_id} hover>
                        <TableCell>
                          <Chip label={index + 1} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {article.article_title}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <TrendingUpIcon fontSize="small" color="primary" />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {article.views.toLocaleString()}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Popular Search Queries
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Query</TableCell>
                    <TableCell align="right">Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.search_queries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ py: 2 }}>
                        <Typography color="text.secondary">No searches in this period</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.search_queries.slice(0, 10).map((query, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SearchIcon fontSize="small" color="action" />
                            <Typography variant="body2">{query.query}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {query.count.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
