/**
 * Affiliate system types
 */

export type DiscountType = 'percentage' | 'fixed_amount' | 'trial_extension';

export interface AffiliateCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  
  // Discount configuration
  discount_type: DiscountType;
  discount_value: number;
  discount_duration_months: number | null; // NULL = forever
  
  // Trial extension
  bonus_trial_days: number;
  
  // Affiliate owner
  affiliate_user_id: string | null;
  affiliate_email: string | null;
  commission_percentage: number;
  
  // Limits
  max_uses: number | null; // NULL = unlimited
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  
  // Targeting
  applicable_package_ids: string[] | null; // NULL = all packages
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AffiliateConversion {
  id: string;
  affiliate_code_id: string | null;
  organization_id: string | null;
  subscription_id: string | null;
  
  // Snapshot of discount applied
  discount_type: DiscountType | null;
  discount_value: number | null;
  discount_applied: number | null; // Actual dollar amount saved
  
  // Attribution
  converted_at: string;
  first_payment_at: string | null;
  
  // Commission tracking
  commission_amount: number;
  commission_paid: boolean;
  commission_paid_at: string | null;
}

export interface AffiliateCodeWithStats extends AffiliateCode {
  conversions_count?: number;
  total_revenue?: number;
  total_commission?: number;
}

export interface CreateAffiliateCodeInput {
  code: string;
  name: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  discount_duration_months?: number | null;
  bonus_trial_days?: number;
  affiliate_email?: string;
  commission_percentage?: number;
  max_uses?: number | null;
  valid_from?: string;
  valid_until?: string | null;
  applicable_package_ids?: string[] | null;
}

export interface UpdateAffiliateCodeInput extends Partial<CreateAffiliateCodeInput> {
  is_active?: boolean;
}

export interface ValidateAffiliateCodeResponse {
  valid: boolean;
  code?: AffiliateCode;
  error?: string;
}

// Affiliate application types
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AffiliateApplication {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company_name: string | null;
  website: string | null;
  social_media_links: string[];
  audience_size: string | null;
  audience_description: string | null;
  promotion_methods: string[] | null;
  motivation: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface AffiliateApplicationWithUser extends AffiliateApplication {
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface CreateAffiliateApplicationInput {
  name: string;
  email: string;
  company_name?: string;
  website?: string;
  social_media_links?: string[];
  audience_size?: string;
  audience_description?: string;
  promotion_methods?: string[];
  motivation?: string;
}

