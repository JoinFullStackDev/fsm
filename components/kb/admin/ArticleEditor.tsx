'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setSummary(article.summary || '');
      setBody(article.body);
      setTags(article.tags || []);
      setCategoryId(article.category_id || '');
      setPublished(article.published);
    }
  }, [article]);

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

            <Box sx={{ flexGrow: 1, mb: 2 }}>
              <ReactQuill
                theme="snow"
                value={body}
                onChange={setBody}
                style={{ height: 'calc(100% - 42px)' }}
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

