# is_company_admin Field Implementation

## ✅ What Was Done

### 1. Database Migration
**File:** `migrations/add_is_company_admin_field.sql`

- Added `is_company_admin` BOOLEAN field to `users` table
- Created index for faster queries
- Set initial values based on current logic: `role = 'admin' AND is_super_admin = false AND organization_id IS NOT NULL`
- Added documentation comment

### 2. TypeScript Types
**File:** `types/project.ts`

- Added `is_company_admin?: boolean` to `User` interface

### 3. Helper Functions
**File:** `lib/companyAdmin.ts` (NEW)

Created utility functions:
- `requireCompanyAdmin(request)` - Throws error if not company admin
- `isCompanyAdmin(userId)` - Check if user is company admin by DB ID
- `isCompanyAdminByAuthId(authId)` - Check if user is company admin by auth ID

### 4. Middleware Update
**File:** `middleware.ts`

- Updated to select `is_company_admin` field when checking user data

---

## 📋 Next Steps

### 1. Run the Migration
Run `migrations/add_is_company_admin_field.sql` in Supabase SQL Editor.

This will:
- Add the field
- Set initial values based on current logic
- Show verification results

### 2. Manually Set Company Admins
After running the migration, manually set `is_company_admin = true` for users who should be company admins:

```sql
-- Example: Set specific users as company admins
UPDATE users
SET is_company_admin = true
WHERE email IN (
  'user1@example.com',
  'user2@example.com'
);

-- Or set all admins in a specific organization
UPDATE users
SET is_company_admin = true
WHERE organization_id = 'your-org-id'::uuid
  AND role = 'admin';
```

### 3. Update Code to Use is_company_admin

**Files that may need updates:**
- Routes that check for company admin access
- Components that show/hide features based on company admin status
- API routes that require company admin permissions

**Search for:** `role === 'admin' && is_super_admin === false` or similar patterns

**Replace with:** `is_company_admin === true`

---

## 🔍 Where to Use is_company_admin

### Use `is_company_admin` for:
- ✅ Organization-level admin features
- ✅ Managing organization settings
- ✅ Managing organization users
- ✅ Organization module overrides
- ✅ Organization-specific admin panels

### Use `is_super_admin` for:
- ✅ Global admin features (`/global/admin/*`)
- ✅ Cross-organization access
- ✅ System-wide settings
- ✅ Managing all organizations

---

## 📝 Example Usage

### In API Routes:
```typescript
import { requireCompanyAdmin } from '@/lib/companyAdmin';

export async function POST(request: NextRequest) {
  const { userId, organizationId } = await requireCompanyAdmin(request);
  // Now you have userId and organizationId
}
```

### In Components:
```typescript
import { useRole } from '@/lib/hooks/useRole';

function MyComponent() {
  const { role, isSuperAdmin } = useRole();
  // Need to fetch is_company_admin from user data
  // Or add it to useRole hook
}
```

---

## ⚠️ Important Notes

1. **Migration sets initial values** - Based on `role = 'admin' AND is_super_admin = false AND organization_id IS NOT NULL`
2. **Manual review needed** - You'll need to manually verify and set `is_company_admin` for existing users
3. **Future users** - When creating new company admins, set `is_company_admin = true` explicitly
4. **Super admins** - Super admins should have `is_company_admin = false` (they're global admins, not company admins)

---

## 🎯 Benefits

- ✅ Clear distinction between company admins and super admins
- ✅ Easier to query: `WHERE is_company_admin = true`
- ✅ More reliable than checking `role = 'admin' AND is_super_admin = false`
- ✅ Can have multiple company admins per organization
- ✅ Better for future features (e.g., company admin roles/permissions)

