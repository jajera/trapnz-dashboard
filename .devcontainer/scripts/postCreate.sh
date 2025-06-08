#!/bin/bash
set -e

if [ -f "package.json" ]; then
  echo "📦 Installing dependencies..."
  npm ci

  echo "🔨 Building action..."
  npm run build

  echo "📝 Linting..."
  npm run lint

  echo "🔒 Security audit..."
  npm audit

  echo "📦 Checking dependencies..."
  npm outdated
fi
