/**
 * Type definitions for Global Admin features
 */

export type SystemConnectionType = 'stripe' | 'email' | 'ai' | 'storage';

export interface SystemConnection {
  id: string;
  connection_type: SystemConnectionType;
  config: Record<string, any>;
  test_mode?: boolean; // For Stripe
  is_active: boolean;
  last_tested_at: string | null;
  last_test_status: 'success' | 'failed' | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationFullDetails {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  subscription?: {
    id: string;
    package_id: string;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  package?: {
    id: string;
    name: string;
    price_per_user_monthly: number;
    features: {
      max_projects: number | null;
      max_users: number | null;
      max_templates: number | null;
      ai_features: boolean;
      export_features: boolean;
      ops_tool: boolean;
      analytics: boolean;
      api_access: boolean;
    };
  };
  user_count: number;
  project_count: number;
  template_count: number;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AIUsageStats {
  total_requests: number;
  total_cost: number | null;
  requests_this_month: number;
  cost_this_month: number | null;
  requests_today: number;
  cost_today: number | null;
  average_per_org: number;
  top_organizations: Array<{
    organization_id: string;
    organization_name: string;
    requests: number;
    cost: number | null;
  }>;
  by_feature: Array<{
    feature: string;
    requests: number;
    cost: number | null;
  }>;
  by_organization: Array<{
    organization_id: string;
    organization_name: string;
    requests: number;
    cost: number | null;
    requests_this_month: number;
  }>;
}

export interface PaymentDetails {
  stripe_customer_id: string | null;
  payment_methods: Array<{
    id: string;
    type: string;
    last4?: string;
    brand?: string;
    exp_month?: number;
    exp_year?: number;
  }>;
  payment_history: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: number;
    description?: string;
  }>;
  invoices: Array<{
    id: string;
    amount_due: number;
    currency: string;
    status: string;
    created: number;
    due_date?: number;
  }>;
}

export interface AddonControls {
  extra_users: number;
  extra_projects: number;
  feature_overrides: {
    ai: boolean | null;
    export: boolean | null;
    opsTool: boolean | null;
    analytics: boolean | null;
    apiAccess: boolean | null;
  };
  custom_limits: {
    max_projects: number | null;
    max_users: number | null;
    max_templates: number | null;
  };
}

export interface OrganizationData {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
  companies?: Array<{
    id: string;
    name: string;
    created_at: string;
  }>;
  contacts?: Array<{
    id: string;
    name: string;
    email: string | null;
    created_at: string;
  }>;
  opportunities?: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
  }>;
  activity_logs: Array<{
    id: string;
    action_type: string;
    description: string;
    created_at: string;
  }>;
  exports: Array<{
    id: string;
    export_type: string;
    file_name: string;
    file_size: number;
    created_at: string;
  }>;
  api_keys?: Array<{
    id: string;
    name: string;
    key_id: string;
    scope: string;
    status: string;
    created_at: string;
  }>;
}

