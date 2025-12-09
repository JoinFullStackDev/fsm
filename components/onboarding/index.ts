// Main components
export { default as InteractiveOnboarding } from './InteractiveOnboarding';
export { OnboardingProvider, useOnboarding } from './OnboardingProvider';

// Hooks
export { useOnboardingProgress } from './hooks/useOnboardingProgress';
export type { OnboardingStepId, OnboardingProgress } from './hooks/useOnboardingProgress';

// Step components (lazy loaded by default)
export { default as ProfileStep } from './steps/ProfileStep';
export { default as PreferencesStep } from './steps/PreferencesStep';
export { default as CompanyStep } from './steps/CompanyStep';
export { default as ContactStep } from './steps/ContactStep';
export { default as InviteUsersStep } from './steps/InviteUsersStep';

