'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
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
  Drawer,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import CategorySidebar from '@/components/kb/CategorySidebar';
import SearchBar from '@/components/kb/SearchBar';
import AIChatDrawer from '@/components/kb/AIChatDrawer';
import type { KnowledgeBaseArticleWithCategory, KnowledgeBaseCategoryWithChildren, SearchResult } from '@/types/kb';

function KnowledgeBaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { features, organization, loading: orgLoading } = useOrganization();
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
  const [categorySidebarOpen, setCategorySidebarOpen] = useState(false);
  const selectedCategoryId = searchParams.get('category');
  
  // Memoize selectedCategoryId to prevent unnecessary re-renders
  const memoizedCategoryId = useMemo(() => selectedCategoryId, [selectedCategoryId]);
  
  // Refs to prevent concurrent/duplicate requests
  const isLoadingCategoriesRef = useRef(false);
  const isLoadingArticlesRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastLoadKeyRef = useRef<string | null>(null);
  
  // Memoize knowledge base enabled check to prevent re-renders
  // Use the actual boolean value, not the object reference
  const isKnowledgeBaseEnabled = useMemo(() => {
    return features?.knowledge_base_enabled === true;
  }, [features?.knowledge_base_enabled]);
  
  // Track if we've already checked and loaded
  const hasCheckedAccessRef = useRef(false);
  const featuresProcessedRef = useRef<string | null>(null);
  // Circuit breaker to prevent infinite retries
  const retryCountRef = useRef(0);
  const maxRetries = 2; // Only retry twice, then stop
  const isCircuitOpenRef = useRef(false);
  // Track if we've initiated loading for this combination
  const loadingInitiatedRef = useRef<string | null>(null);

  const loadCategories = useCallback(async () => {
    // Circuit breaker: stop if circuit is open
    if (isCircuitOpenRef.current) {
      return;
    }
    
    // Prevent concurrent requests
    if (isLoadingCategoriesRef.current) {
      return;
    }
    
    try {
      isLoadingCategoriesRef.current = true;
      const response = await fetch('/api/kb/categories?include_counts=true', {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load categories' }));
        console.error('Error loading categories:', errorData);
        retryCountRef.current += 1;
        
        // Open circuit if too many retries
        if (retryCountRef.current >= maxRetries) {
          isCircuitOpenRef.current = true;
          setError('Failed to load knowledge base. Please refresh the page or contact support.');
          console.error('[KB Page] Circuit breaker opened - too many failures');
        } else if (!hasLoadedRef.current) {
          setError(errorData.error || 'Failed to load categories');
        }
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      retryCountRef.current += 1;
      
      // Open circuit if too many retries
      if (retryCountRef.current >= maxRetries) {
        isCircuitOpenRef.current = true;
        setError('Failed to load knowledge base. Please refresh the page or contact support.');
        console.error('[KB Page] Circuit breaker opened - too many failures');
      } else if (!hasLoadedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      }
    } finally {
      isLoadingCategoriesRef.current = false;
    }
  }, []);

  const loadArticles = useCallback(async () => {
    // Circuit breaker: stop if circuit is open
    if (isCircuitOpenRef.current) {
      setLoading(false);
      return;
    }
    
    // Prevent concurrent requests
    if (isLoadingArticlesRef.current) {
      return;
    }
    
    // Prevent duplicate loads - check if we've already loaded this exact combination
    const currentLoadKey = `${memoizedCategoryId || 'none'}-${page}`;
    
    // Check if we've already initiated loading for this key
    if (loadingInitiatedRef.current === currentLoadKey) {
      return;
    }
    
    // Check if we've already loaded this exact combination
    if (hasLoadedRef.current && lastLoadKeyRef.current === currentLoadKey) {
      return;
    }
    
    // Set the initiated key IMMEDIATELY to prevent duplicate calls
    loadingInitiatedRef.current = currentLoadKey;
    
    try {
      isLoadingArticlesRef.current = true;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '20',
        offset: String((page - 1) * 20),
        published: 'true',
      });

      if (memoizedCategoryId) {
        params.set('category_id', memoizedCategoryId);
      }

      // Shorter timeout to prevent hanging - 10 seconds
      const response = await fetch(`/api/kb/articles?${params}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load articles' }));
        throw new Error(errorData.error || `Failed to load articles (${response.status})`);
      }

      const data = await response.json();
      const articlesList = data.articles || [];
      const totalCount = data.pagination?.total || 0;
      
      // Mark as successfully loaded
      lastLoadKeyRef.current = currentLoadKey;
      hasLoadedRef.current = true;
      
      setArticles(articlesList);
      setTotalPages(Math.ceil(totalCount / 20));
      retryCountRef.current = 0; // Reset retry count on success
      
      // If no articles, this is a legitimate empty state, not an error
      // The guards above prevent re-renders
    } catch (err) {
      console.error('Error loading articles:', err);
      retryCountRef.current += 1;
      
      // Open circuit if too many retries
      if (retryCountRef.current >= maxRetries) {
        isCircuitOpenRef.current = true;
        setError('Failed to load knowledge base. The page may be experiencing issues. Please refresh or contact support.');
        console.error('[KB Page] Circuit breaker opened - too many failures');
      } else if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      }
    } finally {
      setLoading(false);
      isLoadingArticlesRef.current = false;
      // Clear the initiated flag only if we're done (success or circuit breaker)
      if (hasLoadedRef.current || isCircuitOpenRef.current) {
        // Keep loadingInitiatedRef set to prevent re-initiation
      }
    }
  }, [memoizedCategoryId, page]);

  useEffect(() => {
    // Circuit breaker: if circuit is open, don't do anything
    if (isCircuitOpenRef.current) {
      return;
    }

    // Early return if already processing to prevent duplicate calls
    if (isLoadingCategoriesRef.current || isLoadingArticlesRef.current) {
      return;
    }

    // Wait for organization context to finish loading
    if (orgLoading) {
      // Only set loading if we haven't initialized yet
      if (!hasInitializedRef.current) {
        setLoading(true);
      }
      return; // Still loading organization context
    }

    // Wait for features to be available
    if (features === null || features === undefined) {
      // Only set loading if we haven't initialized yet
      if (!hasInitializedRef.current) {
        setLoading(true);
      }
      return; // Features not loaded yet
    }

    // Create a stable key for the current features state
    const featuresKey = `${isKnowledgeBaseEnabled ? 'enabled' : 'disabled'}`;
    
    // Create a unique key for this combination of category and page
    const loadKey = `${memoizedCategoryId || 'none'}-${page}`;
    
    // If features haven't changed AND category/page haven't changed, skip
    if (featuresProcessedRef.current === featuresKey && 
        lastLoadKeyRef.current === loadKey && 
        hasInitializedRef.current) {
      // Already initialized with same parameters, don't reload
      return;
    }
    
    // If we've already loaded data (even if empty), only reload if category/page changed
    if (hasLoadedRef.current && lastLoadKeyRef.current === loadKey) {
      return; // Already loaded this category/page combination
    }

    // Debug logging removed - guards are working correctly

    // Update processed keys
    featuresProcessedRef.current = featuresKey;
    // Don't set lastLoadKeyRef here - let loadArticles set it to prevent race conditions

    // Check module access - only check once unless features change
    if (!isKnowledgeBaseEnabled) {
      if (!hasCheckedAccessRef.current) {
        router.push('/dashboard');
        setLoading(false);
        hasCheckedAccessRef.current = true;
      }
      return;
    }

    // Mark that we've checked access
    hasCheckedAccessRef.current = true;

    // Reset loaded flag when category or page changes
    if (memoizedCategoryId !== null || page !== 1) {
      hasLoadedRef.current = false;
    }

    // Mark as initialized
    hasInitializedRef.current = true;

    // Only load data if KB is enabled
    // Use setTimeout to ensure refs are set before calling load functions
    // This prevents race conditions where loadArticles might be called before hasLoadedRef is set
    setTimeout(() => {
      loadCategories();
      loadArticles();
    }, 0);
    // Note: loadCategories and loadArticles are stable useCallback functions,
    // so they don't need to be in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, isKnowledgeBaseEnabled, router, memoizedCategoryId, page]);

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

  // Memoize displayArticles to prevent unnecessary recalculations
  const displayArticles = useMemo(() => {
    return searchQuery ? searchResults.map(r => r.article) : articles;
  }, [searchQuery, searchResults, articles]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile: Category Sidebar as Drawer */}
      {isMobile ? (
        <Drawer
          open={categorySidebarOpen}
          onClose={() => setCategorySidebarOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
            },
          }}
        >
          <CategorySidebar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={(id) => {
              router.push(id ? `/kb?category=${id}` : '/kb');
              setCategorySidebarOpen(false);
            }}
          />
        </Drawer>
      ) : (
        /* Desktop: Category Sidebar always visible */
        <CategorySidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategorySelect={(id) => {
            router.push(id ? `/kb?category=${id}` : '/kb');
          }}
        />
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {/* Mobile: Categories toggle button */}
            {isMobile && (
              <IconButton
                onClick={() => setCategorySidebarOpen(true)}
                sx={{ border: 1, borderColor: 'divider' }}
              >
                <MenuIcon />
              </IconButton>
            )}
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

