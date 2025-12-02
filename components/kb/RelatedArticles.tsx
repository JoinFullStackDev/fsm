'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Link,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Article as ArticleIcon,
  Task as TaskIcon,
  Dashboard as DashboardIcon,
  Layers as PhaseIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { RelatedContent } from '@/types/kb';

interface RelatedArticlesProps {
  articleId: string;
  organizationId?: string | null;
}

export default function RelatedArticles({ articleId, organizationId }: RelatedArticlesProps) {
  const router = useRouter();
  const [relatedContent, setRelatedContent] = useState<RelatedContent | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRelatedContent = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/kb/articles/${articleId}/related`);
      if (response.ok) {
        const data = await response.json();
        setRelatedContent(data);
      }
    } catch (error) {
      console.error('Error loading related content:', error);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    loadRelatedContent();
  }, [loadRelatedContent]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!relatedContent || (
    (!relatedContent.articles || relatedContent.articles.length === 0) &&
    (!relatedContent.tasks || relatedContent.tasks.length === 0) &&
    (!relatedContent.dashboards || relatedContent.dashboards.length === 0) &&
    (!relatedContent.phases || relatedContent.phases.length === 0)
  )) {
    return null;
  }

  return (
    <Box sx={{ mt: 4, maxWidth: 900, mx: 'auto', px: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Related Content
      </Typography>

      {relatedContent.articles && relatedContent.articles.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ArticleIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Related Articles
              </Typography>
            </Box>
            <List>
              {relatedContent.articles.map((article) => (
                <ListItem
                  key={article.id}
                  button
                  onClick={() => router.push(`/kb/${article.slug}`)}
                >
                  <ListItemText
                    primary={article.title}
                    secondary={
                      <Chip
                        label={`${Math.round(article.similarity_score * 100)}% match`}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {relatedContent.tasks && relatedContent.tasks.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TaskIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Related Tasks
              </Typography>
            </Box>
            <List>
              {relatedContent.tasks.map((task) => (
                <ListItem
                  key={task.id}
                  button
                  onClick={() => router.push(`/project/${task.project_id}`)}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {task.title}
                      </Typography>
                      {task.project_name && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                          {task.project_name}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {task.matching_keywords && task.matching_keywords.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                        Matches:
                      </Typography>
                      {task.matching_keywords.map((keyword, idx) => (
                        <Chip
                          key={idx}
                          label={keyword}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            '& .MuiChip-label': {
                              px: 1,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {relatedContent.dashboards && relatedContent.dashboards.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DashboardIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Related Dashboards
              </Typography>
            </Box>
            <List>
              {relatedContent.dashboards.map((dashboard) => (
                <ListItem
                  key={dashboard.id}
                  button
                  onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                >
                  <ListItemText primary={dashboard.name} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {relatedContent.phases && relatedContent.phases.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PhaseIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Related Phases
              </Typography>
            </Box>
            <List>
              {relatedContent.phases.map((phase) => (
                <ListItem
                  key={phase.id}
                  button
                  onClick={() => router.push(`/project/${phase.project_id}/phase/${phase.phase_number}`)}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {phase.phase_name || `Phase ${phase.phase_number}`}
                      </Typography>
                      {phase.project_name && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                          {phase.project_name}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={`Phase ${phase.phase_number}`}
                      size="small"
                      sx={{
                        backgroundColor: 'action.hover',
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
                  {phase.matching_keywords && phase.matching_keywords.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                        Matches:
                      </Typography>
                      {phase.matching_keywords.map((keyword, idx) => (
                        <Chip
                          key={idx}
                          label={keyword}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            '& .MuiChip-label': {
                              px: 1,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

