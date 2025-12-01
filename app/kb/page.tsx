'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Pagination,
  Chip,
  IconButton,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import CategorySidebar from '@/components/kb/CategorySidebar';
import SearchBar from '@/components/kb/SearchBar';
import AIChatDrawer from '@/components/kb/AIChatDrawer';
import type { KnowledgeBaseArticleWithCategory, KnowledgeBaseCategoryWithChildren, SearchResult } from '@/types/kb';

function KnowledgeBaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { features, organization } = useOrganization();
  const [articles, setArticles] = useState<KnowledgeBaseArticleWithCategory[]>([]);
  const [categories, setCategories] = useState<KnowledgeBaseCategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const selectedCategoryId = searchParams.get('category');

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/categories?include_counts=true');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load categories' }));
        console.error('Error loading categories:', errorData);
        setError(errorData.error || 'Failed to load categories');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '20',
        offset: String((page - 1) * 20),
        published: 'true',
      });

      if (selectedCategoryId) {
        params.set('category_id', selectedCategoryId);
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/kb/articles?${params}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load articles' }));
        throw new Error(errorData.error || `Failed to load articles (${response.status})`);
      }

      const data = await response.json();
      const articlesList = data.articles || [];
      const totalCount = data.pagination?.total || 0;
      
      setArticles(articlesList);
      setTotalPages(Math.ceil(totalCount / 20));
      
      // Log for debugging
      console.log('[KB Page] Articles loaded:', {
        count: articlesList.length,
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / 20),
      });
    } catch (err) {
      console.error('Error loading articles:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, page]);

  useEffect(() => {
    // Wait for features to load before checking access
    if (features === null || features === undefined) {
      setLoading(true);
      return; // Still loading
    }

    // Check module access
    if (features.knowledge_base_enabled !== true) {
      router.push('/dashboard');
      setLoading(false);
      return;
    }

    loadCategories();
    loadArticles();
  }, [features, router, loadCategories, loadArticles]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      loadArticles();
      return;
    }

    setSearchQuery(query);
    setIsSearching(true);

    try {
      const response = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          published_only: true,
          limit: 50,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const displayArticles = searchQuery ? searchResults.map(r => r.article) : articles;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CategorySidebar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={(id) => {
          router.push(id ? `/kb?category=${id}` : '/kb');
        }}
      />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h4" sx={{ flexGrow: 1 }}>
              Knowledge Base
            </Typography>
            <IconButton
              onClick={() => setChatOpen(true)}
              color="primary"
              sx={{ border: 1, borderColor: 'divider' }}
            >
              <AIIcon />
            </IconButton>
          </Box>
          <SearchBar onSearch={handleSearch} />
        </Box>

        {/* Content */}
        <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && !error && (
            <>
              {displayArticles.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchQuery ? 'No articles found' : 'No articles yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery
                      ? 'Try a different search query'
                      : 'Articles will appear here once they are published'}
                  </Typography>
                </Box>
              ) : (
                <>
                  <Grid container spacing={3}>
                    {displayArticles.map((article) => (
                      <Grid item xs={12} md={6} key={article.id}>
                        <Card
                          sx={{
                            height: '100%',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4,
                            },
                          }}
                          onClick={() => router.push(`/kb/${article.slug}`)}
                        >
                          <CardContent>
                            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                              {article.title}
                            </Typography>
                            {article.summary && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 2 }}
                              >
                                {article.summary}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                              {article.tags?.slice(0, 3).map((tag) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                              ))}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(article.updated_at).toLocaleDateString()}
                              {article.metadata?.reading_time &&
                                ` • ${article.metadata.reading_time} min read`}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  {!searchQuery && totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, value) => setPage(value)}
                      />
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </Container>
      </Box>

      <AIChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        organizationId={organization?.id || null}
      />
    </Box>
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <KnowledgeBaseContent />
    </Suspense>
  );
}

