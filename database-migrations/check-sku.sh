#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'
SELECT id, name_ar, sku, image_url FROM products WHERE sku = '56661234';
EOF
