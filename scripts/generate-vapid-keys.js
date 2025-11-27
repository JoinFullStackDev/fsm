/**
 * Generate VAPID keys for push notifications
 * Run with: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

console.log('Generating VAPID keys for push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add these to your .env.local file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=your-email@example.com\n`);
console.log('Note: NEXT_PUBLIC_VAPID_PUBLIC_KEY is used in the browser.');
console.log('      VAPID_PRIVATE_KEY should be kept secret and only used server-side.');
console.log('      VAPID_EMAIL is the contact email for your application.');

