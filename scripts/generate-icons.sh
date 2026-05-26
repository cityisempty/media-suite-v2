#!/bin/bash
# 从 resources/icon.png (1024x1024) 生成所有平台图标
# 用法: bash scripts/generate-icons.sh

set -e
CONVERT=/Applications/ServBay/bin/convert
SRC="resources/icon.png"
RESOURCES="resources"

if [ ! -f "$SRC" ]; then
  echo "错误: 请先将 1024x1024 的图标放到 $SRC"
  exit 1
fi

echo "生成 macOS .icns..."
ICONSET="$RESOURCES/icon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 64 128 256 512; do
  $CONVERT "$SRC" -resize ${size}x${size} "$ICONSET/icon_${size}x${size}.png"
  $CONVERT "$SRC" -resize $((size*2))x$((size*2)) "$ICONSET/icon_${size}x${size}@2x.png"
done
iconutil -c icns "$ICONSET" -o "$RESOURCES/icon.icns"
rm -rf "$ICONSET"
echo "  -> resources/icon.icns"

echo "生成 Windows .ico..."
$CONVERT "$SRC" \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 "$RESOURCES/icon.ico"
echo "  -> resources/icon.ico"

echo "完成！"
