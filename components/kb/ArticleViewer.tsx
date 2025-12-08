'use client';

import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import ReactMarkdown from 'react-markdown';
// Note: react-syntax-highlighter may need to be installed: npm install react-syntax-highlighter @types/react-syntax-highlighter
// For now, using a simple code block renderer
import {
  Print as PrintIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import type { KnowledgeBaseArticleWithCategory } from '@/types/kb';

interface ArticleViewerProps {
  article: KnowledgeBaseArticleWithCategory;
  onExportPDF?: () => void;
}

export default function ArticleViewer({ article, onExportPDF }: ArticleViewerProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary || '',
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 4 }}>
      {/* Breadcrumbs removed - handled by parent page component */}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
            {article.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Print">
              <IconButton onClick={handlePrint} size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
            {onExportPDF && (
              <Tooltip title="Export PDF">
                <IconButton onClick={onExportPDF} size="small">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Share">
              <IconButton onClick={handleShare} size="small">
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {article.summary && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: '1.1rem' }}>
            {article.summary}
          </Typography>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {article.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        {/* Metadata */}
        <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
          {article.metadata?.reading_time && (
            <Typography variant="body2">
              {article.metadata.reading_time} min read
            </Typography>
          )}
          {article.metadata?.difficulty && (
            <Typography variant="body2">
              Difficulty: {article.metadata.difficulty}
            </Typography>
          )}
          <Typography variant="body2">
            Updated: {new Date(article.updated_at).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box
        sx={{
          '& p': { marginBottom: 2, lineHeight: 1.8 },
          '& ul, & ol': { marginLeft: 3, marginBottom: 2 },
          '& li': { marginBottom: 0.5 },
          '& h1': { marginTop: 4, marginBottom: 2, fontWeight: 600 },
          '& h2': { marginTop: 3, marginBottom: 1.5, fontWeight: 600 },
          '& h3': { marginTop: 2, marginBottom: 1, fontWeight: 600 },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            paddingLeft: 2,
            marginLeft: 0,
            fontStyle: 'italic',
            color: 'text.secondary',
          },
          '& code': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            padding: '2px 6px',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.9em',
          },
          '& pre': {
            backgroundColor: '#1e1e1e',
            borderRadius: 1,
            padding: 2,
            overflow: 'auto',
            marginBottom: 2,
          },
          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
            marginBottom: 2,
          },
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            padding: 1,
            textAlign: 'left',
          },
          '& th': {
            backgroundColor: 'action.hover',
            fontWeight: 600,
          },
        }}
      >
        <ReactMarkdown
          components={{
            code: (props: any) => {
              const { inline, className, children } = props;
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                >
                  <code className={className} {...props}>
                    {children}
                  </code>
                </Box>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {article.body}
        </ReactMarkdown>
      </Box>
    </Box>
  );
}

