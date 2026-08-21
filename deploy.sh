#!/bin/bash
# ==============================================================================
# KAI Manager ERP - Production Deployment & Safe Upgrade Script
# Safe code sync, automatic SQLite database backups, zero-downtime PM2 reload.
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

# 1. Create Timestamped SQLite Database Backup
echo "📦 Step 1: Backing up production SQLite database..."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f kai_manager.sqlite ]; then
  cp kai_manager.sqlite "backups/kai_manager_$TIMESTAMP.sqlite"
  echo "   [+] Production SQLite backed up -> backups/kai_manager_$TIMESTAMP.sqlite"
fi

if [ -f db.json ]; then
  cp db.json "backups/db_$TIMESTAMP.json" 2>/dev/null || true
fi

# Instruct Git to protect local database files from git pull overwrites
git update-index --assume-unchanged kai_manager.sqlite db.json 2>/dev/null || true

# 2. Fetch Latest Code from GitHub Without Overwriting Live Database
echo "📥 Step 2: Fetching new code from GitHub (origin/main)..."
git fetch origin main

# Selectively update application source files to prevent DB overwrites
echo "🔄 Step 3: Syncing updated application code..."
git checkout origin/main -- server.js app.js index.html styles.css admission.html belt_exam.html package.json package-lock.json 2>/dev/null || git pull origin main --no-rebase

# Ensure SQLite DB is intact after git update
if [ -f "backups/kai_manager_$TIMESTAMP.sqlite" ] && [ ! -s kai_manager.sqlite ]; then
  cp "backups/kai_manager_$TIMESTAMP.sqlite" kai_manager.sqlite
fi

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
echo "   SQLite Backup Saved: backups/kai_manager_$TIMESTAMP.sqlite"
echo "========================================================"
pm2 status
