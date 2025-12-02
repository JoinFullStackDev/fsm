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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Analytics as AnalyticsIcon,
  Search as SearchIcon,
  Article as ArticleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import type { KnowledgeBaseArticle, KnowledgeBaseArticleWithCategory } from '@/types/kb';

interface ArticleStats {
  total: number;
  published: number;
  drafts: number;
  global: number;
  org: number;
}

export default function ArticlesTab() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<KnowledgeBaseArticleWithCategory[]>([]);
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; article: KnowledgeBaseArticleWithCategory | null }>({
    open: false,
    article: null,
  });

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/global/admin/kb/articles?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load articles');
      }
      const data = await response.json();
      setArticles(data.articles || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Error loading articles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/global/admin/kb/stats');
      if (response.ok) {
        const data = await response.json();
        setStats({
          total: data.totalArticles || 0,
          published: data.publishedArticles || 0,
          drafts: (data.totalArticles || 0) - (data.publishedArticles || 0),
          global: data.globalArticles || 0,
          org: data.orgArticles || 0,
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleView = (article: KnowledgeBaseArticleWithCategory) => {
    if (article.published) {
      router.push(`/kb/${article.slug}`);
    } else {
      router.push(`/kb/admin/articles/${article.id}`);
    }
  };

  const handleEdit = (article: KnowledgeBaseArticleWithCategory) => {
    router.push(`/kb/admin/articles/${article.id}`);
  };

  const handleDelete = async () => {
    if (!deleteDialog.article) return;

    try {
      const response = await fetch(`/api/kb/articles/${deleteDialog.article.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      // Reset to first page if current page becomes empty after deletion
      const currentPageStart = (page - 1) * pageSize;
      if (currentPageStart >= total - 1 && page > 1) {
        setPage(page - 1);
      } else {
        await loadArticles();
      }
      await loadStats();
      setDeleteDialog({ open: false, article: null });
    } catch (err) {
      console.error('Error deleting article:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete article');
    }
  };

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  if (loading && articles.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Articles
                </Typography>
                <ArticleIcon sx={{ fontSize: 24, color: theme.palette.primary.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                {stats?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Published
                </Typography>
                <CheckCircleIcon sx={{ fontSize: 24, color: theme.palette.success.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                {stats?.published || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Drafts
                </Typography>
                <ScheduleIcon sx={{ fontSize: 24, color: theme.palette.warning.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                {stats?.drafts || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Global
                </Typography>
                <PublicIcon sx={{ fontSize: 24, color: theme.palette.info.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: theme.palette.info.main }}>
                {stats?.global || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              cursor: 'pointer',
              '&:hover': {
                boxShadow: theme.shadows[4],
              },
            }}
            onClick={() => router.push('/global/admin/kb/analytics')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  View Analytics
                </Typography>
                <AnalyticsIcon sx={{ fontSize: 24, color: theme.palette.secondary.main, opacity: 0.3 }} />
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AnalyticsIcon />}
                sx={{ mt: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/global/admin/kb/analytics');
                }}
              >
                Analytics
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Table */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search articles by title, summary, or slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No articles found matching your search' : 'No articles found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow key={article.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {article.title}
                    </Typography>
                    {article.summary && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {article.summary.substring(0, 60)}...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.category ? (
                      <Chip 
                        label={Array.isArray(article.category) ? article.category[0]?.name : article.category.name} 
                        size="small" 
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Uncategorized
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={article.published ? 'Published' : 'Draft'}
                      color={article.published ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={article.organization_id ? 'Organization' : 'Global'}
                      color={article.organization_id ? 'primary' : 'info'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(article.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleView(article)}
                      title={article.published ? 'View article' : 'Preview draft'}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleEdit(article)} title="Edit article">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteDialog({ open: true, article })}
                      title="Delete article"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {total > pageSize && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            pt: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Per Page</InputLabel>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                label="Per Page"
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.primary,
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme.palette.text.primary,
                  },
                }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={75}>75</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Pagination
            count={Math.ceil(total / pageSize)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                color: theme.palette.text.primary,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          />
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, article: null })}
      >
        <DialogTitle>Delete Article</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;{deleteDialog.article?.title}&quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, article: null })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
