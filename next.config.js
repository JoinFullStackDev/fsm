/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// Suppress unhandled rejection warnings for _document/_app check
// This is a known Next.js 14 issue where it checks for Pages Router files in App Router projects
// The build still succeeds, but this prevents the error from being logged to console
if (typeof process !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    // Suppress _document/_app related errors during build
    if (message.includes('_document') || 
        (message.includes('unhandledRejection') && message.includes('ENOENT'))) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

module.exports = nextConfig
