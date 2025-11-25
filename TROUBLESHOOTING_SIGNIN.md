# Troubleshooting Sign-In Issues

## Common Issues and Solutions

### 1. "Email not confirmed" Error

**Problem:** Supabase requires email confirmation but you haven't confirmed your email.

**Solution:**
- Check your email inbox (and spam folder) for the confirmation link
- Click the "Resend Confirmation Email" button on the sign-in page
- Or disable email confirmation in Supabase Dashboard:
  - Go to Authentication → Settings
  - Toggle "Enable email confirmations" to OFF

### 2. "Account exists but user record is missing"

**Problem:** The user was created in Supabase Auth but the record in the `users` table is missing.

**Solution:**
- Run the `create_user_record` function SQL in your Supabase SQL Editor:
  ```sql
  -- See create_user_function_solution.sql
  ```
- Or manually create the user record:
  ```sql
  INSERT INTO users (auth_id, email, name, role)
  VALUES (
    'YOUR_AUTH_ID_HERE',
    'your-email@example.com',
    'Your Name',
    'pm'
  );
  ```

### 3. "Invalid login credentials"

**Problem:** Wrong email or password.

**Solution:**
- Double-check your email and password
- Use the "Forgot password" link to reset your password
- Verify the user exists in Supabase Dashboard → Authentication → Users

### 4. RLS Policy Issues

**Problem:** Row Level Security policies are blocking access.

**Solution:**
- Verify RLS policies in `supabase-schema.sql` are correctly applied
- Check that the `users` table has the correct SELECT policy:
  ```sql
  create policy "Users can read own user record"
    on users for select
    using (auth.uid() = auth_id);
  ```

### 5. Missing Database Function

**Problem:** The `create_user_record` function doesn't exist.

**Solution:**
- Run the SQL from `create_user_function_solution.sql` in your Supabase SQL Editor
- This function is needed to create user records during signup

## Quick Diagnostic Steps

1. **Check Supabase Dashboard:**
   - Go to Authentication → Users
   - Verify your user exists
   - Check if email is confirmed

2. **Check Database:**
   - Go to Table Editor → `users` table
   - Verify your user record exists
   - Check that `auth_id` matches your Supabase Auth user ID

3. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Look for error messages in the Console tab
   - Check Network tab for failed API requests

4. **Verify Environment Variables:**
   - Check `.env.local` has correct Supabase URL and anon key
   - Restart your dev server after changing env vars

## Testing the Sign-In Flow

1. Try signing in with your credentials
2. Check the error message (if any)
3. Use the "Show Debug Info" button on the sign-in page
4. Check browser console for detailed errors
5. Verify the `create_user_record` function exists in Supabase

## If Nothing Works

1. Try creating a new account with a different email
2. Check Supabase logs: Dashboard → Logs → API Logs
3. Verify all SQL migrations have been run
4. Check that RLS policies are correctly configured

