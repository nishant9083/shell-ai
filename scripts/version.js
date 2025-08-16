#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the new version from package.json
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

const newVersion = rootPackageJson.version;

// Update workspace packages
const workspaces = ['packages/core', 'packages/cli'];

for (const workspace of workspaces) {
  const packageJsonPath = path.join(__dirname, '..', workspace, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    
    // Update internal dependencies
    if (packageJson.dependencies && packageJson.dependencies['@shell-ai/core']) {
      packageJson.dependencies['@shell-ai/core'] = `^${newVersion}`;
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`Updated ${workspace}/package.json to version ${newVersion}`);
  }
}

console.log(`All packages updated to version ${newVersion}`);
