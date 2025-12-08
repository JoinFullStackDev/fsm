/**
 * Push Notification Service
 * Handles browser push notification subscriptions and sending
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import logger from '@/lib/utils/logger';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Register a push subscription for a user
 */
export async function registerPushSubscription(
  userId: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<{ id: string } | null> {
  try {
    const adminClient = createAdminSupabaseClient();

    const { data, error } = await adminClient
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,endpoint',
        }
      )
      .select('id')
      .single();

    if (error) {
      logger.error('[Push Notifications] Error registering subscription:', error);
      return null;
    }

    logger.debug('[Push Notifications] Subscription registered:', { userId, subscriptionId: data?.id });
    return data ? { id: data.id } : null;
  } catch (error) {
    logger.error('[Push Notifications] Error registering subscription:', error);
    return null;
  }
}

/**
 * Unregister a push subscription for a user
 */
export async function unregisterPushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    const adminClient = createAdminSupabaseClient();

    const { error } = await adminClient
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      logger.error('[Push Notifications] Error unregistering subscription:', error);
      return false;
    }

    logger.debug('[Push Notifications] Subscription unregistered:', { userId, endpoint });
    return true;
  } catch (error) {
    logger.error('[Push Notifications] Error unregistering subscription:', error);
    return false;
  }
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
  try {
    const adminClient = createAdminSupabaseClient();

    const { data, error } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('[Push Notifications] Error fetching subscriptions:', error);
      return [];
    }

    return (data || []) as PushSubscriptionRecord[];
  } catch (error) {
    logger.error('[Push Notifications] Error fetching subscriptions:', error);
    return [];
  }
}

/**
 * Check if push notifications are enabled (both globally and for user)
 */
export async function checkPushEnabled(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminSupabaseClient();

    // Check global setting
    const { data: globalSetting } = await adminClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'system_push_notifications_enabled')
      .single();

    if (globalSetting?.value === false) {
      logger.debug('[Push Notifications] Push notifications disabled globally');
      return false;
    }

    // Check user preference
    const { data: user } = await adminClient
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    const pushEnabled = user?.preferences?.notifications?.push !== false;

    logger.debug('[Push Notifications] Push enabled check:', {
      userId,
      globalEnabled: globalSetting?.value !== false,
      userPreference: user?.preferences?.notifications?.push,
      result: pushEnabled,
    });

    return pushEnabled;
  } catch (error) {
    logger.error('[Push Notifications] Error checking push enabled:', error);
    return false;
  }
}

/**
 * Send a push notification to a user
 * This function will be called from the server-side notification creation
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  try {
    // Check if push is enabled
    const enabled = await checkPushEnabled(userId);
    if (!enabled) {
      logger.debug('[Push Notifications] Push notifications disabled for user:', userId);
      return false;
    }

    // Get user's subscriptions
    const subscriptions = await getUserPushSubscriptions(userId);
    if (subscriptions.length === 0) {
      logger.debug('[Push Notifications] No subscriptions found for user:', userId);
      return false;
    }

    // Get VAPID keys from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warn('[Push Notifications] VAPID keys not configured');
      return false;
    }

    // Send to all user's subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const payload = JSON.stringify({
            title,
            body: message,
            icon: '/fullstack_icon.png', // Default icon path
            badge: '/fullstack_icon.png',
            data: {
              url: metadata.url || '/',
              ...metadata,
            },
          });

          // Import web-push dynamically
          const webpush = await import('web-push');

          // Set VAPID details
          webpush.setVapidDetails(
            `mailto:${process.env.VAPID_EMAIL || 'email@fsm.life'}`,
            vapidPublicKey,
            vapidPrivateKey
          );

          // Send notification
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload
          );

          logger.debug('[Push Notifications] Notification sent successfully:', {
            userId,
            subscriptionId: subscription.id,
            title,
            endpoint: subscription.endpoint.substring(0, 50) + '...',
          });

          return true;
        } catch (error) {
          // If subscription is invalid, remove it
          const errorWithStatus = error as { statusCode?: number; message?: string };
          const statusCode = errorWithStatus?.statusCode;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (statusCode === 410 || statusCode === 404) {
            logger.debug('[Push Notifications] Removing invalid subscription:', {
              subscriptionId: subscription.id,
              statusCode,
              message: errorMessage,
            });
            await unregisterPushSubscription(userId, subscription.endpoint);
          } else {
            logger.error('[Push Notifications] Error sending notification:', {
              error: errorMessage,
              statusCode,
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint.substring(0, 50) + '...',
            });
          }
          return false;
        }
      })
    );

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    logger.debug('[Push Notifications] Sent notifications:', {
      userId,
      total: subscriptions.length,
      successful: successCount,
    });

    return successCount > 0;
  } catch (error) {
    logger.error('[Push Notifications] Error sending push notification:', error);
    return false;
  }
}

