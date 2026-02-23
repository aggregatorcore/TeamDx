/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['underscore'],
  // Enable source maps in development for better debugging
  productionBrowserSourceMaps: false,
  // Standalone output for Docker deployment
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Skip type checking during build (for Docker - types checked in CI/local dev)
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@grpc/grpc-js', '@grpc/proto-loader'],
  },
  webpack: (config, { isServer, webpack, dev }) => {
    const path = require('path');
    // Disable webpack file cache in dev to avoid "PackFileCacheStrategy: Unable to snapshot resolve dependencies" on Windows
    if (dev) {
      config.cache = false;
    }
    
    // Enable source maps in development
    if (dev && !isServer) {
      config.devtool = 'eval-source-map';
    }
    
    // Handle underscore ESM module - prefer CommonJS version
    config.resolve.alias = {
      ...config.resolve.alias,
      'underscore': path.resolve(__dirname, 'node_modules/underscore/underscore.js'),
    };
    
    // Exclude gRPC and Node.js-specific modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
      
      // Use alias to stub out gRPC modules with empty module
      config.resolve.alias = {
        ...config.resolve.alias,
        '@grpc/grpc-js': path.resolve(__dirname, 'webpack-stubs/grpc-stub.js'),
        '@grpc/proto-loader': path.resolve(__dirname, 'webpack-stubs/grpc-stub.js'),
        'grpc': path.resolve(__dirname, 'webpack-stubs/grpc-stub.js'),
      };
      
      // Ignore gRPC modules for client bundle
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@grpc\/grpc-js$/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^@grpc\/proto-loader$/,
        })
      );
      
      // Ensure browser conditions are prioritized in package.json exports for Firebase
      if (!config.resolve.conditionNames) {
        config.resolve.conditionNames = ['browser', 'import', 'require', 'default'];
      }
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
            {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: https: http://localhost:3000 http://localhost:5000",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:3000 http://localhost:5000 http://127.0.0.1:7242 ws://localhost:3000 ws://localhost:5000 https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
              "frame-src 'self' blob: data: http://localhost:5000",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

