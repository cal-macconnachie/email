#!/usr/bin/env node
import { build } from 'esbuild'
import { mkdirSync, readdirSync, statSync } from 'fs'
import { dirname, join, parse, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const lambdasDir = join(__dirname, '../src/lambdas')
const outDir = join(__dirname, '../dist/lambdas')

// Recursively find all Lambda entry points (excluding helpers and middleware)
function findLambdaFiles(dir, baseDir = dir) {
  const entries = readdirSync(dir)
  const lambdaFiles = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip helper and middleware directories
      if (entry === 'helpers' || entry === 'middleware') {
        continue
      }
      // Recursively search subdirectories
      lambdaFiles.push(...findLambdaFiles(fullPath, baseDir))
    } else if (stat.isFile() && entry.endsWith('.ts')) {
      // Get relative path from base lambdas directory
      const relativePath = relative(baseDir, fullPath)
      lambdaFiles.push(relativePath)
    }
  }

  return lambdaFiles
}

const lambdaFiles = findLambdaFiles(lambdasDir)

// Build each Lambda function
const buildPromises = lambdaFiles.map(async (file) => {
  const { name, dir } = parse(file)
  const entryPoint = join(lambdasDir, file)

  // Preserve subdirectory structure in output (e.g., auth/verify-otp)
  const lambdaOutDir = join(outDir, dir, name)

  // Create directory for this lambda
  mkdirSync(lambdaOutDir, { recursive: true })

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
    })

  } catch {
    return Promise.reject(`Failed to build Lambda: ${name}`)
  }
})

await Promise.all(buildPromises)
