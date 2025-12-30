#!/usr/bin/env node
import { build } from 'esbuild'
import { mkdirSync, readdirSync, statSync } from 'fs'
import { dirname, join, parse } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const lambdasDir = join(__dirname, '../src/lambdas')
const outDir = join(__dirname, '../dist/lambdas')

// Get all Lambda entry points (top-level .ts files in src/lambdas, excluding helpers)
const lambdaFiles = readdirSync(lambdasDir)
  .filter(file => {
    const fullPath = join(lambdasDir, file)
    return statSync(fullPath).isFile() && file.endsWith('.ts')
  })

// Build each Lambda function
const buildPromises = lambdaFiles.map(async (file) => {
  const { name } = parse(file)
  const entryPoint = join(lambdasDir, file)
  const lambdaOutDir = join(outDir, name)

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
