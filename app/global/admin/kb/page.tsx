'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AutoAwesome as EmbeddingIcon,
  Article as ArticleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface EmbeddingStats {
  totalArticles: number;
  articlesWithEmbeddings: number;
  articlesWithoutEmbeddings: number;
  globalArticles: number;
  orgArticles: number;
}

interface GenerationResult {
  message: string;
  processed: number;
  succeeded: number;
  failed: number;
  article_ids?: string[];
}

export default function KnowledgeBaseAdminPage() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch stats from API
      const response = await fetch('/api/global/admin/kb/stats');
      if (!response.ok) {
        throw new Error('Failed to load KB stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading KB stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmbeddings = async (limit: number = 50) => {
    try {
      setGenerating(true);
      setError(null);
      setLastResult(null);

      const response = await fetch('/api/kb/articles/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate embeddings' }));
        throw new Error(errorData.message || 'Failed to generate embeddings');
      }

      const result: GenerationResult = await response.json();
      setLastResult(result);

      // Reload stats after generation
      await loadStats();
    } catch (err) {
      console.error('Error generating embeddings:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate embeddings');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const embeddingPercentage = stats
    ? Math.round((stats.articlesWithEmbeddings / stats.totalArticles) * 100)
    : 0;

  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        Knowledge Base Administration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {lastResult && (
        <Alert
          severity={lastResult.failed > 0 ? 'warning' : 'success'}
          sx={{ mb: 3 }}
          onClose={() => setLastResult(null)}
        >
          {lastResult.message}
          {lastResult.processed > 0 && (
            <>
              <br />
              Processed: {lastResult.processed} | Succeeded: {lastResult.succeeded} | Failed: {lastResult.failed}
            </>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Articles
                </Typography>
                <ArticleIcon sx={{ fontSize: 32, color: theme.palette.primary.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                {stats?.totalArticles || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  With Embeddings
                </Typography>
                <CheckCircleIcon sx={{ fontSize: 32, color: theme.palette.success.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                {stats?.articlesWithEmbeddings || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {embeddingPercentage}% complete
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Without Embeddings
                </Typography>
                <ErrorIcon sx={{ fontSize: 32, color: theme.palette.warning.main, opacity: 0.3 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                {stats?.articlesWithoutEmbeddings || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Embedding Generation Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Generate Embeddings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Embeddings are required for AI-powered semantic search in the knowledge base. 
              Generate embeddings for articles that don&apos;t have them yet. This is typically needed 
              after importing new articles.
            </Typography>

            {stats && stats.articlesWithoutEmbeddings > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {embeddingPercentage}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={embeddingPercentage}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<EmbeddingIcon />}
                onClick={() => handleGenerateEmbeddings(50)}
                disabled={generating || (stats?.articlesWithoutEmbeddings || 0) === 0}
                sx={{ minWidth: 200 }}
              >
                {generating ? 'Generating...' : 'Generate Embeddings (50)'}
              </Button>

              <Button
                variant="outlined"
                onClick={() => handleGenerateEmbeddings(100)}
                disabled={generating || (stats?.articlesWithoutEmbeddings || 0) === 0}
                sx={{ minWidth: 200 }}
              >
                Generate Embeddings (100)
              </Button>

              <Button
                variant="outlined"
                onClick={loadStats}
                disabled={generating}
              >
                Refresh Stats
              </Button>
            </Box>

            {generating && (
              <Box sx={{ mt: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography variant="body2" color="text.secondary" component="span">
                  Generating embeddings... This may take a few minutes.
                </Typography>
              </Box>
            )}

            {stats && stats.articlesWithoutEmbeddings === 0 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                All published articles have embeddings! No action needed.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Additional Info */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              About Embeddings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Embeddings are vector representations of article content that enable semantic search. 
              When users ask questions in the AI chat, the system uses embeddings to find the most 
              relevant articles based on meaning, not just keywords.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>When to generate embeddings:</strong>
            </Typography>
            <ul style={{ marginTop: 8, paddingLeft: 24, color: theme.palette.text.secondary }}>
              <li>After importing new articles via migration</li>
              <li>After bulk creating articles</li>
              <li>If AI search is not finding articles</li>
            </ul>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

