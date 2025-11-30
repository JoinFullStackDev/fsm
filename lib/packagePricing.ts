/**
 * Package pricing utilities
 * Client-safe helper functions for package pricing calculations
 * These functions can be safely imported in client components
 */

import type { Package } from './organizationContext';

/**
 * Get the correct price from a package based on billing interval and pricing model
 * @param pkg - Package object
 * @param billingInterval - Billing interval ('month' or 'year')
 * @returns Price amount or null if not available
 */
export function getPackagePrice(
  pkg: Package,
  billingInterval: 'month' | 'year'
): number | null {
  const model = pkg.pricing_model || 'per_user';
  
  if (model === 'per_user') {
    return billingInterval === 'month' 
      ? (pkg.price_per_user_monthly ?? null)
      : (pkg.price_per_user_yearly ?? null);
  } else {
    return billingInterval === 'month'
      ? (pkg.base_price_monthly ?? null)
      : (pkg.base_price_yearly ?? null);
  }
}

/**
 * Format package price for display
 * @param pkg - Package object
 * @param billingInterval - Billing interval ('month' or 'year')
 * @returns Formatted price string (e.g., "$10/user/mo" or "$100/yr")
 */
export function formatPackagePrice(
  pkg: Package,
  billingInterval: 'month' | 'year'
): string {
  const price = getPackagePrice(pkg, billingInterval);
  if (price === null || price === 0) {
    return 'Free';
  }
  
  const model = pkg.pricing_model || 'per_user';
  const suffix = model === 'per_user'
    ? (billingInterval === 'month' ? '/user/mo' : '/user/yr')
    : (billingInterval === 'month' ? '/mo' : '/yr');
  
  return `$${price.toFixed(2)}${suffix}`;
}

