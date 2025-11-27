/**
 * Generate API Key Encryption Key
 * Run with: node scripts/generate-api-key-encryption-key.js
 * 
 * This generates a secure 64-character hex string (32 bytes) for encrypting API keys.
 */

const crypto = require('crypto');

console.log('Generating API Key Encryption Key...\n');

const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('Add this to your .env.local file:\n');
console.log(`API_KEY_ENCRYPTION_KEY=${encryptionKey}\n`);
console.log('⚠️  IMPORTANT: Keep this key secure!');
console.log('   - Never commit it to version control');
console.log('   - Store it securely in your deployment environment');
console.log('   - If compromised, rotate all API keys immediately\n');

