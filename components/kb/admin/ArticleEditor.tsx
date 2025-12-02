'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Save as SaveIcon,
  Publish as PublishIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import type { KnowledgeBaseArticle, KnowledgeBaseCategory } from '@/types/kb';

// Dynamic import for markdown editor (avoid SSR issues)
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface ArticleEditorProps {
  article?: KnowledgeBaseArticle | null;
  categories: KnowledgeBaseCategory[];
  onSave: (data: {
    title: string;
    slug: string;
    summary: string;
    body: string;
    tags: string[];
    category_id: string | null;
    published: boolean;
  }) => Promise<void>;
  onPublish?: () => void;
  mode?: 'create' | 'edit';
}

export default function ArticleEditor({
  article,
  categories,
  onSave,
  onPublish,
  mode = 'create',
}: ArticleEditorProps) {
  const theme = useTheme();
  const [title, setTitle] = useState(article?.title || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [summary, setSummary] = useState(article?.summary || '');
  const [body, setBody] = useState(article?.body || '');
  const [tags, setTags] = useState<string[]>(article?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [categoryId, setCategoryId] = useState<string>(article?.category_id || '');
  const [published, setPublished] = useState(article?.published || false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (article) {
      const articleBody = article.body ?? '';
      setTitle(article.title || '');
      setSlug(article.slug || '');
      setSummary(article.summary || '');
      setBody(articleBody);
      setTags(article.tags || []);
      setCategoryId(article.category_id || '');
      setPublished(article.published || false);
      // Force ReactQuill to re-render when article changes by updating key
      setEditorKey((prev) => prev + 1);
    } else {
      // Reset to empty when article is null/undefined
      setTitle('');
      setSlug('');
      setSummary('');
      setBody('');
      setTags([]);
      setCategoryId('');
      setPublished(false);
      setEditorKey(0);
    }
  }, [article]);

  // Update Quill content directly when body changes (for cases where value prop doesn't work)
  useEffect(() => {
    if (body !== undefined && article && body) {
      // Use setTimeout to ensure Quill is fully initialized after key change
      const timer = setTimeout(() => {
        try {
          // Access Quill instance through DOM
          if (editorContainerRef.current) {
            const editorElement = editorContainerRef.current.querySelector('.ql-editor') as HTMLElement;
            if (editorElement) {
              // Try to get Quill instance from the editor element
              let quill = (editorElement as any).__quill;
              
              // If not found, try parent element
              if (!quill && editorElement.parentElement) {
                quill = (editorElement.parentElement as any).__quill;
              }

              if (quill && quill.root) {
                const currentContent = quill.root.innerHTML;
                const newBody = body || '';
                
                // Only update if content is different to avoid cursor position issues
                if (currentContent !== newBody && newBody !== '<p><br></p>' && newBody.trim() !== '') {
                  quill.clipboard.dangerouslyPasteHTML(newBody);
                }
              }
            }
          }
        } catch (err) {
          console.error('[ArticleEditor] Error updating Quill content:', err);
        }
      }, 200); // Delay to ensure Quill is ready
      
      return () => clearTimeout(timer);
    }
  }, [body, editorKey, article]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        slug: slug || generateSlug(title),
        summary,
        body,
        tags,
        category_id: categoryId || null,
        published,
      });
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slug || slug === article?.slug) {
              setSlug(generateSlug(e.target.value));
            }
          }}
          fullWidth
          required
        />
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label="Category"
          >
            <MenuItem value="">None</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />}
          label="Published"
        />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving || !title || !body}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {onPublish && (
          <Button
            variant="contained"
            color="success"
            startIcon={<PublishIcon />}
            onClick={onPublish}
            disabled={!published}
          >
            Publish
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={viewMode} onChange={(_, v) => setViewMode(v)}>
          <Tab label="Edit" value="edit" />
          <Tab label="Preview" value="preview" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {viewMode === 'edit' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
            <TextField
              label="Summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />

            <Box 
              ref={editorContainerRef}
              sx={{ 
                flexGrow: 1, 
                mb: 2,
                '& .quill': {
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                },
                '& .ql-toolbar': {
                  backgroundColor: theme.palette.background.paper,
                  borderTop: `1px solid ${theme.palette.divider}`,
                  borderLeft: `1px solid ${theme.palette.divider}`,
                  borderRight: `1px solid ${theme.palette.divider}`,
                  borderBottom: 'none',
                  '& .ql-stroke': {
                    stroke: theme.palette.text.primary,
                  },
                  '& .ql-fill': {
                    fill: theme.palette.text.primary,
                  },
                  '& .ql-picker-label': {
                    color: theme.palette.text.primary,
                  },
                  '& .ql-picker-options': {
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  },
                  '& button:hover, & button.ql-active': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
                '& .ql-container': {
                  backgroundColor: theme.palette.background.paper,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                  border: `1px solid ${theme.palette.divider}`,
                  borderTop: 'none',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  '& .ql-editor': {
                    color: theme.palette.text.primary,
                    flexGrow: 1,
                    minHeight: '200px',
                    '&::before': {
                      color: theme.palette.text.secondary,
                      fontStyle: 'normal',
                    },
                    '& p, & h1, & h2, & h3, & h4, & h5, & h6, & ul, & ol, & blockquote, & li': {
                      color: theme.palette.text.primary,
                    },
                    '& a': {
                      color: theme.palette.primary.main,
                    },
                    '& code': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      padding: '2px 4px',
                      borderRadius: 2,
                    },
                    '& pre': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      padding: '12px',
                      borderRadius: 4,
                    },
                    '& blockquote': {
                      borderLeft: `3px solid ${theme.palette.text.primary}`,
                      paddingLeft: '12px',
                      marginLeft: 0,
                      color: theme.palette.text.primary,
                    },
                  },
                },
              }}
            >
              <ReactQuill
                key={`editor-${article?.id || 'new'}-${editorKey}`}
                theme="snow"
                value={body || ''}
                onChange={setBody}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['blockquote', 'code-block'],
                    ['link', 'image'],
                    ['clean'],
                  ],
                }}
              />
            </Box>

            {/* Tags */}
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Press Enter to add tag"
                size="small"
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              {title || 'Untitled Article'}
            </Typography>
            {summary && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {summary}
              </Typography>
            )}
            <ReactMarkdown>{body || 'No content yet...'}</ReactMarkdown>
          </Box>
        )}
      </Box>
    </Box>
  );
}

