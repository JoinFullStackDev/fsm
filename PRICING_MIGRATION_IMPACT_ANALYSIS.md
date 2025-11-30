# Pricing Model Migration - Impact Analysis

## Overview

This document outlines all code changes needed throughout the application to support the new flexible pricing model where packages have both monthly and yearly prices, and customers choose their billing interval at checkout.

## Critical Issue: Subscription Billing Interval

**Problem**: We need to know which billing interval (month/year) a subscription is using to display the correct price.

**Solution**: Add `billing_interval` field to `subscriptions` table to track which interval the customer selected.

## Database Changes Required

### Subscriptions Table Migration

Add `billing_interval` column to track customer's choice:
```sql
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('month', 'year'));

-- Migrate existing subscriptions: default to 'month' if not set
UPDATE subscriptions
SET billing_interval = 'month'
WHERE billing_interval IS NULL;
```

## Files Requiring Updates

### 1. Database & Types

**File**: `migrations/add_billing_interval_to_subscriptions.sql` (NEW)
- Add `billing_interval` column to subscriptions table

**File**: `lib/organizationContext.ts`
- Update `Subscription` interface to include `billing_interval: 'month' | 'year' | null`

### 2. Subscription Creation & Management

**File**: `app/api/organization/subscription/route.ts`
- Store `billing_interval` when creating subscription from checkout metadata
- Update package query to select new pricing fields (for logging/debugging)

**File**: `lib/stripe/subscriptions.ts`
- **BUG FIX**: Line 185 uses `packageData.stripe_price_id` instead of `priceId` - needs fix
- Already updated to accept `billingInterval` parameter ✓

**File**: `lib/stripe/webhooks.ts`
- Store `billing_interval` from Stripe subscription metadata when updating subscription
- Extract billing interval from Stripe price's recurring interval

### 3. Subscription Display Components

**File**: `app/organization/settings/page.tsx` (Line 268)
- **Current**: Displays `${packageData.price_per_user_monthly}/user/month`
- **Needed**: Display price based on subscription's `billing_interval`
- Show correct monthly or yearly price from package

**File**: `components/admin/AdminSubscriptionTab.tsx` (Line 354)
- **Current**: Displays `${subscription.package.price_per_user_monthly}/mo`
- **Needed**: Display price based on subscription's `billing_interval`
- Update Package interface (Line 54) to include new pricing fields
- Show correct monthly or yearly price

**File**: `app/global/admin/organizations/[id]/page.tsx` (Line 530)
- **Current**: Displays `${organization.package.price_per_user_monthly}/user/month`
- **Needed**: Display price based on subscription's `billing_interval`
- Show correct monthly or yearly price

### 4. Package Change/Upgrade Flows

**File**: `app/api/organization/subscription/change/route.ts`
- **Current**: Only handles monthly prices, uses `stripe_price_id` and `price_per_user_monthly`
- **Needed**: 
  - Accept `billing_interval` parameter (default to existing subscription's interval)
  - Use correct price ID based on selected interval
  - Update subscription's `billing_interval` field
  - Handle both monthly and yearly price lookups

**File**: `app/api/global/admin/organizations/[id]/subscription/route.ts`
- **Current**: Only handles monthly prices, uses `stripe_price_id` and `price_per_user_monthly`
- **Needed**:
  - Accept `billing_interval` parameter when changing packages
  - Use correct price ID based on selected interval
  - Update subscription's `billing_interval` field
  - Handle both monthly and yearly price lookups

**File**: `components/admin/AdminSubscriptionTab.tsx`
- **Current**: Package change UI doesn't show billing interval selection
- **Needed**: Add billing interval selector when changing packages
- Show both monthly and yearly prices for available packages

### 5. Landing Page

**File**: `app/page.tsx` (Line 48)
- **Current**: Package interface only has `price_per_user_monthly`
- **Needed**: Update interface to include new pricing fields
- Update pricing display to show both monthly/yearly options

### 6. Type Definitions

**File**: `components/admin/AdminSubscriptionTab.tsx` (Lines 43-64)
- **Current**: Subscription and Package interfaces use old fields
- **Needed**: Update interfaces to include `billing_interval` and new pricing fields

## Implementation Strategy

### Phase 1: Database & Core Types
1. Create migration to add `billing_interval` to subscriptions table
2. Update `Subscription` interface in `lib/organizationContext.ts`
3. Update subscription creation to store `billing_interval` from checkout metadata

### Phase 2: Display Updates
1. Update all pricing display components to use subscription's `billing_interval`
2. Create helper function to get correct price from package based on interval
3. Update all Package interfaces in components

### Phase 3: Package Change Flows
1. Update subscription change APIs to accept and handle `billing_interval`
2. Add billing interval selection to package change UI
3. Update Stripe subscription updates to use correct price ID

### Phase 4: Webhook Updates
1. Update webhook handler to extract and store `billing_interval` from Stripe
2. Ensure billing interval is preserved during subscription updates

## Helper Function Needed

Create a utility function to get the correct price from a package based on billing interval:

```typescript
function getPackagePrice(
  package: Package,
  billingInterval: 'month' | 'year',
  pricingModel: 'per_user' | 'flat_rate'
): number | null {
  if (pricingModel === 'per_user') {
    return billingInterval === 'month' 
      ? package.price_per_user_monthly 
      : package.price_per_user_yearly;
  } else {
    return billingInterval === 'month'
      ? package.base_price_monthly
      : package.base_price_yearly;
  }
}
```

## Backward Compatibility

- Existing subscriptions without `billing_interval` should default to 'month'
- Display logic should fall back to monthly price if interval is not set
- Legacy `price_per_user_monthly` field can still be used as fallback

## Testing Checklist

- [ ] New subscriptions store correct billing interval
- [ ] Pricing displays correctly based on subscription interval
- [ ] Package changes preserve or allow changing billing interval
- [ ] Webhooks update billing interval correctly
- [ ] Free packages work correctly
- [ ] Packages with only monthly or only yearly prices work
- [ ] Admin UI shows correct prices for both intervals
- [ ] Landing page displays both pricing options

