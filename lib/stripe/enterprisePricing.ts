/**
 * Enterprise pricing utilities
 * Handles volume discounts and custom enterprise package pricing
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { VolumeDiscountRule, EnterpriseQuote, CustomEnterprisePackage } from '@/types/enterprise';

/**
 * Calculate enterprise price with volume discounts
 * @param userCount - Number of users
 * @param basePricePerUser - Base price per user (before discounts)
 * @param volumeDiscountRules - Array of volume discount rules
 * @returns Enterprise quote with pricing details
 */
export function calculateEnterprisePrice(
  userCount: number,
  basePricePerUser: number,
  volumeDiscountRules: VolumeDiscountRule[]
): EnterpriseQuote {
  // Sort rules by min_users descending to find highest applicable tier
  const sortedRules = [...volumeDiscountRules].sort((a, b) => b.min_users - a.min_users);
  
  // Find applicable rule (first one where userCount >= min_users)
  const applicableRule = sortedRules.find(rule => userCount >= rule.min_users);
  
  const basePrice = basePricePerUser * userCount;
  const discountPercent = applicableRule?.discount_percent || 0;
  const discountAmount = basePrice * (discountPercent / 100);
  const discountedPrice = basePrice - discountAmount;
  const effectivePricePerUser = userCount > 0 ? discountedPrice / userCount : 0;
  
  return {
    basePrice,
    discountedPrice,
    discountPercent,
    discountAmount,
    pricePerUser: basePricePerUser,
    effectivePricePerUser,
    appliedRule: applicableRule 
      ? `${applicableRule.min_users}+ users: ${applicableRule.discount_percent}% off` 
      : null,
  };
}

/**
 * Get custom enterprise package for an organization
 * @param organizationId - Organization ID
 * @returns Custom enterprise package or null if not found
 */
export async function getCustomEnterprisePackage(
  organizationId: string
): Promise<CustomEnterprisePackage | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    const { data, error } = await adminClient
      .from('custom_enterprise_packages')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No enterprise package found - this is expected for most orgs
        return null;
      }
      logger.error('[EnterprisePricing] Error fetching enterprise package:', {
        organizationId,
        error: error.message,
      });
      return null;
    }

    return data as CustomEnterprisePackage;
  } catch (error) {
    logger.error('[EnterprisePricing] Error getting enterprise package:', error);
    return null;
  }
}

/**
 * Get effective pricing for an organization
 * Checks for custom enterprise package and applies volume discounts if applicable
 * @param organizationId - Organization ID
 * @param userCount - Current user count
 * @param billingInterval - 'month' or 'year'
 * @returns Effective price per user and any applied discounts
 */
export async function getEffectivePricing(
  organizationId: string,
  userCount: number,
  billingInterval: 'month' | 'year'
): Promise<{
  pricePerUser: number;
  quote: EnterpriseQuote | null;
  isEnterprise: boolean;
  customPackage: CustomEnterprisePackage | null;
}> {
  try {
    const adminClient = createAdminSupabaseClient();
    
    // Get custom enterprise package
    const customPackage = await getCustomEnterprisePackage(organizationId);
    
    if (!customPackage) {
      // No enterprise package - return standard pricing
      return {
        pricePerUser: 0,
        quote: null,
        isEnterprise: false,
        customPackage: null,
      };
    }

    // Get base price from custom package or fall back to base package
    let basePricePerUser: number;
    
    if (billingInterval === 'month' && customPackage.custom_price_per_user_monthly !== null) {
      basePricePerUser = customPackage.custom_price_per_user_monthly;
    } else if (billingInterval === 'year' && customPackage.custom_price_per_user_yearly !== null) {
      basePricePerUser = customPackage.custom_price_per_user_yearly;
    } else if (customPackage.package_id) {
      // Fall back to base package pricing
      const { data: basePackage } = await adminClient
        .from('packages')
        .select('price_per_user_monthly, price_per_user_yearly')
        .eq('id', customPackage.package_id)
        .single();
      
      basePricePerUser = billingInterval === 'month'
        ? (basePackage?.price_per_user_monthly || 0)
        : (basePackage?.price_per_user_yearly || 0);
    } else {
      basePricePerUser = 0;
    }

    // Calculate with volume discounts
    const volumeRules = customPackage.volume_discount_rules || [];
    const quote = calculateEnterprisePrice(userCount, basePricePerUser, volumeRules);

    logger.debug('[EnterprisePricing] Calculated enterprise pricing:', {
      organizationId,
      userCount,
      billingInterval,
      basePricePerUser,
      effectivePricePerUser: quote.effectivePricePerUser,
      discountPercent: quote.discountPercent,
      appliedRule: quote.appliedRule,
    });

    return {
      pricePerUser: quote.effectivePricePerUser,
      quote,
      isEnterprise: true,
      customPackage,
    };
  } catch (error) {
    logger.error('[EnterprisePricing] Error getting effective pricing:', error);
    return {
      pricePerUser: 0,
      quote: null,
      isEnterprise: false,
      customPackage: null,
    };
  }
}

/**
 * Validate volume discount rules
 * @param rules - Array of volume discount rules
 * @returns Object with isValid boolean and any error message
 */
export function validateVolumeDiscountRules(
  rules: VolumeDiscountRule[]
): { isValid: boolean; error?: string } {
  if (!Array.isArray(rules)) {
    return { isValid: false, error: 'Volume discount rules must be an array' };
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    
    if (typeof rule.min_users !== 'number' || rule.min_users < 1) {
      return { 
        isValid: false, 
        error: `Rule ${i + 1}: min_users must be a positive number` 
      };
    }
    
    if (typeof rule.discount_percent !== 'number' || 
        rule.discount_percent < 0 || 
        rule.discount_percent > 100) {
      return { 
        isValid: false, 
        error: `Rule ${i + 1}: discount_percent must be between 0 and 100` 
      };
    }
  }

  // Check for duplicate thresholds
  const thresholds = rules.map(r => r.min_users);
  const uniqueThresholds = new Set(thresholds);
  if (thresholds.length !== uniqueThresholds.size) {
    return { isValid: false, error: 'Duplicate user thresholds are not allowed' };
  }

  return { isValid: true };
}

