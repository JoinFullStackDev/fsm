'use client';

import React from 'react';
import PersonasField from './PersonasField';
import JTBDField from './JTBDField';
import FeaturesField from './FeaturesField';
import ScoredFeaturesField from './ScoredFeaturesField';
import ScreensField from './ScreensField';
import FlowsField from './FlowsField';
import ComponentsField from './ComponentsField';
import DesignTokensField from './DesignTokensField';
import NavigationField from './NavigationField';
import EntitiesField from './EntitiesField';
import ERDField from './ERDField';
import APISpecField from './APISpecField';
import UserStoriesField from './UserStoriesField';
import AcceptanceCriteriaField from './AcceptanceCriteriaField';
import RBACField from './RBACField';
import TestCasesField from './TestCasesField';
import type { TemplateFieldConfig } from '@/types/templates';

interface CustomFieldRegistryProps {
  field: TemplateFieldConfig;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  phaseData?: any;
}

// Registry mapping field_key to custom component
const CUSTOM_FIELD_REGISTRY: Record<string, React.ComponentType<any>> = {
  personas: PersonasField,
  jtbd: JTBDField,
  features: FeaturesField,
  scored_features: ScoredFeaturesField,
  screens: ScreensField,
  flows: FlowsField,
  components: ComponentsField,
  design_tokens: DesignTokensField,
  navigation: NavigationField,
  entities: EntitiesField,
  erd: ERDField,
  api_spec: APISpecField,
  user_stories: UserStoriesField,
  acceptance_criteria: AcceptanceCriteriaField,
  rbac: RBACField,
  test_cases: TestCasesField,
};

export function getCustomFieldComponent(fieldKey: string): React.ComponentType<any> | null {
  return CUSTOM_FIELD_REGISTRY[fieldKey] || null;
}

export function renderCustomField({
  field,
  value,
  onChange,
  error,
  phaseData,
}: CustomFieldRegistryProps): React.ReactNode {
  const CustomComponent = getCustomFieldComponent(field.field_key);
  
  if (!CustomComponent) {
    return null;
  }

  return (
    <CustomComponent
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      phaseData={phaseData}
    />
  );
}

