#!/bin/bash
# PDF Ticket Editor - One-line installer
# Usage: wget -qO- https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main/install.sh | bash
#    OR: curl -fsSL https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main/install.sh | bash

set -e

REPO_RAW="https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main"
SETUP_URL="${REPO_RAW}/setup.py"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  MultiTools PDF Ticket Editor - Quick Installer V0.3.1 Beta              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check for Python 3
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "❌ Python 3 is required but not installed."
    echo "   Please install Python 3 and try again."
    exit 1
fi

echo "→ Downloading installer..."

# Download setup.py to temp and run it
TMP_DIR=$(mktemp -d)
SETUP_PATH="${TMP_DIR}/setup.py"

if command -v curl &> /dev/null; then
    curl -fsSL "${SETUP_URL}" -o "${SETUP_PATH}"
elif command -v wget &> /dev/null; then
    wget -qO "${SETUP_PATH}" "${SETUP_URL}"
else
    echo "❌ curl or wget is required."
    exit 1
fi

chmod +x "${SETUP_PATH}"

echo "→ Running installer..."
echo ""

${PYTHON} "${SETUP_PATH}"

# Cleanup
rm -rf "${TMP_DIR}"
