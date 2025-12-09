'use client';

import { useState, useCallback, useMemo } from 'react';
import { useUser } from '@/components/providers/UserProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { UserPreferences } from '@/types/project';

export type OnboardingStepId = 'profile' | 'preferences' | 'company' | 'contact' | 'invite';

export interface OnboardingProgress {
  completed: boolean;
  completedSteps: OnboardingStepId[];
  skippedAt?: string;
  completedAt?: string;
}

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress;
  isStepCompleted: (stepId: OnboardingStepId) => boolean;
  markStepCompleted: (stepId: OnboardingStepId) => Promise<void>;
  markAllCompleted: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetProgress: () => Promise<void>;
  loading: boolean;
  saving: boolean;
}

const DEFAULT_PROGRESS: OnboardingProgress = {
  completed: false,
  completedSteps: [],
};

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const { user, refresh } = useUser();
  const [saving, setSaving] = useState(false);
  const supabase = createSupabaseClient();

  // Get current progress from user preferences
  const progress = useMemo((): OnboardingProgress => {
    const onboarding = user?.preferences?.onboarding;
    if (!onboarding) {
      return DEFAULT_PROGRESS;
    }
    return {
      completed: onboarding.completed ?? false,
      completedSteps: (onboarding.completedSteps ?? []) as OnboardingStepId[],
      skippedAt: onboarding.skippedAt,
      completedAt: onboarding.completedAt,
    };
  }, [user?.preferences?.onboarding]);

  const isStepCompleted = useCallback(
    (stepId: OnboardingStepId): boolean => {
      return progress.completedSteps.includes(stepId);
    },
    [progress.completedSteps]
  );

  // Helper to update preferences in database
  const updatePreferences = useCallback(
    async (updates: Partial<OnboardingProgress>) => {
      if (!user?.id) return;

      setSaving(true);
      try {
        const currentPrefs = (user.preferences || {}) as UserPreferences;
        const currentOnboarding = currentPrefs.onboarding || DEFAULT_PROGRESS;

        const newOnboarding = {
          ...currentOnboarding,
          ...updates,
        };

        const newPreferences: UserPreferences = {
          ...currentPrefs,
          onboarding: newOnboarding,
        };

        const { error } = await supabase
          .from('users')
          .update({
            preferences: newPreferences as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) {
          console.error('[Onboarding] Failed to save progress:', error);
          throw error;
        }

        // Refresh user data to get updated preferences
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [user, supabase, refresh]
  );

  const markStepCompleted = useCallback(
    async (stepId: OnboardingStepId) => {
      if (progress.completedSteps.includes(stepId)) return;

      const newCompletedSteps = [...progress.completedSteps, stepId];
      await updatePreferences({
        completedSteps: newCompletedSteps,
      });
    },
    [progress.completedSteps, updatePreferences]
  );

  const markAllCompleted = useCallback(async () => {
    await updatePreferences({
      completed: true,
      completedAt: new Date().toISOString(),
    });
  }, [updatePreferences]);

  const skipOnboarding = useCallback(async () => {
    await updatePreferences({
      completed: true,
      skippedAt: new Date().toISOString(),
    });
  }, [updatePreferences]);

  const resetProgress = useCallback(async () => {
    await updatePreferences({
      completed: false,
      completedSteps: [],
      skippedAt: undefined,
      completedAt: undefined,
    });
  }, [updatePreferences]);

  return {
    progress,
    isStepCompleted,
    markStepCompleted,
    markAllCompleted,
    skipOnboarding,
    resetProgress,
    loading: !user,
    saving,
  };
}

