'use client';

import { Suspense, lazy, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  CircularProgress,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  RocketLaunch as RocketLaunchIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
  Contacts as ContactsIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useOnboarding, type OnboardingStep } from './OnboardingProvider';

// Lazy load step components for better performance
const ProfileStep = lazy(() => import('./steps/ProfileStep'));
const PreferencesStep = lazy(() => import('./steps/PreferencesStep'));
const CompanyStep = lazy(() => import('./steps/CompanyStep'));
const ContactStep = lazy(() => import('./steps/ContactStep'));
const InviteUsersStep = lazy(() => import('./steps/InviteUsersStep'));

// Step icon mapping
const stepIcons: Record<string, React.ReactNode> = {
  profile: <PersonIcon />,
  preferences: <SettingsIcon />,
  company: <BusinessIcon />,
  contact: <ContactsIcon />,
  invite: <PersonAddIcon />,
};

// Loading fallback for lazy-loaded components
function StepLoadingFallback() {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress sx={{ color: theme.palette.text.primary }} />
    </Box>
  );
}

interface InteractiveOnboardingProps {
  open: boolean;
  onClose: () => void;
}

export default function InteractiveOnboarding({ open, onClose }: InteractiveOnboardingProps) {
  const theme = useTheme();
  const {
    activeStepIndex,
    steps,
    loading,
    saving,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    markCurrentStepCompleted,
    completeOnboarding,
    skipOnboarding,
    currentStep,
    isFirstStep,
    isLastStep,
    completedStepsCount,
    totalStepsCount,
  } = useOnboarding();

  const progressPercentage = totalStepsCount > 0 ? (completedStepsCount / totalStepsCount) * 100 : 0;

  // Handle step completion and advance
  const handleStepComplete = useCallback(async () => {
    await markCurrentStepCompleted();
    if (isLastStep) {
      await completeOnboarding();
      onClose();
    } else {
      goToNextStep();
    }
  }, [markCurrentStepCompleted, isLastStep, completeOnboarding, onClose, goToNextStep]);

  // Handle step skip (don't mark as completed)
  const handleStepSkip = useCallback(() => {
    if (isLastStep) {
      completeOnboarding();
      onClose();
    } else {
      goToNextStep();
    }
  }, [isLastStep, completeOnboarding, onClose, goToNextStep]);

  // Handle skip entire onboarding
  const handleSkipAll = useCallback(async () => {
    await skipOnboarding();
    onClose();
  }, [skipOnboarding, onClose]);

  // Render step component based on step ID
  const renderStepContent = (stepId: string) => {
    const commonProps = {
      onComplete: handleStepComplete,
      onSkip: handleStepSkip,
    };

    switch (stepId) {
      case 'profile':
        return <ProfileStep {...commonProps} />;
      case 'preferences':
        return <PreferencesStep {...commonProps} />;
      case 'company':
        return <CompanyStep {...commonProps} />;
      case 'contact':
        return <ContactStep {...commonProps} />;
      case 'invite':
        return <InviteUsersStep {...commonProps} />;
      default:
        return null;
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleSkipAll}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.default,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RocketLaunchIcon sx={{ color: theme.palette.text.primary }} />
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
            }}
          >
            Get Started
          </Typography>
        </Box>
        <IconButton
          onClick={handleSkipAll}
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

      {/* Progress Bar */}
      <Box sx={{ px: 3, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Setup Progress
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {completedStepsCount} of {totalStepsCount} complete
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercentage}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.palette.action.hover,
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              backgroundColor: theme.palette.success.main,
            },
          }}
        />
      </Box>

      {/* Content */}
      <DialogContent sx={{ pt: 2 }}>
        <Stepper
          activeStep={activeStepIndex}
          orientation="vertical"
          sx={{
            '& .MuiStepConnector-line': {
              borderColor: theme.palette.divider,
              minHeight: 20,
            },
          }}
        >
          {steps.map((step, index) => (
            <Step key={step.id} completed={step.isCompleted}>
              <StepLabel
                onClick={() => goToStep(index)}
                sx={{ cursor: 'pointer' }}
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor:
                        step.isCompleted
                          ? theme.palette.success.main
                          : index === activeStepIndex
                          ? theme.palette.text.primary
                          : theme.palette.action.hover,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color:
                        step.isCompleted || index === activeStepIndex
                          ? theme.palette.background.default
                          : theme.palette.text.secondary,
                      border:
                        index === activeStepIndex
                          ? `2px solid ${theme.palette.text.primary}`
                          : `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {step.isCompleted ? (
                      <CheckCircleIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', '& > svg': { fontSize: 16 } }}>
                        {stepIcons[step.id]}
                      </Box>
                    )}
                  </Box>
                )}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color:
                      index === activeStepIndex
                        ? theme.palette.text.primary
                        : step.isCompleted
                        ? theme.palette.success.main
                        : theme.palette.text.secondary,
                    fontWeight: index === activeStepIndex ? 600 : 400,
                  }}
                >
                  {step.title}
                </Typography>
                {step.isOptional && index !== activeStepIndex && (
                  <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
                    Optional
                  </Typography>
                )}
              </StepLabel>
              <StepContent
                sx={{
                  borderLeft: `1px solid ${theme.palette.divider}`,
                  ml: 2,
                }}
              >
                <Box
                  sx={{
                    py: 2,
                    pl: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.secondary, mb: 2 }}
                  >
                    {step.description}
                  </Typography>
                  <Suspense fallback={<StepLoadingFallback />}>
                    {renderStepContent(step.id)}
                  </Suspense>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          justifyContent: 'space-between',
        }}
      >
        <Button
          onClick={handleSkipAll}
          disabled={saving}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Skip Setup
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={goToPreviousStep}
            disabled={isFirstStep || saving}
            variant="outlined"
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.disabled,
              },
            }}
          >
            Back
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

