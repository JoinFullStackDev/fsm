'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  CheckCircle as CheckCircleIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
} from '@mui/icons-material';

// Generated template phases
const generatedPhases = [
  {
    number: 1,
    name: 'Discovery & Planning',
    tasks: ['Define project scope', 'Stakeholder interviews', 'Market research'],
    duration: '2 weeks',
  },
  {
    number: 2,
    name: 'Requirements & Design',
    tasks: ['User stories', 'Wireframes', 'Technical specifications'],
    duration: '3 weeks',
  },
  {
    number: 3,
    name: 'Development Sprint 1',
    tasks: ['Core authentication', 'Database schema', 'API foundation'],
    duration: '2 weeks',
  },
  {
    number: 4,
    name: 'Development Sprint 2',
    tasks: ['Feature implementation', 'Integration testing', 'UI polish'],
    duration: '2 weeks',
  },
  {
    number: 5,
    name: 'QA & Launch Prep',
    tasks: ['User acceptance testing', 'Performance optimization', 'Documentation'],
    duration: '1 week',
  },
];

const userPrompt = "Create an agile project template for a SaaS dashboard application with user authentication, real-time analytics, and team collaboration features.";

export default function InteractiveMockUI() {
  const theme = useTheme();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [hasStarted, setHasStarted] = useState(false);
  
  // Animation states
  const [typedPrompt, setTypedPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [visiblePhases, setVisiblePhases] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Start animation when scrolled into view
  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true);
      setIsTyping(true);
    }
  }, [isInView, hasStarted]);

  // Reset and restart animation
  const handleReanimate = () => {
    setTypedPrompt('');
    setIsTyping(true);
    setIsGenerating(false);
    setGenerationProgress(0);
    setVisiblePhases(0);
    setIsComplete(false);
    setHasStarted(true);
  };

  // Typing animation
  useEffect(() => {
    if (!isTyping || !hasStarted) return;

    const typingInterval = setInterval(() => {
      setTypedPrompt((prev) => {
        if (prev.length < userPrompt.length) {
          return userPrompt.slice(0, prev.length + 1);
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          // Start generation after a brief pause
          setTimeout(() => {
            setIsGenerating(true);
          }, 800);
          return prev;
        }
      });
    }, 30);

    return () => clearInterval(typingInterval);
  }, [isTyping, hasStarted]);

  // Generation animation
  useEffect(() => {
    if (!isGenerating) return;

    const generationInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(generationInterval);
          setIsGenerating(false);
          // Start showing phases
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => clearInterval(generationInterval);
  }, [isGenerating]);

  // Phase reveal animation
  useEffect(() => {
    if (generationProgress < 100 || isGenerating) return;

    const phaseInterval = setInterval(() => {
      setVisiblePhases((prev) => {
        if (prev >= generatedPhases.length) {
          clearInterval(phaseInterval);
          setIsComplete(true);
          return prev;
        }
        return prev + 1;
      });
    }, 400);

    return () => clearInterval(phaseInterval);
  }, [generationProgress, isGenerating]);

  return (
    <Box
      ref={ref}
      sx={{
        width: '100%',
        py: { xs: 4, md: 6 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <Box sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
          <Typography
            variant="h3"
            align="center"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              fontWeight: 700,
              mb: 1,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AI Template Generation
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4, maxWidth: '700px', mx: 'auto' }}
          >
            Describe your project, and AI creates a structured template with phases and tasks
          </Typography>
        </Box>

        {/* Main Animation Container */}
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: '900px',
            mx: 'auto',
            borderRadius: 3,
            overflow: 'hidden',
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          }}
        >
          {/* Replay Button */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              p: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            }}
          >
            <Tooltip title="Replay Animation" arrow>
              <IconButton
                onClick={handleReanimate}
                size="small"
                sx={{
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Content */}
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            {/* Step 1: User Prompt Input */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Your Prompt
                </Typography>
                {typedPrompt.length === userPrompt.length && !isTyping && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                  </motion.div>
                )}
              </Box>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.default, 0.5),
                  border: `1px solid ${isTyping ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
                  minHeight: 80,
                  display: 'flex',
                  alignItems: 'flex-start',
                  transition: 'border-color 0.3s',
                }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.primary',
                    lineHeight: 1.6,
                    flex: 1,
                  }}
                >
                  {typedPrompt}
                  {isTyping && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{ marginLeft: 2 }}
                    >
                      |
                    </motion.span>
                  )}
                </Typography>
                {typedPrompt.length === userPrompt.length && !isTyping && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ml: 2,
                      }}
                    >
                      <SendIcon sx={{ fontSize: 16, color: 'white' }} />
                    </Box>
                  </motion.div>
                )}
              </Box>
            </Box>

            {/* Step 2: AI Generation */}
            <AnimatePresence>
              {(isGenerating || generationProgress > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <motion.div
                        animate={isGenerating ? { rotate: 360 } : {}}
                        transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: 'linear' }}
                      >
                        <AIIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                      </motion.div>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {isGenerating ? 'Generating Template...' : 'Template Generated'}
                      </Typography>
                      {generationProgress === 100 && !isGenerating && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                        </motion.div>
                      )}
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={generationProgress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        },
                      }}
                    />
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: Generated Template Output */}
            <AnimatePresence>
              {visiblePhases > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Generated Phases
                      </Typography>
                      <Chip
                        label={`${visiblePhases}/${generatedPhases.length} phases`}
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>

                    {/* Phases Timeline */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {generatedPhases.slice(0, visiblePhases).map((phase, index) => (
                        <motion.div
                          key={phase.number}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 2,
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: alpha(theme.palette.primary.main, 0.03),
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.06),
                              },
                            }}
                          >
                            {/* Phase Number */}
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 2,
                                backgroundColor: theme.palette.primary.main,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
                                {phase.number}
                              </Typography>
                            </Box>

                            {/* Phase Content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {phase.name}
                                </Typography>
                                <Chip
                                  label={phase.duration}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    backgroundColor: alpha(theme.palette.text.secondary, 0.1),
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {phase.tasks.map((task, taskIndex) => (
                                  <motion.div
                                    key={task}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: taskIndex * 0.1 }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'text.secondary',
                                        backgroundColor: alpha(theme.palette.background.default, 0.8),
                                        px: 1,
                                        py: 0.25,
                                        borderRadius: 1,
                                        display: 'inline-block',
                                      }}
                                    >
                                      {task}
                                    </Typography>
                                  </motion.div>
                                ))}
                              </Box>
                            </Box>

                            {/* Check Icon */}
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.2 }}
                            >
                              <CheckCircleIcon sx={{ fontSize: 20, color: theme.palette.success.main }} />
                            </motion.div>
                          </Box>
                        </motion.div>
                      ))}
                    </Box>

                    {/* Completion Message */}
                    <AnimatePresence>
                      {isComplete && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Box
                            sx={{
                              mt: 2,
                              p: 2,
                              borderRadius: 2,
                              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                            }}
                          >
                            <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                                Template Ready!
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                5 phases • 15 tasks • Estimated 10 weeks
                              </Typography>
                            </Box>
                          </Box>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}
