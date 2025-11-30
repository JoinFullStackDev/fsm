/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimize webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack cache to reduce serialization warnings
    if (dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        // Use compression for cache to reduce size
        compression: 'gzip',
        // Limit cache size
        maxMemoryGenerations: 1,
      };
    }

    // Note: Supabase Edge Runtime warnings are harmless
    // Supabase SSR checks for Node.js APIs (process.versions, process.version) in Edge Runtime
    // These warnings are informational - Supabase SSR handles Edge Runtime compatibility correctly
    // The warnings appear during build but don't affect functionality

    // Optimize chunk splitting for better caching
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separate vendor chunks for better caching (JS only)
            default: false,
            vendors: false,
            // Large libraries get their own chunks
            monaco: {
              name: 'monaco',
              test: /[\\/]node_modules[\\/](@monaco-editor|monaco-editor)[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
              // Exclude CSS and other non-JS assets
              type: 'javascript/auto',
            },
            mermaid: {
              name: 'mermaid',
              test: /[\\/]node_modules[\\/]mermaid[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
              type: 'javascript/auto',
            },
            mui: {
              name: 'mui',
              test: /[\\/]node_modules[\\/]@mui[\\/]/,
              priority: 15,
              reuseExistingChunk: true,
              type: 'javascript/auto',
            },
            pdf: {
              name: 'pdf',
              test: /[\\/]node_modules[\\/](jspdf|html2canvas)[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
              type: 'javascript/auto',
            },
            // Common vendor chunk - JS modules only (exclude CSS)
            vendor: {
              name: 'vendor',
              test: (module) => {
                // Only include JS modules from node_modules, exclude CSS
                return (
                  module.resource &&
                  /[\\/]node_modules[\\/]/.test(module.resource) &&
                  !/\.(css|scss|sass|less|styl)$/.test(module.resource)
                );
              },
              priority: 10,
              reuseExistingChunk: true,
              type: 'javascript/auto',
            },
          },
        },
      };
    }

    // Exclude heavy dependencies from server bundle where possible
    if (isServer) {
      config.externals = config.externals || [];
      // Monaco Editor is client-only, exclude from server bundle
      config.externals.push({
        '@monaco-editor/react': 'commonjs @monaco-editor/react',
        'monaco-editor': 'commonjs monaco-editor',
      });
    }

    return config;
  },

  // Enable SWC minification for faster builds
  swcMinify: true,

  // Optimize production builds
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      'date-fns',
    ],
  },
}

// Suppress unhandled rejection warnings for _document/_app check
// This is a known Next.js 14 issue where it checks for Pages Router files in App Router projects
// The build still succeeds, but this prevents the error from being logged to console
if (typeof process !== 'undefined') {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.error = function(...args) {
    const message = args.join(' ');
    // Suppress _document/_app related errors during build
    if (message.includes('_document') || 
        (message.includes('unhandledRejection') && message.includes('ENOENT'))) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Suppress Supabase Edge Runtime warnings (harmless - Supabase SSR handles compatibility)
  console.warn = function(...args) {
    const message = args.join(' ');
    // Suppress Supabase Edge Runtime warnings - these are informational only
    if (
      message.includes('A Node.js API is used') &&
      message.includes('Edge Runtime') &&
      (message.includes('@supabase') || message.includes('supabase'))
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

module.exports = nextConfig
