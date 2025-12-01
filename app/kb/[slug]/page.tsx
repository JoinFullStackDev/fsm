'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  CircularProgress,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import ArticleViewer from '@/components/kb/ArticleViewer';
import RelatedArticles from '@/components/kb/RelatedArticles';
import type { KnowledgeBaseArticleWithCategory } from '@/types/kb';

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const { features, organization } = useOrganization();
  const slug = params.slug as string;
  const [article, setArticle] = useState<KnowledgeBaseArticleWithCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArticle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/kb/articles/by-slug/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Article not found');
        } else {
          throw new Error('Failed to load article');
        }
        return;
      }

      const data = await response.json();
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  const handleExportPDF = async () => {
    if (!article) return;

    try {
      const response = await fetch(`/api/kb/articles/${article.id}/export/pdf`, {
        method: 'POST',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${article.slug}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !article) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Article not found'}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/kb')}>
            <ArrowBackIcon />
          </IconButton>
          <Breadcrumbs>
            <Link href="/kb" color="inherit">
              Knowledge Base
            </Link>
            {article.category && (
              <Link href={`/kb?category=${article.category.id}`} color="inherit">
                {article.category.name}
              </Link>
            )}
            <Typography color="text.primary">{article.title}</Typography>
          </Breadcrumbs>
        </Box>

        <ArticleViewer article={article} onExportPDF={handleExportPDF} />

        <RelatedArticles
          articleId={article.id}
          organizationId={organization?.id || null}
        />
      </Container>
    </Box>
  );
}

