#!/bin/bash

# AI Canvas Development App Bundle Creator
# Creates a macOS .app bundle for development with proper app name

set -e

APP_NAME="AI Canvas"
BUNDLE_ID="com.ai-canvas.app"
DEV_APP_PATH="dev-dist/AI Canvas.app"
ELECTRON_PATH="node_modules/electron/dist/Electron.app"

echo "🚀 Creating AI Canvas development app bundle..."

# Check if Electron exists
if [ ! -d "$ELECTRON_PATH" ]; then
    echo "❌ Error: Electron not found. Run 'npm install' first."
    exit 1
fi

# Clean previous dev app
rm -rf "dev-dist"
mkdir -p "dev-dist"

# Copy Electron.app as base
cp -R "$ELECTRON_PATH" "$DEV_APP_PATH"

# Update Info.plist
cat > "$DEV_APP_PATH/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>AI Canvas</string>
    <key>CFBundleExecutable</key>
    <string>AI Canvas</string>
    <key>CFBundleIconFile</key>
    <string>electron.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.ai-canvas.app</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>AI Canvas</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.productivity</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Rename executable
mv "$DEV_APP_PATH/Contents/MacOS/Electron" "$DEV_APP_PATH/Contents/MacOS/AI Canvas"

# Copy icon if exists
if [ -f "public/icon.icns" ]; then
    cp "public/icon.icns" "$DEV_APP_PATH/Contents/Resources/electron.icns"
    echo "✅ Custom icon applied"
fi

echo "✅ Development app bundle created at: $DEV_APP_PATH"
echo ""
echo "📝 To start development:"
echo "   1. Run 'npm run dev:web' in one terminal"
echo "   2. Run 'open \"$DEV_APP_PATH\"' in another terminal"
echo ""
echo "   Or use: npm run dev (starts both)"
