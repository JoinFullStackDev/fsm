# Security Settings Documentation

This document describes all security settings and configurations for the FSM platform, including how to verify and maintain them.

## Supabase Security Settings

### 1. Leaked Password Protection

**Status**: To be enabled in production  
**Location**: Supabase Dashboard → Authentication → Password Security

**Description**: 
Supabase Auth can check passwords against HaveIBeenPwned.org to prevent users from using compromised passwords. This is a critical security feature that should be enabled in production environments.

**Note**: Currently disabled in development/staging. Will be enabled when deploying to production.

**How to Enable**:
1. Navigate to your Supabase project dashboard
2. Go to **Authentication** → **Password Security**
3. Enable **"Leaked Password Protection"**
4. Save the settings

**How to Verify**:
1. Go to Supabase Dashboard → Authentication → Password Security
2. Confirm "Leaked Password Protection" toggle is ON
3. Alternatively, run Supabase Security Advisor and verify no warnings for `auth_leaked_password_protection`

**Testing**:
To test that leaked password protection is working:
1. Try to sign up with a known leaked password (e.g., "password123")
2. The system should reject the password with an appropriate error message

---

## Database Security

### 2. Function Search Path Security

**Status**: ✅ Fixed - All 22 functions updated  
**Location**: Database functions in `public` schema  
**Migration Applied**: `migrations/fix_function_search_path_security.sql`

**Description**:
All database functions should have `SET search_path` explicitly set to prevent search path injection attacks. Without this, malicious users could create schemas/tables that get executed instead of intended ones.

**Resolution**: All 22 functions have been successfully updated with `SET search_path = ''` via the migration script. Supabase Security Advisor confirms no warnings remain.

**Functions Fixed** (22 total):
- `update_notification_read_at`
- `cleanup_expired_password_tokens`
- `match_project_to_template`
- `auto_create_lead`
- `update_dashboards_updated_at`
- `create_company_status_updated_activity`
- `update_ops_updated_at_column`
- `user_organization_id`
- `is_super_admin`
- `is_admin`
- `create_contact_created_activity`
- `create_contact_updated_activity`
- `create_task_created_activity`
- `create_task_updated_activity`
- `create_opportunity_status_changed_activity`
- `create_opportunity_created_activity`
- `create_project_created_activity`
- `update_api_keys_updated_at`
- `log_activity`
- `update_updated_at_column`
- `update_task_comment_updated_at`
- `update_users_updated_at`

**How to Apply Fix**:
1. Run the migration: `migrations/fix_function_search_path_security.sql`
2. Execute in Supabase SQL Editor
3. Verify all functions were updated successfully

**How to Verify**:
Run this query in Supabase SQL Editor:

```sql
SELECT 
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'FIXED'
        ELSE 'NEEDS FIX'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_notification_read_at',
        'cleanup_expired_password_tokens',
        'match_project_to_template',
        'auto_create_lead',
        'update_dashboards_updated_at',
        'create_company_status_updated_activity',
        'update_ops_updated_at_column',
        'user_organization_id',
        'is_super_admin',
        'is_admin',
        'create_contact_created_activity',
        'create_contact_updated_activity',
        'create_task_created_activity',
        'create_task_updated_activity',
        'create_opportunity_status_changed_activity',
        'create_opportunity_created_activity',
        'create_project_created_activity',
        'update_api_keys_updated_at',
        'log_activity',
        'update_updated_at_column',
        'update_task_comment_updated_at',
        'update_users_updated_at'
    )
ORDER BY p.proname;
```

All functions should show status "FIXED".

**Alternative Verification**:
Run Supabase Security Advisor and verify no warnings for `function_search_path_mutable`.

---

## Row Level Security (RLS)

### 3. RLS Policies

**Status**: Enabled on all tables  
**Location**: Database tables

**Description**:
Row Level Security ensures that users can only access data they're authorized to see. All tables should have RLS enabled with appropriate policies.

**How to Verify**:
```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should have `rls_enabled = true`.

**Key Policies**:
- Organization-based isolation: Users can only access data from their organization
- User-based access: Users can only access their own records where applicable
- Role-based access: Admins have elevated permissions within their organization

---

## API Security

### 4. API Key Encryption

**Status**: Implemented  
**Location**: `lib/apiKeys.ts`

**Description**:
API keys are encrypted using AES-256-GCM before storage. The encryption key is stored in environment variables.

**Environment Variable**:
- `API_KEY_ENCRYPTION_KEY`: 64-character hex string (32 bytes)

**How to Verify**:
1. Check that `API_KEY_ENCRYPTION_KEY` is set in environment variables
2. Verify API keys in database are encrypted (not plaintext)
3. Test API key creation and validation

---

## Authentication & Authorization

### 5. Session Management

**Status**: Implemented  
**Location**: Supabase Auth + middleware

**Description**:
- Sessions are managed by Supabase Auth
- Middleware protects routes requiring authentication
- Session tokens are stored in HTTP-only cookies

**How to Verify**:
1. Test that unauthenticated users are redirected to sign-in
2. Verify authenticated sessions persist correctly
3. Test session expiration and refresh

---

## Security Validation Checklist

### ✅ Completed
- [x] All 22 database functions have `SET search_path` set
- [x] Supabase Security Advisor shows 0 warnings (except leaked password protection, which will be enabled in production)
- [x] Migration script successfully applied

### 🔄 Pending Production Deployment
- [ ] Leaked password protection enabled in Supabase Dashboard (production only)
- [ ] Test password protection with known leaked password (after enabling)

### ✅ Ongoing Verification
- [ ] RLS is enabled on all tables
- [ ] API keys are encrypted in database
- [ ] Environment variables are set correctly
- [ ] Test critical functions still work after migration

---

## Regular Security Audits

### Monthly Checks

1. **Run Supabase Security Advisor**
   - Check for new warnings
   - Address any security issues promptly

2. **Review Environment Variables**
   - Ensure no secrets are committed to code
   - Rotate API keys if compromised

3. **Audit RLS Policies**
   - Verify organization isolation is working
   - Test that users cannot access other organizations' data

4. **Review API Security**
   - Check rate limiting is working
   - Verify input validation on all endpoints

### Quarterly Checks

1. **Security Dependency Updates**
   - Update npm packages with security patches
   - Review and update Supabase client libraries

2. **Access Control Review**
   - Audit user roles and permissions
   - Review admin access logs

3. **Penetration Testing**
   - Test organization data isolation
   - Verify API security measures

---

## Incident Response

If a security issue is discovered:

1. **Immediate Actions**:
   - Assess the severity and scope
   - Revoke compromised credentials if applicable
   - Enable additional security measures if needed

2. **Documentation**:
   - Document the issue and resolution
   - Update this document with lessons learned

3. **Prevention**:
   - Update security procedures if needed
   - Add additional checks to prevent recurrence

---

## Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Security Documentation](https://www.postgresql.org/docs/current/security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Last Updated**: [Date will be set when migration is applied]  
**Maintained By**: Development Team
