/**
 * Debug utilities for push notifications
 */

/**
 * Check service worker registration status
 */
export async function checkServiceWorkerStatus(): Promise<{
  registered: boolean;
  active: boolean;
  scope: string | null;
  subscription: boolean;
}> {
  if (!('serviceWorker' in navigator)) {
    return {
      registered: false,
      active: false,
      scope: null,
      subscription: false,
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return {
        registered: false,
        active: false,
        scope: null,
        subscription: false,
      };
    }

    const subscription = await registration.pushManager.getSubscription();

    return {
      registered: true,
      active: !!registration.active,
      scope: registration.scope,
      subscription: !!subscription,
    };
  } catch (error) {
    console.error('[Push Debug] Error checking service worker:', error);
    return {
      registered: false,
      active: false,
      scope: null,
      subscription: false,
    };
  }
}

/**
 * Send a message to the service worker to verify it's active
 */
export async function pingServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !registration.active) {
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        console.log('[Push Debug] Service worker responded:', event.data);
        resolve(true);
      };

      registration.active!.postMessage(
        { type: 'PING' },
        [messageChannel.port2]
      );

      // Timeout after 2 seconds
      setTimeout(() => {
        resolve(false);
      }, 2000);
    });
  } catch (error) {
    console.error('[Push Debug] Error pinging service worker:', error);
    return false;
  }
}

/**
 * Log all push notification debug info
 */
export async function logPushDebugInfo(): Promise<void> {
  console.group('[Push Debug] Status Check');
  
  const status = await checkServiceWorkerStatus();
  console.log('Service Worker Status:', status);
  
  console.log('Notification Permission:', Notification.permission);
  console.log('Push Manager Support:', 'PushManager' in window);
  console.log('Service Worker Support:', 'serviceWorker' in navigator);
  
  if (status.registered) {
    const pingResult = await pingServiceWorker();
    console.log('Service Worker Responds:', pingResult);
  }
  
  console.groupEnd();
}

