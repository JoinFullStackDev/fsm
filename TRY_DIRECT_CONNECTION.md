# Try Direct Database Connection (If Possible)

## If You Have Direct Database Access

If you have the direct database connection string (not through Supabase dashboard), you might be able to connect directly and bypass the dashboard issues.

### Using psql (PostgreSQL CLI)

```bash
# If you have connection string
psql "postgresql://[connection-string]"

# Then run:
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

### Using Database Client

If you have a database client (TablePlus, DBeaver, etc.):
1. Connect using direct connection string
2. Run: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`

### Finding Connection String

Check your:
- `.env.local` file for `DATABASE_URL` or `POSTGRES_URL`
- Supabase project settings (if you can access them)
- Previous connection strings you've saved

## Warning

If the database is truly locked at the connection level, even direct connections might timeout. But it's worth trying if you have the connection string.

## Alternative: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db reset --linked
```

This might reset the database, but **WARNING**: This could lose data. Only use if you have backups.

