'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import ArticleEditor from '@/components/kb/admin/ArticleEditor';
import AITools from '@/components/kb/admin/AITools';
import VersionHistory from '@/components/kb/admin/VersionHistory';
import type { KnowledgeBaseArticle, KnowledgeBaseCategory } from '@/types/kb';

export default function ArticleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { features } = useOrganization();
  const articleId = params.id as string;
  const isNew = articleId === 'new';
  const [article, setArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [categories, setCategories] = useState<KnowledgeBaseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArticle = useCallback(async () => {
    try {
      setLoading(true);
      // First try by ID, then by slug
      const response = await fetch(`/api/kb/articles/${articleId}`);
      if (response.ok) {
        const data = await response.json();
        setArticle(data);
      } else {
        setError('Article not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/categories');
      if (response.ok) {
        const data = await response.json();
        // Flatten categories for select
        const flatten = (cats: any[]): KnowledgeBaseCategory[] => {
          const result: KnowledgeBaseCategory[] = [];
          cats.forEach((cat) => {
            result.push(cat);
            if (cat.children) {
              result.push(...flatten(cat.children));
            }
          });
          return result;
        };
        setCategories(flatten(data.categories || []));
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, []);

  useEffect(() => {
    if (!isNew) {
      loadArticle();
    } else {
      setLoading(false);
    }
    loadCategories();
  }, [isNew, loadArticle, loadCategories]);

  const handleSave = async (data: {
    title: string;
    slug: string;
    summary: string;
    body: string;
    tags: string[];
    category_id: string | null;
    published: boolean;
  }) => {
    setSaving(true);
    setError(null);

    try {
      const url = isNew ? '/api/kb/articles' : `/api/kb/articles/${articleId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save article');
      }

      const savedArticle = await response.json();
      setArticle(savedArticle);

      if (isNew) {
        router.push(`/kb/admin/articles/${savedArticle.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!article) return;
    await handleSave({
      ...article,
      summary: article.summary || '',
      published: true,
    });
  };

  const handleAIGenerateComplete = (data: any) => {
    setArticle((prev) => ({
      ...prev!,
      title: data.title,
      summary: data.summary,
      body: data.body,
      tags: data.tags,
    }));
  };

  const handleAIRewriteComplete = (data: any) => {
    setArticle((prev) => ({
      ...prev!,
      body: data.body,
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/kb/admin')}>
            Back
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
              <ArticleEditor
                article={article}
                categories={categories}
                onSave={handleSave}
                onPublish={handlePublish}
                mode={isNew ? 'create' : 'edit'}
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!isNew && article && (
                <>
                  <AITools
                    articleId={article.id}
                    onGenerateComplete={handleAIGenerateComplete}
                    onRewriteComplete={handleAIRewriteComplete}
                  />
                  <VersionHistory
                    articleId={article.id}
                    onRestore={async (version) => {
                      await handleSave({
                        ...article,
                        title: version.title,
                        summary: article.summary || '',
                        body: version.body,
                      });
                    }}
                  />
                </>
              )}
              {isNew && (
                <AITools onGenerateComplete={handleAIGenerateComplete} />
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

