'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
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
const MockDashboard = () => {
  const [pulse, setPulse] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(0, 229, 255, 0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Box
          sx={{
            flex: 1,
            height: 60,
            backgroundColor: 'rgba(0, 229, 255, 0.1)',
            borderRadius: 1,
            border: '1px solid rgba(0, 229, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: pulse ? 'pulse 2s ease-in-out infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.6 },
            },
          }}
        >
          <Typography variant="caption" sx={{ color: '#00E5FF' }}>
            Projects
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            height: 60,
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderRadius: 1,
            border: '1px solid rgba(0, 255, 136, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: '#00FF88' }}>
            Templates
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          height: 40,
          backgroundColor: 'rgba(233, 30, 99, 0.1)',
          borderRadius: 1,
          border: '1px solid rgba(233, 30, 99, 0.3)',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          mb: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: '#E91E63' }}>
          My First Project
        </Typography>
      </Box>
      <Box
        sx={{
          height: 40,
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderRadius: 1,
          border: '1px solid rgba(33, 150, 243, 0.3)',
          display: 'flex',
          alignItems: 'center',
          px: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: '#2196F3' }}>
          Product Launch
        </Typography>
      </Box>
    </Box>
  );
};

const MockTemplateBuilder = () => {
  const [typing, setTyping] = useState('Project Name');
  const [fieldIndex, setFieldIndex] = useState(0);
  
  useEffect(() => {
    const fields = ['Project Name', 'Description', 'Category'];
    let charIndex = 0;
    let currentField = fields[0];
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentField.length) {
        setTyping(currentField.substring(0, charIndex + 1));
        charIndex++;
      } else {
        // Finished typing, wait then switch to next field
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
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(0, 255, 136, 0.3)',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#00FF88', mb: 1, display: 'block' }}>
          Template Builder
        </Typography>
        <Box
          sx={{
            height: 32,
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderRadius: 1,
            border: '1px solid rgba(0, 255, 136, 0.3)',
            display: 'flex',
            alignItems: 'center',
            px: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: '#00FF88' }}>
            {typing || 'Project Name'}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 2,
                height: 14,
                backgroundColor: '#00FF88',
                ml: 0.5,
                animation: 'blink 1s infinite',
                '@keyframes blink': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0 },
                },
              }}
            />
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip label="Phase 1" size="small" sx={{ backgroundColor: 'rgba(0, 229, 255, 0.2)', color: '#00E5FF' }} />
        <Chip label="Phase 2" size="small" sx={{ backgroundColor: 'rgba(233, 30, 99, 0.2)', color: '#E91E63' }} />
        <Chip label="Phase 3" size="small" sx={{ backgroundColor: 'rgba(0, 255, 136, 0.2)', color: '#00FF88' }} />
      </Box>
    </Box>
  );
};

const MockProjectForm = () => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 10));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(233, 30, 99, 0.3)',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#E91E63', mb: 1, display: 'block' }}>
          Project Name
        </Typography>
        <Box
          sx={{
            height: 36,
            backgroundColor: 'rgba(233, 30, 99, 0.1)',
            borderRadius: 1,
            border: '1px solid rgba(233, 30, 99, 0.3)',
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: '#E91E63' }}>
            My New Project
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#E91E63', mb: 1, display: 'block' }}>
          Template
        </Typography>
        <Box
          sx={{
            height: 36,
            backgroundColor: 'rgba(233, 30, 99, 0.1)',
            borderRadius: 1,
            border: '1px solid rgba(233, 30, 99, 0.3)',
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="caption" sx={{ color: '#E91E63' }}>
            Select Template...
          </Typography>
          <PlayArrowIcon sx={{ fontSize: 16, color: '#E91E63' }} />
        </Box>
      </Box>
      <Button
        size="small"
        variant="contained"
        sx={{
          backgroundColor: '#E91E63',
          color: '#FFF',
          width: '100%',
          '&:hover': { backgroundColor: '#C2185B' },
        }}
      >
        Create Project
      </Button>
    </Box>
  );
};

const MockProjectDashboard = () => {
  const [activePhase, setActivePhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => (p + 1) % 6);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const phases = [
    { name: 'Concept Framing', color: '#00E5FF', progress: 100 },
    { name: 'Product Strategy', color: '#E91E63', progress: 80 },
    { name: 'Rapid Prototype', color: '#00FF88', progress: 60 },
    { name: 'Analysis', color: '#2196F3', progress: 40 },
    { name: 'Build Accelerator', color: '#FF6B35', progress: 20 },
    { name: 'QA & Hardening', color: '#FF1744', progress: 0 },
  ];

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(33, 150, 243, 0.3)',
      }}
    >
      <Typography variant="caption" sx={{ color: '#2196F3', mb: 2, display: 'block', fontWeight: 600 }}>
        Project Phases
      </Typography>
      {phases.map((phase, index) => (
        <Box
          key={index}
          sx={{
            mb: 1.5,
            opacity: index === activePhase ? 1 : 0.6,
            transform: index === activePhase ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.3s ease',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: phase.color }}>
              {phase.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
              {phase.progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={phase.progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: phase.color,
              },
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

const MockExportDialog = () => {
  const [exporting, setExporting] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setExporting((e) => !e);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(255, 107, 53, 0.3)',
      }}
    >
      <Typography variant="caption" sx={{ color: '#FF6B35', mb: 2, display: 'block', fontWeight: 600 }}>
        Export Blueprint Bundle
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FolderIcon sx={{ fontSize: 16, color: '#FF6B35' }} />
          <Typography variant="caption" sx={{ color: '#E0E0E0' }}>
            blueprint-bundle.zip
          </Typography>
          {exporting && (
            <Box
              sx={{
                ml: 'auto',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#00FF88',
                animation: 'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                  '50%': { opacity: 0.5, transform: 'scale(1.2)' },
                },
              }}
            />
          )}
        </Box>
        <List dense sx={{ pl: 2 }}>
          <ListItem sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <DescriptionIcon sx={{ fontSize: 14, color: '#B0B0B0' }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: '#B0B0B0' }}>phase-1.json</Typography>}
            />
          </ListItem>
          <ListItem sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <DescriptionIcon sx={{ fontSize: 14, color: '#B0B0B0' }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: '#B0B0B0' }}>phase-2.json</Typography>}
            />
          </ListItem>
          <ListItem sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <CodeIcon sx={{ fontSize: 14, color: '#B0B0B0' }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: '#B0B0B0' }}>cursor-prompt.md</Typography>}
            />
          </ListItem>
        </List>
      </Box>
      <Button
        size="small"
        variant="contained"
        startIcon={<DownloadIcon />}
        sx={{
          backgroundColor: '#FF6B35',
          color: '#FFF',
          width: '100%',
          '&:hover': { backgroundColor: '#E55A2B' },
        }}
      >
        {exporting ? 'Exporting...' : 'Download Bundle'}
      </Button>
    </Box>
  );
};

const MockKeyboard = () => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  
  useEffect(() => {
    const keys = ['Ctrl', 'S', 'K'];
    let keyIndex = 0;
    const interval = setInterval(() => {
      setPressedKey(keys[keyIndex]);
      setTimeout(() => setPressedKey(null), 300);
      keyIndex = (keyIndex + 1) % keys.length;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#0A0E27',
        borderRadius: 2,
        p: 2,
        border: '1px solid rgba(156, 39, 176, 0.3)',
      }}
    >
      <Typography variant="caption" sx={{ color: '#9C27B0', mb: 2, display: 'block', fontWeight: 600 }}>
        Keyboard Shortcuts
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Ctrl', 'S'].map((key, index) => (
          <Box
            key={index}
            sx={{
              px: 2,
              py: 1,
              backgroundColor: pressedKey === key ? '#9C27B0' : 'rgba(156, 39, 176, 0.2)',
              borderRadius: 1,
              border: '1px solid rgba(156, 39, 176, 0.3)',
              transform: pressedKey === key ? 'scale(0.95)' : 'scale(1)',
              transition: 'all 0.1s ease',
            }}
          >
            <Typography variant="caption" sx={{ color: pressedKey === key ? '#FFF' : '#9C27B0', fontWeight: 600 }}>
              {key}
            </Typography>
          </Box>
        ))}
        <Box sx={{ width: '100%', textAlign: 'center', mt: 1 }}>
          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
            Save phase data
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to The FullStack Method™ App',
    description: 'Get started',
    icon: <RocketLaunchIcon />,
    mockComponent: <MockDashboard />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#00E5FF', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Welcome to The FullStack Method™ App
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2, textAlign: 'center' }}>
          Transform how you build products with our AI-accelerated project management platform.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Work through 6 structured phases from concept to launch
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Create reusable templates to accelerate future projects
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Generate structured blueprints optimized for AI coding tools
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          • Collaborate with your team using role-based access control
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Create Your First Template',
    description: 'Build reusable workflows',
    icon: <BuildIcon />,
    mockComponent: <MockTemplateBuilder />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#00FF88', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Create Your First Template
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Templates let you standardize your workflow and reuse field configurations across projects.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Navigate to <strong>Admin → Templates</strong> (admin only)
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Click &quot;Create Template&quot; or use the AI Template Generator
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Build custom field configurations for each phase
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          • Save templates as public or private for your team
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Start Your First Project',
    description: 'Begin your journey',
    icon: <PlayArrowIcon />,
    mockComponent: <MockProjectForm />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#E91E63', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Start Your First Project
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Create a new project to begin applying The FullStack Method™ to your product.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Click &quot;Create Project&quot; from your dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Give your project a name and description
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Optionally select a template to pre-fill phase data
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          • Choose your primary development tool (Cursor, Replit, etc.)
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Manage Your First Project',
    description: 'Navigate phases',
    icon: <SettingsIcon />,
    mockComponent: <MockProjectDashboard />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#2196F3', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Manage Your First Project
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Work through the 6 phases systematically to build your product blueprint.
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#00E5FF', mb: 0.5 }}>
            1. Concept Framing - Define the problem and value proposition
          </Typography>
          <Typography variant="body2" sx={{ color: '#E91E63', mb: 0.5 }}>
            2. Product Strategy - Personas, outcomes, and features
          </Typography>
          <Typography variant="body2" sx={{ color: '#00FF88', mb: 0.5 }}>
            3. Rapid Prototype Definition - Screens, flows, components
          </Typography>
          <Typography variant="body2" sx={{ color: '#2196F3', mb: 0.5 }}>
            4. Analysis & User Stories - Entities, APIs, acceptance criteria
          </Typography>
          <Typography variant="body2" sx={{ color: '#FF6B35', mb: 0.5 }}>
            5. Build Accelerator - Architecture and coding standards
          </Typography>
          <Typography variant="body2" sx={{ color: '#FF1744' }}>
            6. QA & Hardening - Testing and launch readiness
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          Use AI Assist buttons (✨) throughout to generate content quickly!
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Export Your Blueprints',
    description: 'Generate deliverables',
    icon: <DownloadIcon />,
    mockComponent: <MockExportDialog />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#FF6B35', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Export Your Blueprints
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Once you&apos;ve completed your phases, export structured blueprints for your team and AI tools.
        </Typography>
        <Box sx={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#00E5FF', mb: 1, fontWeight: 600 }}>
            📦 Blueprint Bundle
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 2 }}>
            Complete structured JSON/Markdown files with all phase data, organized by folder structure. Perfect for documentation and team handoffs.
          </Typography>
          <Typography variant="body2" sx={{ color: '#00E5FF', mb: 1, fontWeight: 600 }}>
            🤖 Cursor Bundle
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            Master prompt and specifications optimized for AI coding tools like Cursor, Replit, and Lovable. Includes all context needed for code generation.
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          Both bundles are exported as ZIP files with organized folder structures ready to use.
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Work faster',
    icon: <KeyboardIcon />,
    mockComponent: <MockKeyboard />,
    content: (
      <Box>
        <Typography variant="h6" sx={{ color: '#9C27B0', mb: 2, textAlign: 'center', fontWeight: 600 }}>
          Keyboard Shortcuts
        </Typography>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Master these shortcuts to work more efficiently:
        </Typography>
        <Box sx={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#00E5FF',
              }}
            >
              Ctrl/Cmd + S
            </Box>
            <Typography variant="body2" sx={{ color: '#E0E0E0' }}>
              Save phase data
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#00E5FF',
              }}
            >
              Ctrl/Cmd + K
            </Box>
            <Typography variant="body2" sx={{ color: '#E0E0E0' }}>
              Show all keyboard shortcuts
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                mr: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#00E5FF',
              }}
            >
              Esc
            </Box>
            <Typography variant="body2" sx={{ color: '#E0E0E0' }}>
              Close dialogs and modals
            </Typography>
          </Box>
        </Box>
      </Box>
    ),
  },
];

export default function WelcomeTour({ open, onClose, onComplete }: WelcomeTourProps) {
  const [activeStep, setActiveStep] = useState(0);

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
          backgroundColor: '#121633',
          border: '2px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          color: '#00E5FF',
          fontWeight: 600,
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
            color: '#B0B0B0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor:
                        index === activeStep
                          ? '#00E5FF'
                          : index < activeStep
                          ? '#00FF88'
                          : 'rgba(0, 229, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: index <= activeStep ? '#000' : '#B0B0B0',
                      fontWeight: 600,
                      border: index === activeStep ? '2px solid #00E5FF' : 'none',
                      boxShadow: index === activeStep ? '0 4px 12px rgba(0, 229, 255, 0.4)' : 'none',
                    }}
                  >
                    {index < activeStep ? (
                      <CheckCircleIcon fontSize="small" />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {step.icon}
                      </Box>
                    )}
                  </Box>
                )}
                sx={{
                  '& .MuiStepLabel-label': {
                    color: index === activeStep ? '#00E5FF' : index < activeStep ? '#00FF88' : '#B0B0B0',
                    fontWeight: index === activeStep ? 600 : 400,
                  },
                }}
              >
                {step.title}
              </StepLabel>
              <StepContent>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    borderRadius: 2,
                  }}
                >
                  {index === activeStep && step.mockComponent && (
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                      {step.mockComponent}
                    </Box>
                  )}
                  {step.content}
                </Paper>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0, 229, 255, 0.2)' }}>
        <Button
          onClick={handleSkip}
          sx={{
            color: '#B0B0B0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
            color: '#00E5FF',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
            '&.Mui-disabled': {
              color: '#666',
            },
          }}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          variant="contained"
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#00B2CC',
              boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
            },
          }}
        >
          {activeStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

