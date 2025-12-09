'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardActionArea,
  Button,
  IconButton,
  Skeleton,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  published: boolean;
  tags?: string[];
  created_at: string;
  category?: {
    id: string;
    name: string;
    color?: string;
  } | null;
}

interface KBArticlesSliderProps {
  initialArticles?: KBArticle[];
}

/**
 * KBArticlesSlider Component
 * Displays a horizontal slider of knowledge base articles
 */
export default function KBArticlesSlider({ initialArticles }: KBArticlesSliderProps) {
  const theme = useTheme();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<KBArticle[]>(initialArticles || []);
  const [loading, setLoading] = useState(!initialArticles);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (initialArticles) return;

    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/kb/articles?limit=6&published=true');
        if (response.ok) {
          const data = await response.json();
          setArticles(data.articles || []);
        }
      } catch (err) {
        // Silently fail - KB might not be enabled
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [initialArticles]);

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, [articles]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollButtons, 300);
    }
  };

  const getExcerpt = (article: KBArticle): string => {
    if (article.excerpt) return article.excerpt;
    if (article.content) {
      // Strip HTML and truncate
      const text = article.content.replace(/<[^>]*>/g, '');
      return text.length > 100 ? text.substring(0, 100) + '...' : text;
    }
    return 'No description available';
  };

  // Don't render if KB is not available or no articles
  if (!loading && articles.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          mb: 4,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Skeleton variant="text" width={200} height={32} />
        <Box sx={{ display: 'flex', gap: 2, mt: 2, overflow: 'hidden' }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={280}
              height={140}
              sx={{ borderRadius: 1, flexShrink: 0 }}
            />
          ))}
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        mb: 4,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArticleIcon sx={{ color: theme.palette.text.secondary }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Knowledge Base
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            sx={{ color: theme.palette.text.secondary }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            sx={{ color: theme.palette.text.secondary }}
          >
            <ChevronRightIcon />
          </IconButton>
          <Button
            size="small"
            onClick={() => router.push('/kb')}
            sx={{ color: theme.palette.text.secondary, ml: 1 }}
          >
            View All
          </Button>
        </Box>
      </Box>

      <Box
        ref={scrollRef}
        onScroll={checkScrollButtons}
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          mx: -1,
          px: 1,
        }}
      >
        {articles.map((article) => (
          <Card
            key={article.id}
            sx={{
              minWidth: 280,
              maxWidth: 280,
              flexShrink: 0,
              backgroundColor: theme.palette.background.default,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                borderColor: theme.palette.text.primary,
              },
            }}
          >
            <CardActionArea
              onClick={() => router.push(`/kb/${article.slug}`)}
              sx={{ p: 2, height: '100%' }}
            >
              <Box sx={{ mb: 1 }}>
                {article.category && (
                  <Chip
                    label={article.category.name}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      backgroundColor: article.category.color
                        ? article.category.color + '20'
                        : theme.palette.action.hover,
                      color: article.category.color || theme.palette.text.secondary,
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  mb: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {article.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {getExcerpt(article)}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Paper>
  );
}

