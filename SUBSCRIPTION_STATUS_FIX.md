# Subscription Status Enum Fix

## The Problem

There are **TWO different enums** for subscription status:

1. **`organizations.subscription_status`** uses `subscription_status_enum`:
   - Values: `'trial'`, `'active'`, `'past_due'`, `'canceled'`, `'incomplete'`
   - **Uses `'trial'` (NOT 'trialing')**

2. **`subscriptions.status`** uses `subscription_status_type`:
   - Values: `'active'`, `'canceled'`, `'past_due'`, `'trialing'`
   - **Uses `'trialing'` (NOT 'trial')**

## What Was Wrong

The code was using `'trialing'` for `organizations.subscription_status`, but the database enum only accepts `'trial'`. This caused errors when trying to create or update organizations.

## What Was Fixed

1. **TypeScript Interface** (`lib/organizationContext.ts`):
   - Changed `subscription_status: 'trialing'` → `'trial'`
   - Changed `trialing_ends_at` → `trial_ends_at` (to match database column name)

2. **API Routes** - Fixed all places setting `organizations.subscription_status`:
   - `app/api/auth/create-organization/route.ts` - Changed `'trialing'` → `'trial'`
   - `app/api/organization/subscription/route.ts` - Changed `'trialing'` → `'trial'` and `trialing_ends_at` → `trial_ends_at`
   - `app/api/admin/organizations/[id]/subscription/route.ts` - Changed `'trialing'` → `'trial'` and `trialing_ends_at` → `trial_ends_at`

3. **Subscription Queries** - These are CORRECT (they check `subscriptions.status`):
   - `lib/organizationContext.ts` - Uses `['active', 'trialing']` for subscriptions table ✓
   - `app/api/organization/subscription/route.ts` - Uses `['active', 'trialing']` for subscriptions table ✓
   - All other subscription queries use `'trialing'` correctly ✓

## Summary

- **`organizations.subscription_status`** = `'trial'` (for organizations table)
- **`subscriptions.status`** = `'trialing'` (for subscriptions table)
- **Column name**: `trial_ends_at` (not `trialing_ends_at`)

## Testing

After this fix:
1. Creating a new organization should work (uses `'trial'`)
2. Creating a subscription should work (uses `'trialing'` for subscriptions table, `'trial'` for organizations table)
3. All subscription queries should work (they check `subscriptions.status` which uses `'trialing'`)

