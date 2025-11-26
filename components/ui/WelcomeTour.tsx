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
  Grid,
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
  const [pulse, setPulse] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        border: `2px solid ${theme.palette.divider}`,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Box
          sx={{
            flex: 1,
            height: 60,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
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
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            Projects
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            height: 60,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            Templates
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          height: 40,
          backgroundColor: theme.palette.action.hover,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          px: 2,
          mb: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
          My First Project
        </Typography>
      </Box>
      <Box
        sx={{
          height: 40,
          backgroundColor: theme.palette.action.hover,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          px: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
          Product Launch
        </Typography>
      </Box>
    </Box>
  );
};

const MockTemplateBuilder = ({ theme }: { theme: any }) => {
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
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        border: `2px solid ${theme.palette.divider}`,
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: theme.palette.text.primary, mb: 1, display: 'block', fontWeight: 600 }}>
          Template Builder
        </Typography>
        <Box
          sx={{
            height: 32,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            px: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            {typing || 'Project Name'}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 2,
                height: 14,
                backgroundColor: theme.palette.text.primary,
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
        <Chip label="Phase 1" size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }} />
        <Chip label="Phase 2" size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }} />
        <Chip label="Phase 3" size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }} />
      </Box>
    </Box>
  );
};

const MockProjectForm = ({ theme }: { theme: any }) => {
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
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 2,
        border: `2px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
          Project Name
        </Typography>
        <Box
          sx={{
            height: 36,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            My New Project
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
          Template
        </Typography>
        <Box
          sx={{
            height: 36,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            Select Template...
          </Typography>
          <PlayArrowIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
        </Box>
      </Box>
      <Button
        size="small"
        variant="contained"
        sx={{
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          width: '100%',
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': { 
            backgroundColor: theme.palette.action.hover,
            borderColor: theme.palette.text.primary,
          },
        }}
      >
        Create Project
      </Button>
    </Box>
  );
};

const MockProjectDashboard = ({ theme }: { theme: any }) => {
  const [activePhase, setActivePhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => (p + 1) % 6);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const phases = [
    { name: 'Concept Framing', progress: 100 },
    { name: 'Product Strategy', progress: 80 },
    { name: 'Rapid Prototype', progress: 60 },
    { name: 'Analysis', progress: 40 },
    { name: 'Build Accelerator', progress: 20 },
    { name: 'QA & Hardening', progress: 0 },
  ];

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        border: `2px solid ${theme.palette.divider}`,
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <Typography variant="caption" sx={{ color: theme.palette.text.primary, mb: 2, display: 'block', fontWeight: 600 }}>
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
            <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
              {phase.name}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {phase.progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={phase.progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.palette.action.hover,
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.text.primary,
              },
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

const MockExportDialog = ({ theme }: { theme: any }) => {
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
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        border: `2px solid ${theme.palette.divider}`,
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <Typography variant="caption" sx={{ color: theme.palette.text.primary, mb: 2, display: 'block', fontWeight: 600 }}>
        Export Blueprint Bundle
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FolderIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
          <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
            blueprint-bundle.zip
          </Typography>
          {exporting && (
            <Box
              sx={{
                ml: 'auto',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: theme.palette.text.primary,
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
              <DescriptionIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>phase-1.json</Typography>}
            />
          </ListItem>
          <ListItem sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <DescriptionIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>phase-2.json</Typography>}
            />
          </ListItem>
          <ListItem sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <CodeIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>cursor-prompt.md</Typography>}
            />
          </ListItem>
        </List>
      </Box>
      <Button
        size="small"
        variant="contained"
        startIcon={<DownloadIcon />}
        sx={{
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          width: '100%',
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': { 
            backgroundColor: theme.palette.action.hover,
            borderColor: theme.palette.text.primary,
          },
        }}
      >
        {exporting ? 'Exporting...' : 'Download Bundle'}
      </Button>
    </Box>
  );
};

const MockKeyboard = ({ theme }: { theme: any }) => {
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
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        border: `2px solid ${theme.palette.divider}`,
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <Typography variant="caption" sx={{ color: theme.palette.text.primary, mb: 2, display: 'block', fontWeight: 600 }}>
        Keyboard Shortcuts
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Ctrl', 'S'].map((key, index) => (
          <Box
            key={index}
            sx={{
              px: 2,
              py: 1,
              backgroundColor: pressedKey === key ? theme.palette.text.primary : theme.palette.action.hover,
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
              transform: pressedKey === key ? 'scale(0.95)' : 'scale(1)',
              transition: 'all 0.1s ease',
            }}
          >
            <Typography variant="caption" sx={{ color: pressedKey === key ? theme.palette.background.default : theme.palette.text.primary, fontWeight: 600 }}>
              {key}
            </Typography>
          </Box>
        ))}
        <Box sx={{ width: '100%', textAlign: 'center', mt: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Save phase data
          </Typography>
        </Box>
      </Box>
    </Box>
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
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Welcome to The FullStack Method™ App
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2, textAlign: 'center' }}>
          Transform how you build products with our AI-accelerated project management platform.
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Work through 6 structured phases from concept to launch
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Create reusable templates to accelerate future projects
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          • Generate structured blueprints optimized for AI coding tools
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          • Collaborate with your team using role-based access control
        </Typography>
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
                    color: index === activeStep ? theme.palette.text.primary : index < activeStep ? theme.palette.text.primary : theme.palette.text.secondary,
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
                    backgroundColor: theme.palette.background.paper,
                    border: `2px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                  }}
                >
                  {index === activeStep && step.mockComponent ? (
                    <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                      <Grid item xs={12} md={7}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                          {step.mockComponent}
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={5}>
                        <Box sx={{ maxWidth: '400px', mx: { xs: 'auto', md: 0 } }}>
                          {step.content}
                        </Box>
                      </Grid>
                    </Grid>
                  ) : (
                    <Box>
                      {step.content}
                    </Box>
                  )}
                </Paper>
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
      </DialogActions>
    </Dialog>
  );
}

