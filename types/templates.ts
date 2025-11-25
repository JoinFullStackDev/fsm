export interface TemplateFieldConfig {
  id?: string;
  template_id: string;
  phase_number: number;
  field_key: string;
  field_type: 'text' | 'textarea' | 'array' | 'object' | 'select' | 'checkbox' | 'slider' | 'date' | 'file' | 'table' | 'custom';
  display_order: number;
  layout_config: {
    columns?: number; // 1-12 for grid
    grid?: {
      xs?: number;
      sm?: number;
      md?: number;
      lg?: number;
      xl?: number;
    };
    spacing?: number;
    alignment?: 'left' | 'center' | 'right';
  };
  field_config: {
    label: string;
    helpText?: string;
    placeholder?: string;
    required?: boolean;
    defaultValue?: any;
    validation?: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      customRules?: string[];
    };
    aiSettings?: {
      enabled: boolean;
      customPrompt?: string;
      contextFields?: string[];
      temperature?: number;
      maxTokens?: number;
    };
    options?: Array<{ label: string; value: string }>; // For select fields
    min?: number; // For slider/number fields
    max?: number; // For slider/number fields
    step?: number; // For slider/number fields
  };
  conditional_logic?: {
    showIf?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
      value: any;
    }[];
    hideIf?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
      value: any;
    }[];
    logic?: 'AND' | 'OR';
  };
  group_id?: string;
  created_at?: string;
}

export interface TemplateFieldGroup {
  id: string;
  template_id: string;
  phase_number: number;
  group_key: string;
  label: string;
  description?: string;
  icon?: string;
  collapsible: boolean;
  defaultCollapsed: boolean;
  display_order: number;
}

