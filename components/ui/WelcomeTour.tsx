'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  IconButton,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  RocketLaunch as RocketLaunchIcon,
  AutoAwesome as AutoAwesomeIcon,
  Build as BuildIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Keyboard as KeyboardIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

interface TourStep {
  title: string;
  description: string;
  content: React.ReactNode;
  icon: React.ReactNode;
  mockComponent: React.ReactNode;
}

interface WelcomeTourProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Animated mock components
const MockDashboard = ({ theme }: { theme: any }) => {
  const [highlighted, setHighlighted] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlighted((prev) => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { label: 'Projects', count: '12', icon: <FolderIcon /> },
    { label: 'Templates', count: '5', icon: <BuildIcon /> },
  ];

  const projects = [
    { name: 'My First Project', status: 'In Progress', progress: 65 },
    { name: 'Product Launch', status: 'Planning', progress: 30 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        {/* Animated background gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`,
            pointerEvents: 'none',
          }}
        />
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, position: 'relative', zIndex: 1 }}>
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: highlighted === index ? 1.05 : 1,
                boxShadow: highlighted === index 
                  ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                  : 'none',
              }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.5,
                repeat: highlighted === index ? Infinity : 0,
                repeatType: 'reverse',
              }}
            >
              <Card
                sx={{
                  flex: 1,
                  backgroundColor: highlighted === index 
                    ? alpha(theme.palette.primary.main, 0.1)
                    : theme.palette.action.hover,
                  border: `2px solid ${
                    highlighted === index 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  borderRadius: 2,
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {card.icon}
                  <Typography variant="caption" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    {card.label}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 700 }}>
                  {card.count}
                </Typography>
              </Card>
            </motion.div>
          ))}
        </Box>
        
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {projects.map((project, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                borderColor: highlighted === index + 2 
                  ? theme.palette.primary.main 
                  : theme.palette.divider,
              }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
            >
              <Card
                sx={{
                  mb: 2,
                  backgroundColor: theme.palette.action.hover,
                  border: `2px solid ${
                    highlighted === index + 2 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  borderRadius: 2,
                  p: 2,
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    {project.name}
                  </Typography>
                  <Chip 
                    label={project.status} 
                    size="small" 
                    sx={{ 
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      color: theme.palette.text.primary,
                      fontSize: '0.7rem',
                    }} 
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={project.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: theme.palette.primary.main,
                      borderRadius: 3,
                    },
                  }}
                />
              </Card>
            </motion.div>
          ))}
        </Box>
      </Box>
    </motion.div>
  );
};

const MockTemplateBuilder = ({ theme }: { theme: any }) => {
  const fields = ['Project Name', 'Description', 'Category'];
  const [typing, setTyping] = useState('');
  const [fieldIndex, setFieldIndex] = useState(0);
  const [activePhase, setActivePhase] = useState(0);
  
  useEffect(() => {
    let charIndex = 0;
    let currentField = fields[0];
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentField.length) {
        setTyping(currentField.substring(0, charIndex + 1));
        charIndex++;
      } else {
        setTimeout(() => {
          setFieldIndex((i) => {
            const nextIndex = (i + 1) % fields.length;
            currentField = fields[nextIndex];
            charIndex = 0;
            setTyping('');
            return nextIndex;
          });
        }, 1000);
      }
    }, 100);
    
    return () => clearInterval(typeInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => (p + 1) % 6);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const phases = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BuildIcon sx={{ fontSize: 18 }} />
            Template Builder
          </Typography>
          <motion.div
            key={fieldIndex}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                borderRadius: 2,
                border: `2px solid ${theme.palette.primary.main}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontFamily: 'monospace' }}>
                {typing || fields[fieldIndex]}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 16,
                    backgroundColor: theme.palette.text.primary,
                    marginLeft: 4,
                  }}
                />
              </Typography>
            </Box>
          </motion.div>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {phases.map((phase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                backgroundColor: activePhase === index 
                  ? alpha(theme.palette.primary.main, 0.2)
                  : theme.palette.action.hover,
                borderColor: activePhase === index 
                  ? theme.palette.primary.main 
                  : theme.palette.divider,
              }}
              transition={{ 
                delay: index * 0.05,
                duration: 0.3,
              }}
            >
              <Chip 
                label={phase} 
                size="small" 
                sx={{ 
                  backgroundColor: activePhase === index 
                    ? alpha(theme.palette.primary.main, 0.2)
                    : theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  border: `2px solid ${
                    activePhase === index 
                      ? theme.palette.primary.main 
                      : theme.palette.divider
                  }`,
                  fontWeight: activePhase === index ? 600 : 400,
                  transition: 'all 0.3s ease',
                }} 
              />
            </motion.div>
          ))}
        </Box>
      </Box>
    </motion.div>
  );
};

const MockProjectForm = ({ theme }: { theme: any }) => {
  const [focused, setFocused] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFocused((f) => (f + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
            Project Name
          </Typography>
          <motion.div
            animate={{
              borderColor: focused === 0 ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: focused === 0 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                borderRadius: 2,
                border: `2px solid ${focused === 0 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                transition: 'all 0.3s ease',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                My New Project
              </Typography>
            </Box>
          </motion.div>
        </Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block', fontWeight: 500 }}>
            Template
          </Typography>
          <motion.div
            animate={{
              borderColor: focused === 1 ? theme.palette.primary.main : theme.palette.divider,
              backgroundColor: focused === 1 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                height: 40,
                borderRadius: 2,
                border: `2px solid ${focused === 1 ? theme.palette.primary.main : theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                Select Template...
              </Typography>
              <PlayArrowIcon sx={{ fontSize: 18, color: theme.palette.text.primary }} />
            </Box>
          </motion.div>
        </Box>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{
            backgroundColor: focused === 2 
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            color: focused === 2 
              ? theme.palette.background.default
              : theme.palette.text.primary,
          }}
          transition={{ duration: 0.3 }}
        >
          <Button
            size="medium"
            variant="contained"
            fullWidth
            sx={{
              backgroundColor: focused === 2 
                ? theme.palette.primary.main
                : theme.palette.background.paper,
              color: focused === 2 
                ? theme.palette.background.default
                : theme.palette.text.primary,
              border: `2px solid ${focused === 2 ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
              transition: 'all 0.3s ease',
              '&:hover': { 
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.background.default,
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            Create Project
          </Button>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const MockProjectDashboard = ({ theme }: { theme: any }) => {
  const [activePhase, setActivePhase] = useState(0);
  const [progressValues, setProgressValues] = useState([100, 80, 60, 40, 20, 0]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => {
        const next = (p + 1) % 6;
        // Animate progress when phase becomes active
        setProgressValues((prev) => {
          const newValues = [...prev];
          if (next < prev.length) {
            newValues[next] = Math.min(prev[next] + 5, 100);
          }
          return newValues;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const phases = [
    { name: 'Concept Framing', icon: <RocketLaunchIcon sx={{ fontSize: 16 }} /> },
    { name: 'Product Strategy', icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} /> },
    { name: 'Rapid Prototype', icon: <BuildIcon sx={{ fontSize: 16 }} /> },
    { name: 'Analysis', icon: <DescriptionIcon sx={{ fontSize: 16 }} /> },
    { name: 'Build Accelerator', icon: <CodeIcon sx={{ fontSize: 16 }} /> },
    { name: 'QA & Hardening', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <DashboardIcon sx={{ fontSize: 20 }} />
          Project Phases
        </Typography>
        {phases.map((phase, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: index === activePhase ? 1 : 0.5,
              x: 0,
              scale: index === activePhase ? 1.02 : 1,
            }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.4,
            }}
          >
            <Card
              sx={{
                mb: 2,
                backgroundColor: index === activePhase 
                  ? alpha(theme.palette.primary.main, 0.1)
                  : theme.palette.action.hover,
                border: `2px solid ${
                  index === activePhase 
                    ? theme.palette.primary.main 
                    : theme.palette.divider
                }`,
                borderRadius: 2,
                p: 2,
                transition: 'all 0.3s ease',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {phase.icon}
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: index === activePhase ? 600 : 400 }}>
                    {phase.name}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {progressValues[index]}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressValues[index]}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: index === activePhase 
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    borderRadius: 4,
                  },
                }}
              />
            </Card>
          </motion.div>
        ))}
      </Box>
    </motion.div>
  );
};

const MockExportDialog = ({ theme }: { theme: any }) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setExporting((e) => !e);
      if (!exporting) {
        setProgress(0);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [exporting]);

  useEffect(() => {
    if (exporting) {
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 100));
      }, 200);
      return () => clearInterval(progressInterval);
    }
  }, [exporting]);

  const files = [
    { name: 'phase-1.json', icon: <DescriptionIcon /> },
    { name: 'phase-2.json', icon: <DescriptionIcon /> },
    { name: 'cursor-prompt.md', icon: <CodeIcon /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <DownloadIcon sx={{ fontSize: 20 }} />
          Export Blueprint Bundle
        </Typography>
        <Box sx={{ mb: 3 }}>
          <motion.div
            animate={{
              backgroundColor: exporting 
                ? alpha(theme.palette.primary.main, 0.1)
                : theme.palette.action.hover,
              borderColor: exporting 
                ? theme.palette.primary.main 
                : theme.palette.divider,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                p: 2,
                border: `2px solid ${exporting ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FolderIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, flex: 1 }}>
                  blueprint-bundle.zip
                </Typography>
                {exporting && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  </motion.div>
                )}
              </Box>
              {exporting && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    mt: 2,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: theme.palette.primary.main,
                      borderRadius: 3,
                    },
                  }}
                />
              )}
            </Card>
          </motion.div>
          <Box sx={{ pl: 1 }}>
            {files.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                  <Box sx={{ color: theme.palette.text.secondary }}>
                    {file.icon}
                  </Box>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {file.name}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Box>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            size="medium"
            variant="contained"
            fullWidth
            startIcon={<DownloadIcon />}
            sx={{
              backgroundColor: exporting 
                ? theme.palette.primary.main
                : theme.palette.background.paper,
              color: exporting 
                ? theme.palette.background.default
                : theme.palette.text.primary,
              border: `2px solid ${exporting ? theme.palette.primary.main : theme.palette.divider}`,
              fontWeight: 600,
              py: 1.5,
              transition: 'all 0.3s ease',
              '&:hover': { 
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.background.default,
                borderColor: theme.palette.primary.main,
              },
            }}
          >
            {exporting ? `Exporting... ${progress}%` : 'Download Bundle'}
          </Button>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const MockKeyboard = ({ theme }: { theme: any }) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [activeShortcut, setActiveShortcut] = useState(0);
  
  useEffect(() => {
    const shortcuts = [
      { keys: ['Ctrl', 'S'], action: 'Save phase data' },
      { keys: ['Ctrl', 'K'], action: 'Show shortcuts' },
      { keys: ['Esc'], action: 'Close dialogs' },
    ];
    let keyIndex = 0;
    const interval = setInterval(() => {
      const shortcut = shortcuts[activeShortcut];
      setPressedKey(shortcut.keys[keyIndex]);
      setTimeout(() => setPressedKey(null), 200);
      keyIndex = (keyIndex + 1) % shortcut.keys.length;
      if (keyIndex === 0) {
        setTimeout(() => {
          setActiveShortcut((s) => (s + 1) % shortcuts.length);
        }, 1000);
      }
    }, 600);
    return () => clearInterval(interval);
  }, [activeShortcut]);

  const shortcuts = [
    { keys: ['Ctrl', 'S'], action: 'Save phase data' },
    { keys: ['Ctrl', 'K'], action: 'Show shortcuts' },
    { keys: ['Esc'], action: 'Close dialogs' },
  ];

  const currentShortcut = shortcuts[activeShortcut];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderRadius: 3,
          p: 3,
          border: `2px solid ${theme.palette.divider}`,
          width: '100%',
          maxWidth: '600px',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <KeyboardIcon sx={{ fontSize: 20 }} />
          Keyboard Shortcuts
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
          {currentShortcut.keys.map((key, index) => (
            <motion.div
              key={`${activeShortcut}-${index}`}
              animate={{
                scale: pressedKey === key ? 0.9 : 1,
                backgroundColor: pressedKey === key 
                  ? theme.palette.primary.main
                  : theme.palette.action.hover,
                color: pressedKey === key 
                  ? theme.palette.background.default
                  : theme.palette.text.primary,
              }}
              transition={{ duration: 0.1 }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2,
                  border: `2px solid ${
                    pressedKey === key 
                      ? theme.palette.primary.main
                      : theme.palette.divider
                  }`,
                  minWidth: 60,
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {key}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
        <motion.div
          key={activeShortcut}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', fontWeight: 500 }}>
            {currentShortcut.action}
          </Typography>
        </motion.div>
      </Box>
    </motion.div>
  );
};

const getTourSteps = (theme: any): TourStep[] => [
  {
    title: 'Welcome to The FullStack Method™ App',
    description: 'Get started',
    icon: <RocketLaunchIcon />,
    mockComponent: <MockDashboard theme={theme} />,
    content: (
      <Box>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
            Welcome to The FullStack Method™ App
          </Typography>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 3, textAlign: 'center' }}>
            Transform how you build products with our AI-accelerated project management platform.
          </Typography>
        </motion.div>
        {[
          'Work through 6 structured phases from concept to launch',
          'Create reusable templates to accelerate future projects',
          'Generate structured blueprints optimized for AI coding tools',
          'Collaborate with your team using role-based access control',
        ].map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.primary.main,
                  flexShrink: 0,
                }}
              />
              {item}
            </Typography>
          </motion.div>
        ))}
      </Box>
    ),
  },
  {
    title: 'Create Your First Template',
    description: 'Build reusable workflows',
    icon: <BuildIcon />,
    mockComponent: <MockTemplateBuilder theme={theme} />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Create Your First Template
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
          Templates let you standardize your workflow and reuse field configurations across projects.
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Navigate to <strong>Admin → Templates</strong> (admin only)
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Click &quot;Create Template&quot; or use the AI Template Generator
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Build custom field configurations for each phase
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          • Save templates as public or private for your team
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Start Your First Project',
    description: 'Begin your journey',
    icon: <PlayArrowIcon />,
    mockComponent: <MockProjectForm theme={theme} />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Start Your First Project
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
          Create a new project to begin applying The FullStack Method™ to your product.
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Click &quot;Create Project&quot; from your dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Give your project a name and description
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Optionally select a template to pre-fill phase data
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          • Choose your primary development tool (Cursor, Replit, etc.)
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Manage Your First Project',
    description: 'Navigate phases',
    icon: <SettingsIcon />,
    mockComponent: <MockProjectDashboard theme={theme} />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Manage Your First Project
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
          Work through the 6 phases systematically to build your product blueprint.
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 0.5 }}>
            1. Concept Framing - Define the problem and value proposition
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 0.5 }}>
            2. Product Strategy - Personas, outcomes, and features
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 0.5 }}>
            3. Rapid Prototype Definition - Screens, flows, components
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 0.5 }}>
            4. Analysis & User Stories - Entities, APIs, acceptance criteria
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 0.5 }}>
            5. Build Accelerator - Architecture and coding standards
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            6. QA & Hardening - Testing and launch readiness
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Use AI Assist buttons (✨) throughout to generate content quickly!
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Export Your Blueprints',
    description: 'Generate deliverables',
    icon: <DownloadIcon />,
    mockComponent: <MockExportDialog theme={theme} />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Export Your Blueprints
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
          Once you&apos;ve completed your phases, export structured blueprints for your team and AI tools.
        </Typography>
        <Box sx={{ backgroundColor: theme.palette.action.hover, p: 2, borderRadius: 2, mb: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 1, fontWeight: 600 }}>
            📦 Blueprint Bundle
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            Complete structured JSON/Markdown files with all phase data, organized by folder structure. Perfect for documentation and team handoffs.
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 1, fontWeight: 600 }}>
            🤖 Cursor Bundle
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Master prompt and specifications optimized for AI coding tools like Cursor, Replit, and Lovable. Includes all context needed for code generation.
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Both bundles are exported as ZIP files with organized folder structures ready to use.
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Work faster',
    icon: <KeyboardIcon />,
    mockComponent: <MockKeyboard theme={theme} />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Keyboard Shortcuts
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
          Master these shortcuts to work more efficiently:
        </Typography>
        <Box sx={{ backgroundColor: theme.palette.action.hover, p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box
              sx={{
                backgroundColor: theme.palette.background.paper,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              Ctrl/Cmd + S
            </Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
              Save phase data
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box
              sx={{
                backgroundColor: theme.palette.background.paper,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              Ctrl/Cmd + K
            </Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
              Show all keyboard shortcuts
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                backgroundColor: theme.palette.background.paper,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              Esc
            </Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
              Close dialogs and modals
            </Typography>
          </Box>
        </Box>
      </Box>
    ),
  },
];

export default function WelcomeTour({ open, onClose, onComplete }: WelcomeTourProps) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const TOUR_STEPS = getTourSteps(theme);

  const handleNext = () => {
    if (activeStep === TOUR_STEPS.length - 1) {
      handleComplete();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleComplete = () => {
    onComplete();
    setActiveStep(0);
  };

  const handleSkip = () => {
    onComplete();
    setActiveStep(0);
  };

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.default,
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 3,
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.palette.background.paper,
          borderBottom: `2px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
          fontWeight: 600,
          fontFamily: 'var(--font-rubik), Rubik, sans-serif',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RocketLaunchIcon />
          Welcome Tour
        </Box>
        <IconButton
          onClick={handleSkip}
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {TOUR_STEPS.map((step, index) => (
            <Step key={index}>
              <StepLabel
                StepIconComponent={() => (
                  <motion.div
                    animate={{
                      scale: index === activeStep ? [1, 1.1, 1] : 1,
                      backgroundColor:
                        index === activeStep
                          ? theme.palette.text.primary
                          : index < activeStep
                          ? theme.palette.text.primary
                          : theme.palette.action.hover,
                    }}
                    transition={{
                      scale: { duration: 0.3 },
                      backgroundColor: { duration: 0.3 },
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor:
                          index === activeStep
                            ? theme.palette.text.primary
                            : index < activeStep
                            ? theme.palette.text.primary
                            : theme.palette.action.hover,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: index <= activeStep ? theme.palette.background.default : theme.palette.text.secondary,
                        fontWeight: 600,
                        border: index === activeStep ? `2px solid ${theme.palette.text.primary}` : `1px solid ${theme.palette.divider}`,
                        boxShadow: index === activeStep 
                          ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                          : 'none',
                      }}
                    >
                      {index < activeStep ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </motion.div>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.icon}
                        </Box>
                      )}
                    </Box>
                  </motion.div>
                )}
                sx={{
                  '& .MuiStepLabel-label': {
                    color: index === activeStep ? theme.palette.text.primary : index < activeStep ? theme.palette.text.primary : theme.palette.text.secondary,
                    fontWeight: index === activeStep ? 600 : 400,
                  },
                }}
              >
                {step.title}
              </StepLabel>
              <StepContent>
                <AnimatePresence mode="wait">
                  {index === activeStep && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Paper
                        sx={{
                          p: 3,
                          backgroundColor: theme.palette.background.paper,
                          border: `2px solid ${theme.palette.divider}`,
                          borderRadius: 3,
                          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
                        }}
                      >
                        {step.mockComponent ? (
                          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                            <Grid item xs={12} md={7}>
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                              >
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '250px' }}>
                                  {step.mockComponent}
                                </Box>
                              </motion.div>
                            </Grid>
                            <Grid item xs={12} md={5}>
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                              >
                                <Box sx={{ maxWidth: '400px', mx: { xs: 'auto', md: 0 } }}>
                                  {step.content}
                                </Box>
                              </motion.div>
                            </Grid>
                          </Grid>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                          >
                            {step.content}
                          </motion.div>
                        )}
                      </Paper>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `2px solid ${theme.palette.divider}` }}>
        <Button
          onClick={handleSkip}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          Skip Tour
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
            '&.Mui-disabled': {
              color: theme.palette.text.secondary,
              borderColor: theme.palette.divider,
            },
          }}
          variant="outlined"
        >
          Back
        </Button>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              fontWeight: 600,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                borderColor: theme.palette.text.primary,
              },
            }}
          >
            {activeStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        </motion.div>
      </DialogActions>
    </Dialog>
  );
}

