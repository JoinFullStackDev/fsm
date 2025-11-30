# Flexible Pricing Model Architecture (Updated)

## Overview

Refactor the package and Stripe integration to support:

1. **Pricing models**: Per-user OR flat-rate (configurable per package)
2. **Billing intervals**: Monthly AND yearly (both available per package, customer chooses at checkout)
3. **Easy configuration**: Changes to pricing model/interval without code changes

## Database Schema Changes

### Packages Table Migration

Add new columns to `packages` table:

- `pricing_model` (text/enum): `'per_user' | 'flat_rate'` - determines how price is calculated
- `base_price_monthly` (numeric): Base price for flat-rate monthly billing
- `base_price_yearly` (numeric): Base price for flat-rate yearly billing  
- `price_per_user_monthly` (numeric): Price per user for monthly billing (keep existing field)
- `price_per_user_yearly` (numeric): Price per user for yearly billing
- `stripe_price_id_monthly` (text): Stripe price ID for monthly billing
- `stripe_price_id_yearly` (text): Stripe price ID for yearly billing
- Remove `billing_interval` column (packages support both intervals)
- Keep existing `stripe_price_id` for backward compatibility (maps to monthly)

### Migration Strategy

1. Add new columns with nullable defaults
2. Migrate existing data:
   - Set `pricing_model='per_user'`
   - Set `price_per_user_monthly` from existing value
   - Set `stripe_price_id_monthly` from existing `stripe_price_id`
   - Set `price_per_user_yearly` and `base_price_yearly` to null initially
3. Update all code to support both monthly and yearly pricing
4. Customers choose billing interval at checkout

## Code Changes

### 1. Type Definitions

**Files to update:**

- `lib/organizationContext.ts` - Update `Package` interface
- `types/globalAdmin.ts` - Update package-related types

**Changes:**

- Remove `billing_interval` field (not per-package anymore)
- Add `base_price_monthly: number | null`
- Add `base_price_yearly: number | null`
- Add `price_per_user_yearly: number | null`
- Add `stripe_price_id_monthly: string | null`
- Add `stripe_price_id_yearly: string | null`
- Keep `price_per_user_monthly` (no longer deprecated)

### 2. Stripe Integration

**Files to update:**

- `lib/stripe/subscriptions.ts` - Update checkout session creation
- `app/api/stripe/create-signup-checkout/route.ts` - Update price creation logic
- `app/api/stripe/create-checkout/route.ts` - Update checkout flow

**Changes:**

- Accept `billing_interval` parameter at checkout (customer choice)
- Use appropriate price ID based on selected interval (`stripe_price_id_monthly` or `stripe_price_id_yearly`)
- Create Stripe prices for both intervals if they don't exist
- For per-user pricing: Use `price_per_user_monthly` or `price_per_user_yearly` based on interval
- For flat-rate pricing: Use `base_price_monthly` or `base_price_yearly` based on interval

### 3. Package Management APIs

**Files to update:**

- `app/api/global/admin/packages/route.ts` - POST/GET endpoints
- `app/api/global/admin/packages/[id]/route.ts` - PUT endpoint
- `app/api/packages/route.ts` - Public packages endpoint

**Changes:**

- Accept `pricing_model`, `base_price_monthly`, `base_price_yearly`, `price_per_user_monthly`, `price_per_user_yearly` in create/update
- Validate: if `pricing_model='per_user'`, require at least one of `price_per_user_monthly` or `price_per_user_yearly`
- Validate: if `pricing_model='flat_rate'`, require at least one of `base_price_monthly` or `base_price_yearly`
- Return all pricing fields in API responses

### 4. Admin UI

**Files to update:**

- `app/global/admin/packages/page.tsx` - Package management UI

**Changes:**

- Add dropdown for `pricing_model` (Per User / Flat Rate)
- Show both monthly and yearly price fields (always visible)
- For per-user: Show `price_per_user_monthly` and `price_per_user_yearly` fields
- For flat-rate: Show `base_price_monthly` and `base_price_yearly` fields
- Update table display to show both prices
- Update form validation to require at least one price per interval

### 5. Pricing Display Components

**Files to update:**

- `components/landing/PricingCard.tsx` - Landing page pricing cards
- `app/auth/signup/page.tsx` - Signup page package selection

**Changes:**

- Display both monthly and yearly prices
- Show toggle or tabs to switch between monthly/yearly view
- Format pricing correctly (e.g., "$10/user/mo" vs "$100/user/yr")
- Allow customers to select billing interval before checkout

### 6. Checkout Flow

**Files to update:**

- `app/api/stripe/create-signup-checkout/route.ts` - Accept billing_interval parameter
- `app/api/stripe/create-checkout/route.ts` - Accept billing_interval parameter
- `app/auth/signup/page.tsx` - Pass selected billing_interval to checkout

**Changes:**

- Add billing interval selector in signup/checkout flow
- Pass selected `billing_interval` to checkout API
- Use correct Stripe price ID based on selected interval

### 7. Stripe Sync

**Files to update:**

- `app/api/stripe/sync-products/route.ts` - Stripe product sync

**Changes:**

- Sync both monthly and yearly prices from Stripe
- Update `stripe_price_id_monthly` and `stripe_price_id_yearly` separately
- Update corresponding price amounts

## Implementation Order

1. **Database Migration** - Add new columns, remove `billing_interval`, migrate existing data
2. **Type Definitions** - Update TypeScript interfaces
3. **Package APIs** - Update create/update/read endpoints
4. **Admin UI** - Update package management interface to show both prices
5. **Pricing Display** - Update components to show both monthly/yearly options
6. **Checkout Flow** - Add billing interval selection and pass to Stripe
7. **Stripe Integration** - Update price creation and checkout flows
8. **Stripe Sync** - Update sync functionality

## Backward Compatibility

- Keep `stripe_price_id` field during transition (maps to monthly)
- Migrate existing `stripe_price_id` to `stripe_price_id_monthly`
- Gradually migrate all code to use new fields
- Remove deprecated fields in future cleanup

## Additional Changes Required

### Critical: Subscription Billing Interval Tracking

**Problem**: To display the correct price, we need to know which billing interval each subscription uses.

**Solution**: Add `billing_interval` to `subscriptions` table to track customer's choice.

### Subscriptions Table Migration

Add new column:
- `billing_interval` (text/enum): `'month' | 'year'` - tracks which interval the customer selected

### Additional Files Requiring Updates

#### 1. Subscription Creation & Storage

**File**: `app/api/organization/subscription/route.ts`
- Store `billing_interval` from checkout metadata when creating subscription
- Update package query to select new pricing fields

**File**: `lib/stripe/webhooks.ts`
- Extract `billing_interval` from Stripe subscription price's recurring interval
- Store `billing_interval` when updating subscription from webhook

#### 2. Subscription Display Components

**File**: `app/organization/settings/page.tsx` (Line 268)
- **Current**: `${packageData.price_per_user_monthly}/user/month`
- **Needed**: Display price based on subscription's `billing_interval`
- Use helper function to get correct price from package

**File**: `components/admin/AdminSubscriptionTab.tsx` (Line 354)
- **Current**: `${subscription.package.price_per_user_monthly}/mo`
- **Needed**: Display price based on subscription's `billing_interval`
- Update Package interface to include new pricing fields
- Add billing interval selector when changing packages

**File**: `app/global/admin/organizations/[id]/page.tsx` (Line 530)
- **Current**: `${organization.package.price_per_user_monthly}/user/month`
- **Needed**: Display price based on subscription's `billing_interval`

#### 3. Package Change/Upgrade Flows

**File**: `app/api/organization/subscription/change/route.ts`
- **Current**: Only handles monthly, uses `stripe_price_id` and `price_per_user_monthly`
- **Needed**: 
  - Accept `billing_interval` parameter (default to existing subscription's interval)
  - Use `stripe_price_id_monthly` or `stripe_price_id_yearly` based on interval
  - Update subscription's `billing_interval` field

**File**: `app/api/global/admin/organizations/[id]/subscription/route.ts`
- **Current**: Only handles monthly, uses `stripe_price_id` and `price_per_user_monthly`
- **Needed**: 
  - Accept `billing_interval` parameter when changing packages
  - Use correct price ID based on selected interval
  - Update subscription's `billing_interval` field

#### 4. Bug Fixes

**File**: `lib/stripe/subscriptions.ts` (Line 185)
- **Bug**: Uses `packageData.stripe_price_id` instead of `priceId`
- **Fix**: Change to use `priceId` variable

#### 5. Landing Page

**File**: `app/page.tsx` (Line 48)
- Update Package interface to include new pricing fields
- Update pricing display to show both monthly/yearly options

### Helper Function Needed

Create utility to get correct price from package:
```typescript
function getPackagePrice(
  pkg: Package,
  billingInterval: 'month' | 'year'
): number | null {
  const model = pkg.pricing_model || 'per_user';
  if (model === 'per_user') {
    return billingInterval === 'month' 
      ? pkg.price_per_user_monthly 
      : pkg.price_per_user_yearly;
  } else {
    return billingInterval === 'month'
      ? pkg.base_price_monthly
      : pkg.base_price_yearly;
  }
}
```

## Key Benefits

1. **No code changes needed** - Pricing model is data-driven
2. **Flexible pricing** - Support per-user, flat-rate, with both monthly and yearly options
3. **Customer choice** - Customers can choose their preferred billing interval
4. **Easy updates** - Change pricing via admin UI without code changes
5. **Stripe alignment** - Properly create and use Stripe prices for both intervals
6. **Accurate display** - Subscription prices display correctly based on customer's chosen interval

