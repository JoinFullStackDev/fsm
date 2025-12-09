'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import { useOnboardingProgress, type OnboardingStepId, type OnboardingProgress } from './hooks/useOnboardingProgress';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  isCompleted: boolean;
  isOptional: boolean;
}

interface OnboardingContextValue {
  // State
  isOpen: boolean;
  activeStepIndex: number;
  steps: OnboardingStep[];
  progress: OnboardingProgress;
  isCompanyAdmin: boolean;
  loading: boolean;
  saving: boolean;

  // Actions
  openOnboarding: () => void;
  closeOnboarding: () => void;
  goToStep: (index: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  markCurrentStepCompleted: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;

  // Helpers
  shouldShowOnboarding: boolean;
  currentStep: OnboardingStep | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  completedStepsCount: number;
  totalStepsCount: number;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Step definitions
const BASE_STEPS: Array<Omit<OnboardingStep, 'isCompleted'>> = [
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Add your name, title, and photo',
    isOptional: false,
  },
  {
    id: 'preferences',
    title: 'Set Your Preferences',
    description: 'Choose theme and notification settings',
    isOptional: true,
  },
  {
    id: 'company',
    title: 'Add a Company',
    description: 'Create or view your companies',
    isOptional: true,
  },
  {
    id: 'contact',
    title: 'Add a Contact',
    description: 'Create or view your contacts',
    isOptional: true,
  },
];

const ADMIN_STEP: Omit<OnboardingStep, 'isCompleted'> = {
  id: 'invite',
  title: 'Invite Team Members',
  description: 'Invite users to your organization',
  isOptional: true,
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { isCompanyAdmin, loading: roleLoading } = useRole();
  const {
    progress,
    isStepCompleted,
    markStepCompleted,
    markAllCompleted,
    skipOnboarding: skipProgress,
    loading: progressLoading,
    saving,
  } = useOnboardingProgress();

  const [isOpen, setIsOpen] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Build steps based on role
  const steps = useMemo((): OnboardingStep[] => {
    const stepDefs = isCompanyAdmin ? [...BASE_STEPS, ADMIN_STEP] : BASE_STEPS;
    return stepDefs.map((step) => ({
      ...step,
      isCompleted: isStepCompleted(step.id),
    }));
  }, [isCompanyAdmin, isStepCompleted]);

  const loading = roleLoading || progressLoading;

  // Determine if onboarding should be shown automatically
  const shouldShowOnboarding = useMemo(() => {
    if (loading) return false;
    // Don't show if already completed or skipped
    if (progress.completed) return false;
    // Show if user hasn't completed onboarding
    return true;
  }, [loading, progress.completed]);

  const currentStep = steps[activeStepIndex] || null;
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;
  const completedStepsCount = steps.filter((s) => s.isCompleted).length;
  const totalStepsCount = steps.length;

  const openOnboarding = useCallback(() => {
    setIsOpen(true);
    // Find first uncompleted step
    const firstUncompletedIndex = steps.findIndex((s) => !s.isCompleted);
    setActiveStepIndex(firstUncompletedIndex >= 0 ? firstUncompletedIndex : 0);
  }, [steps]);

  const closeOnboarding = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToStep = useCallback((index: number) => {
    setActiveStepIndex(index);
  }, []);

  const goToNextStep = useCallback(() => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((prev) => prev + 1);
    }
  }, [activeStepIndex, steps.length]);

  const goToPreviousStep = useCallback(() => {
    if (activeStepIndex > 0) {
      setActiveStepIndex((prev) => prev - 1);
    }
  }, [activeStepIndex]);

  const markCurrentStepCompleted = useCallback(async () => {
    if (currentStep) {
      await markStepCompleted(currentStep.id);
    }
  }, [currentStep, markStepCompleted]);

  const completeOnboarding = useCallback(async () => {
    await markAllCompleted();
    setIsOpen(false);
  }, [markAllCompleted]);

  const skipOnboarding = useCallback(async () => {
    await skipProgress();
    setIsOpen(false);
  }, [skipProgress]);

  const value: OnboardingContextValue = {
    isOpen,
    activeStepIndex,
    steps,
    progress,
    isCompanyAdmin,
    loading,
    saving,
    openOnboarding,
    closeOnboarding,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    markCurrentStepCompleted,
    completeOnboarding,
    skipOnboarding,
    shouldShowOnboarding,
    currentStep,
    isFirstStep,
    isLastStep,
    completedStepsCount,
    totalStepsCount,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

