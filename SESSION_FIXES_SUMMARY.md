# Session Fixes Summary - December 1, 2025

## 1. Project Creation Page Fixes (`/project/new`)

### Issues Fixed:
- **Users dropdown**: Now only shows users from the current organization (uses `/api/users` API route)
- **Companies dropdown**: Already correctly filtered by organization via `/api/ops/companies`
- **Templates dropdown**: Now shows org-specific templates + global public templates (removed incorrect client-side filter)
- **CSRF Token Error**: Added `getCsrfHeaders()` to project creation form submission

### Files Changed:
- `app/project/new/page.tsx`
  - Changed `loadUsers()` to use `/api/users` API route
  - Fixed `loadTemplates()` to use all returned templates (API already filters correctly)
  - Added CSRF token headers to project creation request

## 2. Contact Creation Fixes

### Issues Fixed:
- **"relation 'leads' does not exist" error**: Removed call to `createLeadFromContact()` function
- **"relation 'activity_feed_items' does not exist" error**: Updated `createActivityFeedItem()` to handle missing table gracefully

### Database Changes Required:
- Run in Supabase SQL Editor: `DROP FUNCTION IF EXISTS auto_create_lead() CASCADE;`
- Drop any triggers on `company_contacts` that reference `activity_feed_items` table

### Files Changed:
- `app/api/ops/companies/[id]/contacts/route.ts`
  - Removed import and call to `createLeadFromContact`
  - Updated to use admin client for contact creation
  - Enhanced error handling for activity feed creation
- `lib/ops/activityFeed.ts`
  - Updated `createActivityFeedItem()` to return `ActivityFeedItem | null`
  - Added graceful handling when `activity_feed_items` table doesn't exist
- `app/api/ops/contacts/[id]/attachments/route.ts`
- `app/api/ops/contacts/[id]/interactions/route.ts`
- `app/api/ops/contacts/[id]/tags/route.ts`
  - Added null checks for `activityResult` before accessing `.id`

## 3. UI Improvements

### Breadcrumbs Fix:
- **Duplicate breadcrumbs in KB articles**: Removed breadcrumbs from `ArticleViewer` component (handled by parent page)
- Files: `components/kb/ArticleViewer.tsx`

### Alignment Fixes:
- **Opportunity detail page**: Added `justifyContent: 'space-between'` on desktop for header layout
- Files: `app/ops/opportunities/[id]/page.tsx`

- **Related content width**: Made RelatedArticles component match ArticleViewer width (maxWidth: 900)
- Files: `components/kb/RelatedArticles.tsx`

### Related Content Enhancements:
- **Related Phases**: Now shows phase name, project name, and matching keywords as visual indicators
- **Related Tasks**: Now shows project name and matching keywords as visual indicators
- Files:
  - `lib/kb/linking.ts` - Enhanced to return phase_name, project_name, matching_keywords
  - `types/kb.ts` - Updated RelatedContent interface
  - `components/kb/RelatedArticles.tsx` - Enhanced UI with keyword chips and project info

## Build Fixes

### TypeScript Errors:
- Fixed null check issues for `activityResult` in contact attachment/interaction/tag routes
- All files now properly handle `createActivityFeedItem()` returning `null`

## Key Takeaways

1. **Organization Filtering**: All dropdowns now properly filter by organization
2. **CSRF Protection**: All form submissions now include CSRF tokens
3. **Database Triggers**: Removed redundant triggers that were causing errors (leads, activity_feed_items)
4. **Error Handling**: Enhanced graceful handling for optional features (activity feed, leads table)
5. **User Experience**: Related content now shows visual indicators explaining connections
