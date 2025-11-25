# Ops Tool Implementation - Gap Analysis

## Critical Missing Pages/Forms

### 1. Edit Forms (All Missing)
- ❌ `/ops/companies/[id]/edit/page.tsx` - Company edit form
- ❌ `/ops/contacts/[id]/edit/page.tsx` - Contact edit form  
- ❌ `/ops/opportunities/[id]/edit/page.tsx` - Opportunity edit form

**Impact**: Users cannot edit companies, contacts, or opportunities after creation. All edit buttons lead to 404.

### 2. Create Forms (Missing)
- ❌ `/ops/contacts/new/page.tsx` - Global contact creation (without company context)
- ❌ `/ops/opportunities/new/page.tsx` - Global opportunity creation

**Impact**: Users can only create contacts/opportunities from company detail pages, not from global lists.

### 3. Task Management UI (Incomplete)
- ⚠️ `/components/ops/CompanyTasksTab.tsx` - Has TODO comments, no create/edit dialogs
- ❌ Task create/edit dialogs/components
- ❌ Task detail view/slideout

**Impact**: Tasks can be created via API but not through UI. Delete works, but create/edit show error messages.

## Missing Functionality

### 4. Project Creation Integration
- ❌ Company selection dropdown in `/app/project/new/page.tsx`
- ⚠️ `company_id` query parameter is passed from CompanyProjectsTab but NOT read/used in project creation form
- ❌ Display of `source` and `company_id` in project lists
- ❌ Projects API GET doesn't support filtering by `company_id` query parameter
- ❌ Projects API GET doesn't return company information (join with companies table)

**Impact**: Cannot link projects to companies during creation. Projects created from opportunities won't show company association in UI. Cannot filter projects by company.

### 5. Dashboard Integration
- ❌ Ops Tool quick links/widgets on dashboard
- ❌ Ops Tool metrics/cards
- ❌ Recent companies/opportunities display

**Impact**: No entry point to Ops Tool from dashboard (only via sidebar).

### 6. Contact Detail View
- ❌ Contact slideout/detail panel (mentioned in plan)
- ❌ Contact detail page (`/ops/contacts/[id]/page.tsx`)
- ❌ Contact notes/tasks display

**Impact**: Cannot view full contact details, only in table format.

### 7. Opportunity Detail View
- ❌ Opportunity detail page (`/ops/opportunities/[id]/page.tsx`)
- ❌ Opportunity status update component (mentioned in plan)
- ❌ Opportunity conversion UI (API exists, but no dedicated UI)

**Impact**: Cannot view opportunity details or manage conversion workflow.

### 8. Company Form Components
- ❌ Reusable `CompanyForm.tsx` component (create/edit)
- ❌ Reusable `ContactForm.tsx` component (create/edit)
- ❌ Reusable `OpportunityForm.tsx` component (create/edit)

**Impact**: Code duplication, harder to maintain.

## Data Display Issues

### 9. Project Lists Missing Ops Fields
- ❌ Display `source` (Manual/Converted) in project tables
- ❌ Display `company_id` or company name in project lists
- ❌ Filter projects by company
- ❌ Link to company from project detail

**Impact**: Cannot see which projects belong to companies or were converted from opportunities.

### 10. Activity Feed Enhancements
- ⚠️ Basic activity feed exists but missing:
  - Click-through links to referenced entities
  - Event type icons/badges
  - Better formatting/grouping

**Impact**: Activity feed is functional but basic.

## API Gaps

### 11. Projects API Filtering
- ❌ GET `/api/projects` doesn't filter by `company_id` query parameter (CompanyProjectsTab calls it but it doesn't work)
- ❌ Projects API doesn't return company information in responses (no join with companies table)
- ❌ Projects API GET doesn't return `source` field in response

**Impact**: Cannot efficiently fetch projects for a company. CompanyProjectsTab will show all projects, not just company's projects. Cannot display company info or source in project lists.

### 12. Missing API Endpoints
- ❌ GET `/api/ops/companies/[id]/projects` - Company-scoped projects
- ❌ GET `/api/ops/companies/[id]/opportunities` - Company-scoped opportunities (exists but not used)

**Impact**: Inefficient data loading, multiple API calls needed.

## UI/UX Issues

### 13. Empty States
- ⚠️ Some tabs/components have basic empty states, but could be more informative
- ❌ Empty state for companies with no activity

### 14. Loading States
- ⚠️ Basic loading states exist, but could be more consistent
- ❌ Skeleton loaders for company detail tabs

### 15. Error Handling
- ⚠️ Basic error handling exists
- ❌ Better error recovery/retry mechanisms

### 16. Search/Filter Enhancement
- ⚠️ Basic search exists
- ❌ Advanced filtering (date ranges, multiple statuses, etc.)
- ❌ Saved filters

## Navigation Issues

### 17. Breadcrumbs
- ❌ Breadcrumb navigation for nested routes
- ❌ Back button consistency

### 18. Deep Linking
- ⚠️ Some deep links work, but:
  - No support for tab state in URL (`/ops/companies/[id]?tab=opportunities`)
  - No support for filters in URL

## Testing

### 19. Unit Tests
- ❌ All API route tests missing
- ❌ Utility function tests missing

### 20. Component Tests
- ❌ All component tests missing

## Edge Cases Not Handled

### 21. Data Validation
- ⚠️ Basic validation exists
- ❌ Email format validation for contacts
- ❌ Phone number format validation
- ❌ Duplicate contact detection (same email in same company)

### 22. Cascade Delete Warnings
- ⚠️ Delete confirmations exist
- ❌ Better warnings showing what will be deleted (counts of related records)

### 23. Opportunity Conversion
- ⚠️ API prevents duplicate conversion
- ❌ UI doesn't disable convert button for already-converted opportunities
- ❌ Better feedback during conversion

## Performance Optimizations

### 24. Data Loading
- ⚠️ Some unnecessary API calls
- ❌ No pagination for large lists
- ❌ No virtual scrolling for long tables
- ❌ No caching of company/contact data

### 25. Count Queries
- ⚠️ Counts loaded separately for each company
- ❌ Could be optimized with single query

## Summary

### Critical (Blocks Core Functionality)
1. Edit forms for companies, contacts, opportunities
2. Create forms for contacts and opportunities (global)
3. Task create/edit UI
4. Project creation company selection

### High Priority (Major UX Issues)
5. Contact detail view/slideout
6. Opportunity detail view
7. Project list display of Ops fields
8. Dashboard integration

### Medium Priority (Enhancements)
9. Reusable form components
10. Better activity feed
11. Advanced filtering
12. Breadcrumbs/navigation improvements

### Low Priority (Polish)
13. Tests
14. Performance optimizations
15. Edge case handling improvements

## Quick Wins (Can Fix Immediately)
1. Add company selection to project creation form (read query param + dropdown)
2. Create edit forms (copy from new forms, just change to PUT requests)
3. Add source/company display to project lists
4. Create task dialogs (simple form dialogs)
5. Add dashboard quick links
6. Fix Projects API to support company_id filtering
7. Create global contact/opportunity creation pages

## Additional Findings

### 26. Route Parameter Handling
- ⚠️ CompanyOpportunitiesTab passes `company_id` query param to `/ops/opportunities/new` but that page doesn't exist
- ⚠️ CompanyProjectsTab passes `company_id` query param to `/project/new` but form doesn't read it
- ⚠️ Company detail page redirects "new"/"edit" but should handle route conflicts better

### 27. Data Consistency
- ⚠️ CompanyProjectsTab calls `/api/projects?company_id=X` but API doesn't filter - will show ALL projects
- ⚠️ No validation that company_id exists when creating projects
- ⚠️ No way to unlink project from company

### 28. Missing Detail Pages
- ❌ Company detail shows tabs but no way to view individual contact/opportunity details
- ❌ No way to navigate from contact to their company
- ❌ No way to navigate from opportunity to company detail

### 29. Form Validation
- ⚠️ Basic validation exists
- ❌ No email format validation
- ❌ No phone format validation  
- ❌ No duplicate detection (same contact email in company)
- ❌ No validation that opportunity value is positive number

### 30. User Experience
- ❌ No way to bulk select/delete contacts/opportunities
- ❌ No export functionality for companies/contacts/opportunities
- ❌ No import functionality
- ❌ No way to merge duplicate companies/contacts

