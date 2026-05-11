#!/bin/bash
# Create a real tiny PNG (1x1 red pixel)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\x99c\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x5b\x0c\xa6\xa6\x00\x00\x00\x00IEND\xaeB\x60\x82' > /tmp/test-pixel.png

echo "=== Test file: $(file /tmp/test-pixel.png) ==="
echo ""

echo "=== Test 1: Raw binary upload via nginx HTTPS ==="
curl -s -X POST \
  -H "Content-Type: image/png" \
  --data-binary @/tmp/test-pixel.png \
  "https://ba9alino.duckdns.org/storage/v1/object/product-images/test-raw.png"
echo ""

echo "=== Test 2: Multipart upload via nginx HTTPS ==="
curl -s -X POST \
  -F "file=@/tmp/test-pixel.png" \
  "https://ba9alino.duckdns.org/storage/v1/object/product-images/test-multipart.png"
echo ""

echo ""
echo "=== Verify uploaded files ==="
ls -la /opt/ba9alino/storage/product-images/test-*.png 2>/dev/null
file /opt/ba9alino/storage/product-images/test-*.png 2>/dev/null

echo ""
echo "=== Recent storage server logs ==="
journalctl -u ba9alino-storage --no-pager -n 10 --since '30 sec ago'
