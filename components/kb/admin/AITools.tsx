'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import type { AIGenerateArticleOutput, AISummarizeOutput, AIRewriteOutput, AIGenerateFAQOutput } from '@/types/kb';

interface AIToolsProps {
  articleId?: string;
  onGenerateComplete?: (data: AIGenerateArticleOutput) => void;
  onSummarizeComplete?: (data: AISummarizeOutput) => void;
  onRewriteComplete?: (data: AIRewriteOutput) => void;
  onFAQComplete?: (data: AIGenerateFAQOutput) => void;
}

export default function AITools({
  articleId,
  onGenerateComplete,
  onSummarizeComplete,
  onRewriteComplete,
  onFAQComplete,
}: AIToolsProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateResult, setGenerateResult] = useState<AIGenerateArticleOutput | null>(null);

  // Summarize
  const [summarizeResult, setSummarizeResult] = useState<AISummarizeOutput | null>(null);

  // Rewrite
  const [rewriteStyle, setRewriteStyle] = useState<'clarity' | 'step-by-step' | 'developer-friendly'>('clarity');
  const [rewriteResult, setRewriteResult] = useState<AIRewriteOutput | null>(null);

  // FAQ
  const [faqResult, setFaqResult] = useState<AIGenerateFAQOutput | null>(null);

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/kb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatePrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate article');
      }

      const data = await response.json();
      setGenerateResult(data);
      onGenerateComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate article');
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!articleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/kb/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId }),
      });

      if (!response.ok) {
        throw new Error('Failed to summarize article');
      }

      const data = await response.json();
      setSummarizeResult(data);
      onSummarizeComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize article');
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!articleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/kb/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, style: rewriteStyle }),
      });

      if (!response.ok) {
        throw new Error('Failed to rewrite article');
      }

      const data = await response.json();
      setRewriteResult(data);
      onRewriteComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rewrite article');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFAQ = async () => {
    if (!articleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/kb/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate FAQ');
      }

      const data = await response.json();
      setFaqResult(data);
      onFAQComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate FAQ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AIIcon color="primary" />
        <Typography variant="h6">AI Tools</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Generate" />
        <Tab label="Summarize" disabled={!articleId} />
        <Tab label="Rewrite" disabled={!articleId} />
        <Tab label="FAQ" disabled={!articleId} />
      </Tabs>

      {tab === 0 && (
        <Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Prompt"
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="Describe the article you want to generate..."
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={loading || !generatePrompt.trim()}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Generate Article'}
          </Button>
          {generateResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Generated Content:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="h6">{generateResult.title}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {generateResult.summary}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {generateResult.tags.map((tag) => (
                    <Typography key={tag} variant="caption" sx={{ mr: 1 }}>
                      #{tag}
                    </Typography>
                  ))}
                </Box>
              </Paper>
            </Box>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Button
            variant="contained"
            onClick={handleSummarize}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Generate Summary'}
          </Button>
          {summarizeResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">TL;DR:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {summarizeResult.tldr}
              </Typography>
              <Typography variant="subtitle2">Summary:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {summarizeResult.summary}
              </Typography>
              <Typography variant="subtitle2">Key Points:</Typography>
              <ul>
                {summarizeResult.key_points.map((point, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">{point}</Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <TextField
            select
            fullWidth
            label="Style"
            value={rewriteStyle}
            onChange={(e) => setRewriteStyle(e.target.value as any)}
            sx={{ mb: 2 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="clarity">Clarity</option>
            <option value="step-by-step">Step-by-Step</option>
            <option value="developer-friendly">Developer-Friendly</option>
          </TextField>
          <Button
            variant="contained"
            onClick={handleRewrite}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Rewrite Article'}
          </Button>
          {rewriteResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{rewriteResult.changes_summary}</Typography>
            </Box>
          )}
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Button
            variant="contained"
            onClick={handleGenerateFAQ}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Generate FAQ'}
          </Button>
          {faqResult && (
            <Box sx={{ mt: 2 }}>
              {faqResult.faqs.map((faq, idx) => (
                <Accordion key={idx}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">{faq.question}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">{faq.answer}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

