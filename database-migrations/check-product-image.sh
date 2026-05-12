#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'
-- Get the image URL of the product named 'test'
SELECT id, name_ar, image_url FROM products WHERE name_ar = 'test' OR sku = '56661234' LIMIT 5;
EOF

echo "--- Files in storage ---"
find /opt/ba9alino/storage -type f | head -20

echo "--- Storage server status ---"
systemctl is-active ba9alino-storage 2>/dev/null || echo "service not found"
ps aux | grep storage-server | grep -v grep
