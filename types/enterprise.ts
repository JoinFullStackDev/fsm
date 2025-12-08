/**
 * Enterprise package types
 */

export interface VolumeDiscountRule {
  min_users: number;
  discount_percent: number;
}

export interface CustomEnterprisePackage {
  id: string;
  organization_id: string;
  package_id: string | null;
  
  // Custom name for invoicing
  custom_name: string | null;
  
  // Override pricing
  custom_price_per_user_monthly: number | null;
  custom_price_per_user_yearly: number | null;
  custom_base_price_monthly: number | null;
  custom_base_price_yearly: number | null;
  
  // Volume discounts
  volume_discount_rules: VolumeDiscountRule[];
  
  // Custom limits
  custom_max_users: number | null;
  custom_max_projects: number | null;
  custom_max_templates: number | null;
  
  // Custom trial
  custom_trial_days: number | null;
  
  // Contract terms
  contract_start_date: string | null;
  contract_end_date: string | null;
  minimum_commitment_users: number | null;
  minimum_commitment_months: number | null;
  
  // Billing
  custom_billing_interval: 'month' | 'quarter' | 'year' | null;
  net_payment_terms: number;
  
  // Notes
  notes: string | null;
  
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomEnterprisePackageWithDetails extends CustomEnterprisePackage {
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  package?: {
    id: string;
    name: string;
  };
}

export interface EnterpriseQuote {
  basePrice: number;
  discountedPrice: number;
  discountPercent: number;
  discountAmount: number;
  pricePerUser: number;
  effectivePricePerUser: number;
  appliedRule: string | null;
}

export interface CreateEnterprisePackageInput {
  organization_id: string;
  package_id: string;
  custom_name?: string;
  custom_price_per_user_monthly?: number | null;
  custom_price_per_user_yearly?: number | null;
  custom_base_price_monthly?: number | null;
  custom_base_price_yearly?: number | null;
  volume_discount_rules?: VolumeDiscountRule[];
  custom_max_users?: number | null;
  custom_max_projects?: number | null;
  custom_max_templates?: number | null;
  custom_trial_days?: number | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  minimum_commitment_users?: number | null;
  minimum_commitment_months?: number | null;
  custom_billing_interval?: 'month' | 'quarter' | 'year' | null;
  net_payment_terms?: number;
  notes?: string;
}

export interface UpdateEnterprisePackageInput extends Partial<Omit<CreateEnterprisePackageInput, 'organization_id'>> {
  is_active?: boolean;
}

