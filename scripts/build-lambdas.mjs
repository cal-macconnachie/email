#!/usr/bin/env node
import { build } from 'esbuild';
import { readdirSync, statSync, mkdirSync } from 'fs';
import { join, parse } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lambdasDir = join(__dirname, '../src/lambdas');
const outDir = join(__dirname, '../dist/lambdas');

// Get all Lambda entry points (top-level .ts files in src/lambdas, excluding helpers)
const lambdaFiles = readdirSync(lambdasDir)
  .filter(file => {
    const fullPath = join(lambdasDir, file);
    return statSync(fullPath).isFile() && file.endsWith('.ts');
  });

console.log('Building Lambda functions with esbuild...\n');

// Build each Lambda function
const buildPromises = lambdaFiles.map(async (file) => {
  const { name } = parse(file);
  const entryPoint = join(lambdasDir, file);
  const lambdaOutDir = join(outDir, name);

  // Create directory for this lambda
  mkdirSync(lambdaOutDir, { recursive: true });

  console.log(`Building ${name}...`);

  try {
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      platform: 'node',
      target: 'node22',
      outfile: join(lambdaOutDir, 'index.js'),
      format: 'cjs',
      treeShaking: true,
      sourcemap: true,
      logLevel: 'error'
    });

    console.log(`✓ ${name} built successfully`);
  } catch (error) {
    console.error(`✗ Failed to build ${name}:`, error);
    process.exit(1);
  }
});

await Promise.all(buildPromises);

console.log('\n✓ All Lambda functions built successfully!');
