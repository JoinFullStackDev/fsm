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
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';

interface TourStep {
  title: string;
  description: string;
  content: React.ReactNode;
}

interface WelcomeTourProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to The FullStack Method™ App',
    description: 'Get started',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Welcome! This app helps you apply The FullStack Method™ to build products systematically.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          You&apos;ll work through 6 phases, from concept to launch, creating structured blueprints
          that can be exported for AI coding tools.
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Create Your First Project',
    description: 'Start building',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Start by creating a project from your dashboard.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Click &quot;Create Project&quot; on the dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Give it a name and description
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          • Optionally select a template to pre-fill phase data
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Work Through the 6 Phases',
    description: 'Follow the method',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Each project has 6 phases that must be completed in order:
        </Typography>
        <Box sx={{ pl: 2 }}>
          <Typography variant="body2" sx={{ color: '#00E5FF', mb: 0.5 }}>
            1. Concept Framing - Define the problem and value
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
      </Box>
    ),
  },
  {
    title: 'Use AI Assistance',
    description: 'Speed up your work',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          AI Assist buttons are available throughout the app to help you generate content.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Look for buttons with the ✨ AI icon
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • Click them to generate suggestions for any field
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          • Review and accept or modify the AI-generated content
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Export Your Blueprint',
    description: 'Generate deliverables',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Once you&apos;ve completed your phases, export your blueprint bundles.
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • <strong>Blueprint Bundle:</strong> Structured JSON/Markdown files for documentation
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
          • <strong>Cursor Bundle:</strong> Master prompt and specs optimized for AI coding tools
        </Typography>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          Both bundles are exported as ZIP files with organized folder structures.
        </Typography>
      </Box>
    ),
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Work faster',
    content: (
      <Box>
        <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
          Use keyboard shortcuts to work more efficiently:
        </Typography>
        <Box sx={{ pl: 2 }}>
          <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
            <strong>Ctrl/Cmd + S:</strong> Save phase data
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
            <strong>Ctrl/Cmd + K:</strong> Show all keyboard shortcuts
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            <strong>Esc:</strong> Close dialogs
          </Typography>
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
                      width: 32,
                      height: 32,
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
                    }}
                  >
                    {index < activeStep ? <CheckCircleIcon fontSize="small" /> : index + 1}
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

