#!/bin/bash

# Bundle web-interface and container-runtime into CLI package
# This script is run before publishing to npm

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGES_DIR="$(dirname "$CLI_DIR")"

echo "Bundling web-interface..."
cd "$PACKAGES_DIR/web-interface"
npm run build
rm -rf "$CLI_DIR/web-ui"
cp -r dist "$CLI_DIR/web-ui"
echo "  -> Copied to cli/web-ui/"

echo "Bundling container-runtime..."
cd "$PACKAGES_DIR/container-runtime"
npm run build
rm -rf "$CLI_DIR/container-runtime"
mkdir -p "$CLI_DIR/container-runtime"
cp -r dist "$CLI_DIR/container-runtime/dist"
cp package.json "$CLI_DIR/container-runtime/"
echo "  -> Copied to cli/container-runtime/"

echo "Bundle complete!"
