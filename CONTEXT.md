# Project Context - FSM (Full Stack Management)

## Current Status
**Last Updated**: Current session
**Build Status**: Should be passing (all TypeScript errors resolved)

## Recent Major Changes

### 1. Signup & Payment Flow
- **Payment-first flow**: Users now pay via Stripe BEFORE account creation to avoid email confirmation issues
- **Signup flow**: `/auth/signup` → Stripe Checkout → `/auth/signup-callback` → Account creation
- **Key files**:
  - `app/auth/signup/page.tsx` - Signup page with package selection
  - `app/auth/signup-callback/page.tsx` - Post-payment callback handler
  - `app/api/stripe/create-signup-checkout/route.ts` - Creates Stripe checkout session
  - `app/api/auth/create-organization/route.ts` - Creates organization (idempotent)
  - `app/api/auth/create-user-with-org/route.ts` - Creates user record

### 2. Package Assignment & Features
- **Fixed**: Packages are now correctly assigned during signup
- **Fixed**: Package features load correctly even if subscription status isn't 'active'
- **Key files**:
  - `lib/organizationContext.ts` - Loads packages regardless of subscription status
  - `app/api/organization/subscription/route.ts` - Handles subscription creation with package_id
  - `lib/stripe/subscriptions.ts` - Preserves package_id in webhook updates
  - `lib/stripe/webhooks.ts` - Uses package_id from Stripe metadata

### 3. User Record Creation
- **Fixed**: "User record exists but could not be retrieved" error
- **Solution**: Enhanced retry logic, multiple lookup methods (auth_id, email), direct admin client inserts
- **Key file**: `app/api/auth/create-user-record/route.ts`

### 4. Organization-Scoped Analytics
- **Fixed**: Analytics tab on `/admin` now shows only organization-specific data
- **Key file**: `components/admin/AdminAnalyticsTab.tsx`

### 5. Database Schema
- **Users table**: `organization_id` is nullable (set after organization creation)
- **Trigger**: `handle_new_user()` handles NULL organization_id gracefully
- **Migration**: `migrations/fix_user_trigger_organization_id.sql`

## Architecture Overview

### Authentication Flow
1. User signs up → Data stored in `sessionStorage`
2. Redirect to Stripe Checkout (for paid packages)
3. After payment → `/auth/signup-callback`
4. Create organization → Create auth user → Create user record → Link subscription
5. Email confirmation required → User signs in → User record created if missing

### Organization Context
- **Provider**: `components/providers/OrganizationProvider.tsx`
- **API**: `app/api/organization/context/route.ts`
- **Loads**: Organization, subscription, package, and merged features (package + module_overrides)

### Package Features System
- **Base features**: Defined in `packages` table `features` JSONB column
- **Module overrides**: Defined in `organizations.module_overrides` JSONB column
- **Merged features**: Package features + organization overrides (overrides take precedence)
- **Modules**: Defined in `lib/modules.ts` (e.g., `ops_tool_enabled`, `analytics_enabled`)

### Subscription Management
- **Status mapping**: 
  - Organizations: `'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete'`
  - Subscriptions: `'active' | 'trialing' | 'canceled' | 'past_due'`
- **Package assignment**: Stored in `subscriptions.package_id`
- **Webhooks**: `lib/stripe/webhooks.ts` handles subscription updates

## Key Files & Their Purposes

### API Routes
- `app/api/organization/subscription/route.ts` - GET/POST subscription (idempotent)
- `app/api/organization/update-status/route.ts` - Updates org subscription_status (priority-based)
- `app/api/organization/update-stripe-customer/route.ts` - Updates org stripe_customer_id
- `app/api/stripe/get-checkout-session/route.ts` - Gets Stripe checkout session details
- `app/api/stripe/get-subscription/route.ts` - Gets Stripe subscription details
- `app/api/auth/create-user-record/route.ts` - Creates user record during signin (if missing)

### Components
- `components/providers/OrganizationProvider.tsx` - Provides org context to app
- `components/admin/AdminAnalyticsTab.tsx` - Organization-scoped analytics
- `components/admin/AdminSubscriptionTab.tsx` - Subscription management UI

### Libraries
- `lib/organizationContext.ts` - Organization context utilities
- `lib/stripe/subscriptions.ts` - Stripe subscription management
- `lib/stripe/webhooks.ts` - Stripe webhook handlers
- `lib/modules.ts` - Module/feature definitions

## Database Schema Notes

### Users Table
- `organization_id` - **Nullable** (set after org creation during signup)
- `auth_id` - Links to Supabase auth.users.id
- Trigger `handle_new_user()` creates user record on auth signup

### Organizations Table
- `subscription_status` - Current subscription status
- `stripe_customer_id` - Stripe customer ID
- `module_overrides` - JSONB for feature overrides
- `logo_url`, `icon_url` - Custom branding

### Subscriptions Table
- `package_id` - **Required** - Links to packages table
- `stripe_subscription_id` - Stripe subscription ID (unique)
- `status` - Subscription status from Stripe

### Packages Table
- `stripe_price_id` - Stripe price ID (format: `price_...`)
- `stripe_product_id` - Stripe product ID (format: `prod_...`)
- `features` - JSONB with package features

## Important Patterns

### Idempotency
- Organization creation: Checks for existing org by slug
- Subscription creation: Uses `ON CONFLICT` on `stripe_subscription_id`
- Status updates: Priority-based to prevent downgrades

### Error Handling
- User record creation: Multiple retry attempts with delays
- Package lookup: Falls back to most recent subscription if not active
- Webhook handlers: Graceful failures, logs errors

### Type Safety
- Stripe types: Use `as any` type assertions for properties not in TypeScript types
- Supabase: Use admin client for operations that bypass RLS

## Known Issues / Areas to Watch

1. **Email Confirmation**: Users must confirm email before full access (by design)
2. **Race Conditions**: Webhooks and callbacks can fire simultaneously (handled with idempotency)
3. **Package Sync**: Stripe products must be synced manually via admin panel
4. **Module Overrides**: Only boolean features can be overridden (not numeric limits)

## Testing Checklist

- [ ] Signup with paid package → Payment → Account creation → Package features active
- [ ] Signup with free package → Immediate account creation
- [ ] Email confirmation flow → Sign in → User record creation
- [ ] Analytics tab shows only organization data
- [ ] Package features load correctly for all subscription statuses
- [ ] Webhook handling for subscription updates

## Next Steps / Potential Improvements

1. Add automated tests for signup flow
2. Improve error messages for users during signup
3. Add retry logic for failed webhook processing
4. Consider adding package upgrade/downgrade flows
5. Add monitoring/alerting for failed subscription syncs

## Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Build Commands

- `npm run build` - Production build
- `npm run dev` - Development server
- Migrations should be run in Supabase SQL editor

## Common Issues & Solutions

### "User record exists but could not be retrieved"
- **Fixed**: Enhanced lookup with retries and multiple search methods
- **File**: `app/api/auth/create-user-record/route.ts`

### Package features not loading
- **Fixed**: Subscription lookup now finds packages regardless of status
- **File**: `lib/organizationContext.ts`

### Package not assigned during signup
- **Fixed**: package_id now properly passed through signup flow and webhooks
- **Files**: Multiple - see "Package Assignment & Features" section

### Build errors
- **Fixed**: All TypeScript errors resolved
- **Note**: Some Stripe types require `as any` assertions

