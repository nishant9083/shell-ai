#!/usr/bin/env node

import { main } from './cli/index.js';

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
