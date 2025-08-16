#!/usr/bin/env node

import { stdout } from 'process';

import { main } from './src/cli/index.js';

// Global error handlers
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('exit', () => {
  stdout.write('\x1B[?25h');
});

// Handle SIGINT (Ctrl+C) gracefully
process.on('SIGINT', () => {
  process.exit(0);
});

// Start the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
