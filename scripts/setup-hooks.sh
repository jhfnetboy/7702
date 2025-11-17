#!/bin/bash

##############################################################################
# Setup Git Hooks
#
# This script copies git hooks from .githooks/ to .git/hooks/
# making them executable and active in the repository.
#
# Run this automatically via: npm run prepare or pnpm install
##############################################################################

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GIT_HOOKS_DIR="$PROJECT_ROOT/.githooks"
GIT_ACTIVE_DIR="$PROJECT_ROOT/.git/hooks"

# Check if .githooks directory exists
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "⚠️  .githooks directory not found at $GIT_HOOKS_DIR"
  exit 0
fi

# Check if .git/hooks directory exists
if [ ! -d "$GIT_ACTIVE_DIR" ]; then
  echo "⚠️  .git/hooks directory not found. Git may not be initialized."
  exit 0
fi

echo "🔧 Setting up git hooks from .githooks/..."

# Copy all hooks from .githooks to .git/hooks
for hook in "$GIT_HOOKS_DIR"/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")
    target="$GIT_ACTIVE_DIR/$hook_name"

    # Copy the hook
    cp "$hook" "$target"

    # Make it executable
    chmod +x "$target"

    echo "   ✅ Installed $hook_name"
  fi
done

echo "✅ Git hooks setup complete!"
echo ""
