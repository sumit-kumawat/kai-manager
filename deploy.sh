#!/bin/bash
# ==============================================================================
# KAI Manager ERP - Automated Production Deployment Script
# Safe code sync, automatic SQLite database backups, zero-downtime PM2 reload.
# ==============================================================================
set -e

APP_DIR="/opt/kai-manager"

# Navigate to project directory if it exists
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
fi

echo "========================================================"
echo "🚀 Starting KAI Manager Production Auto-Deploy"
echo "========================================================"

# 1. Create Timestamped SQLite Database Backup
echo "📦 Step 1: Backing up production SQLite database..."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f kai_manager.sqlite ]; then
  cp kai_manager.sqlite "backups/kai_manager_$TIMESTAMP.sqlite" 2>/dev/null || true
  echo "   [+] Saved SQLite DB -> backups/kai_manager_$TIMESTAMP.sqlite"
fi

if [ -f db.json ]; then
  cp db.json "backups/db_$TIMESTAMP.json" 2>/dev/null || true
fi

# 2. Instruct Git to protect local database files from git pull/checkout overwrites
echo "🔒 Step 2: Protecting database files in Git index..."
git update-index --assume-unchanged kai_manager.sqlite db.json 2>/dev/null || true

# 3. Fetch Latest Code from GitHub
echo "📥 Step 3: Fetching latest published code from GitHub (origin/main)..."
git fetch origin main

# 4. Selectively checkout code files to update application without wiping DB
echo "🔄 Step 4: Syncing published application source code..."
git checkout origin/main -- server.js app.js index.html styles.css admission.html belt_exam.html package.json package-lock.json deploy.sh 2>/dev/null || git pull origin main --no-rebase

# 5. Install Production Dependencies
echo "📚 Step 5: Installing production dependencies..."
npm install --omit=dev

# 6. Zero-Downtime PM2 Reload / Start
echo "⚡ Step 6: Reloading process in PM2..."
(pm2 reload kai-manager || pm2 start server.js --name kai-manager)

# 7. Save PM2 state & show status
echo "💾 Step 7: Saving PM2 process state..."
pm2 save

echo "========================================================"
echo "✅ Production Auto-Deployment Complete!"
echo "   SQLite Backup: backups/kai_manager_$TIMESTAMP.sqlite"
echo "========================================================"
pm2 status
