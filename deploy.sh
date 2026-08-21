#!/bin/bash
# ==============================================================================
# KAI Manager ERP - Production Deployment & Safe Upgrade Script
# Safe code sync, automatic database backups, zero-downtime PM2 reload.
# ==============================================================================
set -e

APP_DIR="/opt/kai-manager"

# Navigate to project directory
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
fi

echo "========================================================"
echo "🚀 Starting KAI Manager Safe Production Update"
echo "========================================================"

# 1. Create Timestamped Database Backups (JSON + SQLite)
echo "📦 Step 1: Creating database backups..."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f db.json ]; then
  cp db.json "backups/db_$TIMESTAMP.json"
  echo "   [+] Saved db.json -> backups/db_$TIMESTAMP.json"
fi

if [ -f kai_manager.sqlite ]; then
  cp kai_manager.sqlite "backups/sqlite_$TIMESTAMP.sqlite"
  echo "   [+] Saved kai_manager.sqlite -> backups/sqlite_$TIMESTAMP.sqlite"
fi

# 2. Fetch Latest Code from GitHub Without Overwriting Live Database
echo "📥 Step 2: Fetching new code from GitHub (origin/main)..."
git fetch origin main

# Selectively update application source files to prevent DB overwrites
echo "🔄 Step 3: Syncing updated code files..."
git checkout origin/main -- server.js app.js index.html styles.css admission.html belt_exam.html package.json 2>/dev/null || git pull origin main --no-rebase

# 3. Install Production Dependencies
echo "📚 Step 4: Updating NPM dependencies..."
npm install --omit=dev

# 4. Zero-Downtime PM2 Reload
echo "🔄 Step 5: Reloading application in PM2..."
if pm2 list | grep -q "kai-manager"; then
  pm2 reload kai-manager
else
  pm2 start server.js --name kai-manager
fi

# Save PM2 state & show status
pm2 save
echo "========================================================"
echo "✅ Production Update Successful!"
echo "   Database Backup: backups/db_$TIMESTAMP.json"
echo "========================================================"
pm2 status
