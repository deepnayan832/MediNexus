import { existsSync } from 'node:fs'
import process from 'node:process'

// Load local backend configuration before importing modules that initialize the database.
if (existsSync('.env')) process.loadEnvFile('.env')

await import('./index')
