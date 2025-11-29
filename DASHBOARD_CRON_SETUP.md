# Dashboard Scheduled Reports - Cron Job Setup

This document explains how to configure the cron job for scheduled dashboard reports. The system sends automated email reports with PDF attachments to users who have subscribed to dashboard reports.

## Overview

The scheduled reports feature allows users to subscribe to dashboards and receive automated email reports on a schedule (daily, weekly, or monthly). The cron job checks for due subscriptions and sends reports accordingly.

**Endpoint**: `POST /api/cron/dashboard-reports`

## How It Works

1. Users subscribe to dashboards via the UI (see "Scheduled Reports" button in dashboard viewer)
2. The cron job runs periodically (recommended: once per hour or daily)
3. For each enabled subscription, the system checks if a report is due based on:
   - **Daily**: Last sent more than 24 hours ago
   - **Weekly**: Last sent more than 7 days ago
   - **Monthly**: Last sent more than 30 days ago
4. If due, the system generates a PDF report and emails it to the subscriber
5. The `last_sent_at` timestamp is updated after successful delivery

## Environment Variables

### Required

- `SENDGRID_API_KEY`: SendGrid API key for sending emails
- `SENDGRID_FROM_EMAIL`: Email address to send reports from

### Optional

- `CRON_SECRET`: Secret token for authenticating cron requests (recommended for production)

If `CRON_SECRET` is set, the endpoint will require an `Authorization: Bearer <CRON_SECRET>` header. This prevents unauthorized access to the cron endpoint.

## Setup Options

### Option 1: Vercel Cron (Recommended for Vercel Deployments)

If you're deploying to Vercel, use Vercel Cron Jobs.

#### Step 1: Create `vercel.json`

Create a `vercel.json` file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/dashboard-reports",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule Options:**
- `"0 * * * *"` - Every hour (recommended)
- `"0 0 * * *"` - Once daily at midnight UTC
- `"0 9 * * *"` - Once daily at 9 AM UTC
- `"*/30 * * * *"` - Every 30 minutes (for testing)

#### Step 2: Set Environment Variables

In your Vercel project settings, add:
- `CRON_SECRET` (generate a secure random string)
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

#### Step 3: Deploy

After deploying, Vercel will automatically trigger the cron job according to your schedule.

**Note**: Vercel Cron requires a Pro plan or higher. For Hobby plans, use an external cron service.

### Option 2: External Cron Service

If you're not using Vercel or need more control, use an external cron service.

#### Recommended Services

1. **cron-job.org** (Free tier available)
2. **EasyCron** (Free tier available)
3. **GitHub Actions** (Free for public repos)
4. **AWS EventBridge** (Pay-per-use)
5. **Google Cloud Scheduler** (Pay-per-use)

#### Setup Example: cron-job.org

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://your-domain.com/api/cron/dashboard-reports`
   - **Method**: `POST`
   - **Schedule**: `0 * * * *` (every hour) or `0 0 * * *` (daily)
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
3. Save and activate

#### Setup Example: GitHub Actions

Create `.github/workflows/dashboard-reports.yml`:

```yaml
name: Dashboard Reports Cron

on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-reports:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Dashboard Reports
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-domain.com/api/cron/dashboard-reports
```

Add `CRON_SECRET` to your GitHub repository secrets.

### Option 3: Self-Hosted Cron (Linux/Mac)

If you have server access, use `crontab`:

```bash
# Edit crontab
crontab -e

# Add this line (runs every hour)
0 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/dashboard-reports
```

## Testing

### Manual Testing

Test the endpoint manually using curl:

```bash
# Without CRON_SECRET (if not set)
curl -X POST https://your-domain.com/api/cron/dashboard-reports

# With CRON_SECRET
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/dashboard-reports
```

### Expected Response

```json
{
  "message": "Dashboard reports processed",
  "processed": 2,
  "errors": 0,
  "total": 5
}
```

- `processed`: Number of reports successfully sent
- `errors`: Number of failed attempts
- `total`: Total number of enabled subscriptions checked

### Testing Checklist

1. ✅ Create a test dashboard subscription via UI
2. ✅ Set `last_sent_at` to a date in the past (or NULL for first run)
3. ✅ Trigger the cron endpoint manually
4. ✅ Verify email is received
5. ✅ Check `last_sent_at` is updated in database
6. ✅ Verify PDF attachment (if SendGrid attachment support is implemented)

## Troubleshooting

### No Reports Being Sent

**Check:**
1. Are there any enabled subscriptions? Query:
   ```sql
   SELECT * FROM dashboard_subscriptions WHERE enabled = true;
   ```

2. Are subscriptions due? Check `last_sent_at`:
   ```sql
   SELECT 
     id, 
     schedule_type, 
     last_sent_at,
     CASE 
       WHEN last_sent_at IS NULL THEN 'Due (never sent)'
       WHEN schedule_type = 'daily' AND NOW() - last_sent_at > INTERVAL '24 hours' THEN 'Due'
       WHEN schedule_type = 'weekly' AND NOW() - last_sent_at > INTERVAL '7 days' THEN 'Due'
       WHEN schedule_type = 'monthly' AND NOW() - last_sent_at > INTERVAL '30 days' THEN 'Due'
       ELSE 'Not due'
     END as status
   FROM dashboard_subscriptions 
   WHERE enabled = true;
   ```

3. Check application logs for errors

### Email Not Sending

**Check:**
1. `SENDGRID_API_KEY` is set and valid
2. `SENDGRID_FROM_EMAIL` is verified in SendGrid
3. Check SendGrid activity logs
4. Check application logs for email errors

### Cron Job Not Running

**For Vercel:**
- Verify `vercel.json` is in project root
- Check Vercel dashboard → Settings → Cron Jobs
- Ensure you're on Pro plan or higher

**For External Services:**
- Verify cron job is active/enabled
- Check cron service logs
- Verify URL is correct and accessible
- Check if `CRON_SECRET` matches

### Authentication Errors

If you see `401 Unauthorized`:
- Verify `CRON_SECRET` matches in both:
  - Environment variable
  - Cron service configuration (Authorization header)

## Monitoring

### Recommended Monitoring

1. **Set up alerts** for cron job failures
2. **Monitor email delivery rates** via SendGrid dashboard
3. **Track subscription counts**:
   ```sql
   SELECT 
     schedule_type,
     COUNT(*) as count,
     COUNT(*) FILTER (WHERE enabled = true) as enabled_count
   FROM dashboard_subscriptions
   GROUP BY schedule_type;
   ```

4. **Check processing stats** from cron response:
   - High `errors` count indicates issues
   - `processed: 0` with `total > 0` means no subscriptions are due

### Logging

The cron endpoint logs:
- Errors fetching subscriptions
- Errors processing individual subscriptions
- Email sending failures
- Overall processing summary

Check your application logs for entries prefixed with `[Cron Dashboard Reports]`.

## Security Considerations

1. **Always use `CRON_SECRET` in production** to prevent unauthorized access
2. **Use HTTPS** for the cron endpoint URL
3. **Rotate `CRON_SECRET`** periodically
4. **Monitor for unusual activity** (unexpected cron triggers)

## Performance

- The cron job processes subscriptions sequentially
- For large numbers of subscriptions (>100), consider:
  - Running more frequently (every 30 minutes)
  - Implementing batch processing
  - Adding rate limiting for email sending

## Future Enhancements

- [ ] SendGrid attachment support for PDFs
- [ ] Retry logic for failed email sends
- [ ] Batch processing for large subscription lists
- [ ] Webhook notifications for cron job status
- [ ] Dashboard for monitoring cron job health

## Support

For issues or questions:
1. Check application logs
2. Verify environment variables
3. Test endpoint manually
4. Review this documentation

---

**Last Updated**: 2024-12-28
**Endpoint**: `/api/cron/dashboard-reports`
**Method**: `POST`

