'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Paper,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface SavedSummary {
  id: string;
  summary: string;
  title: string | null;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface AISummarySheetProps {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

// Quotes for loading animation
const quotes = [
  "The way to get started is to quit talking and begin doing. - Walt Disney",
  "Innovation distinguishes between a leader and a follower. - Steve Jobs",
  "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
  "It is during our darkest moments that we must focus to see the light. - Aristotle",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "If you can dream it, you can do it. - Walt Disney",
  "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big things happen.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "The key to success is to focus on goals, not obstacles.",
  "Dream it. Believe it. Build it.",
  "The journey of a thousand miles begins with one step. - Lao Tzu",
  "Believe you can and you're halfway there. - Theodore Roosevelt",
];

export default function AISummarySheet({ open, projectId, projectName, onClose }: AISummarySheetProps) {
  const theme = useTheme();
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<SavedSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Building blocks configuration
  const blocks = [
    { height: 40, delay: 0 },
    { height: 60, delay: 0.1 },
    { height: 80, delay: 0.2 },
    { height: 50, delay: 0.3 },
    { height: 70, delay: 0.4 },
    { height: 90, delay: 0.5 },
    { height: 55, delay: 0.6 },
    { height: 75, delay: 0.7 },
  ];

  // Auto-advance quotes every 5 seconds while loading
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [loading]);

  const loadSavedSummaries = async () => {
    setLoadingSummaries(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/dashboard/summary`);
      if (response.ok) {
        const data = await response.json();
        setSavedSummaries(data.summaries || []);
        // Auto-select the most recent summary if available
        if (data.summaries?.length > 0 && !selectedSummary) {
          setSelectedSummary(data.summaries[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load saved summaries:', err);
    } finally {
      setLoadingSummaries(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedSummary?.summary) return;
    try {
      await navigator.clipboard.writeText(selectedSummary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setShowHistory(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/dashboard/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      const newSummary: SavedSummary = {
        id: data.id,
        summary: data.summary,
        title: null,
        created_at: data.generatedAt,
        user: null, // Current user, will be populated on refresh
      };
      setSelectedSummary(newSummary);
      // Refresh the list to include the new summary
      loadSavedSummaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (summaryId: string) => {
    setDeleting(summaryId);
    try {
      const response = await fetch(`/api/projects/${projectId}/dashboard/summary?summaryId=${summaryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }

      // Remove from list
      setSavedSummaries(prev => prev.filter(s => s.id !== summaryId));
      
      // If deleted summary was selected, select the next one
      if (selectedSummary?.id === summaryId) {
        const remaining = savedSummaries.filter(s => s.id !== summaryId);
        setSelectedSummary(remaining[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete summary:', err);
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    if (open) {
      loadSavedSummaries();
    }
    // Reset when closed
    if (!open) {
      setSelectedSummary(null);
      setError(null);
      setCopied(false);
      setShowHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const quoteVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' as const } },
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '90%', md: '80%', lg: '70%' },
          maxWidth: '900px',
          backgroundColor: theme.palette.background.default,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 60px)' }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                AI Project Summary
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {projectName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={showHistory ? 'contained' : 'outlined'}
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
              sx={{
                borderColor: theme.palette.text.primary,
                color: showHistory ? '#1a1a1a' : theme.palette.text.primary,
                backgroundColor: showHistory ? theme.palette.primary.main : 'transparent',
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: showHistory ? theme.palette.primary.light : theme.palette.action.hover,
                },
              }}
            >
              History ({savedSummaries.length})
            </Button>
            <Button
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={handleCopy}
              disabled={!selectedSummary || loading}
              sx={{
                borderColor: copied ? theme.palette.success.main : theme.palette.text.primary,
                color: copied ? theme.palette.success.main : theme.palette.text.primary,
                '&:hover': {
                  borderColor: copied ? theme.palette.success.main : theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
              onClick={generateSummary}
              disabled={loading}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              New Summary
            </Button>
            <IconButton
              onClick={onClose}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* History Sidebar */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden', borderRight: `1px solid ${theme.palette.divider}` }}
              >
                <Box
                  sx={{
                    width: 280,
                    height: '100%',
                    overflow: 'auto',
                    backgroundColor: theme.palette.background.paper,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      px: 2,
                      py: 1.5,
                      color: theme.palette.text.secondary,
                      fontWeight: 600,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    Saved Summaries
                  </Typography>
                  {loadingSummaries ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : savedSummaries.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{
                        p: 2,
                        color: theme.palette.text.secondary,
                        textAlign: 'center',
                      }}
                    >
                      No summaries yet. Generate your first summary!
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {savedSummaries.map((summary, index) => (
                        <ListItem
                          key={summary.id}
                          disablePadding
                          sx={{
                            borderBottom: index < savedSummaries.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          }}
                        >
                          <ListItemButton
                            selected={selectedSummary?.id === summary.id}
                            onClick={() => {
                              setSelectedSummary(summary);
                              setShowHistory(false);
                            }}
                            sx={{
                              py: 1.5,
                              '&.Mui-selected': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                              },
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: selectedSummary?.id === summary.id ? 600 : 400,
                                    color: theme.palette.text.primary,
                                  }}
                                >
                                  {formatDate(summary.created_at)}
                                </Typography>
                              }
                              secondary={
                                <Typography
                                  variant="caption"
                                  sx={{ color: theme.palette.text.secondary }}
                                >
                                  {summary.user?.name || summary.user?.email || 'Unknown'}
                                </Typography>
                              }
                            />
                            <ListItemSecondaryAction>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(summary.id);
                                }}
                                disabled={deleting === summary.id}
                                sx={{
                                  color: theme.palette.error.main,
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                                  },
                                }}
                              >
                                {deleting === summary.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <DeleteIcon fontSize="small" />
                                )}
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: { xs: 2, md: 4 },
              backgroundColor: theme.palette.background.default,
            }}
          >
            {/* Loading Animation with Quotes */}
            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  gap: 4,
                }}
              >
                {/* Building Blocks Animation */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 2,
                    height: 120,
                    position: 'relative',
                  }}
                >
                  {blocks.map((block, index) => (
                    <motion.div
                      key={index}
                      animate={{
                        y: [0, -10, 0],
                        opacity: [1, 0.8, 1],
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        delay: index * 0.1,
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{
                        width: 30,
                        height: block.height,
                        backgroundColor: theme.palette.primary.main,
                        borderRadius: '4px',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                        position: 'relative',
                      }}
                    >
                      {/* Subtle shine effect */}
                      <motion.div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '30%',
                          background: `linear-gradient(to bottom, ${alpha('#fff', 0.3)}, transparent)`,
                          borderRadius: '4px 4px 0 0',
                        }}
                        animate={{
                          opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: index * 0.2,
                        }}
                      />
                    </motion.div>
                  ))}
                </Box>

                {/* Text */}
                <Typography
                  variant="h6"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    fontSize: '1.5rem',
                  }}
                >
                  Generating Summary...
                </Typography>

                {/* Quote Slider */}
                <Box
                  sx={{
                    maxWidth: '600px',
                    width: '100%',
                    minHeight: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQuoteIndex}
                      variants={quoteVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      style={{
                        textAlign: 'center',
                        width: '100%',
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          color: theme.palette.text.secondary,
                          fontStyle: 'italic',
                          fontSize: '1rem',
                          px: 2,
                        }}
                      >
                        &ldquo;{quotes[currentQuoteIndex]}&rdquo;
                      </Typography>
                    </motion.div>
                  </AnimatePresence>
                </Box>
              </Box>
            )}

            {error && !loading && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              >
                {error}
              </Alert>
            )}

            {/* No summaries state */}
            {!loading && !selectedSummary && savedSummaries.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  gap: 2,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, opacity: 0.5 }} />
                <Typography variant="h6" sx={{ color: theme.palette.text.secondary }}>
                  No summaries yet
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                  Generate your first AI summary to get insights about your project.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={generateSummary}
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light,
                    },
                  }}
                >
                  Generate Summary
                </Button>
              </Box>
            )}

            {selectedSummary && !loading && (
              <Paper
                sx={{
                  p: 4,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontStyle: 'italic',
                    }}
                  >
                    Generated on {formatDate(selectedSummary.created_at)}
                    {selectedSummary.user && ` by ${selectedSummary.user.name || selectedSummary.user.email}`}
                  </Typography>
                  {savedSummaries.length > 1 && (
                    <Chip
                      label={`${savedSummaries.findIndex(s => s.id === selectedSummary.id) + 1} of ${savedSummaries.length}`}
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  )}
                </Box>
                <Divider sx={{ mb: 3 }} />
                <Box
                  sx={{
                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                      color: theme.palette.text.primary,
                      fontWeight: 600,
                      mt: 3,
                      mb: 1.5,
                    },
                    '& h1': { fontSize: '1.75rem' },
                    '& h2': { fontSize: '1.5rem' },
                    '& h3': { fontSize: '1.25rem' },
                    '& p': {
                      color: theme.palette.text.primary,
                      lineHeight: 1.7,
                      mb: 1.5,
                    },
                    '& ul, & ol': {
                      color: theme.palette.text.primary,
                      pl: 3,
                      mb: 1.5,
                    },
                    '& li': {
                      mb: 0.5,
                    },
                    '& strong': {
                      color: theme.palette.text.primary,
                      fontWeight: 600,
                    },
                    '& code': {
                      backgroundColor: alpha(theme.palette.text.primary, 0.1),
                      padding: '2px 6px',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.9em',
                    },
                    '& pre': {
                      backgroundColor: alpha(theme.palette.text.primary, 0.05),
                      padding: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      mb: 1.5,
                    },
                  }}
                >
                  <ReactMarkdown>{selectedSummary.summary}</ReactMarkdown>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
