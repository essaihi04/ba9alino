#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'
\d purchases
SELECT id, status FROM purchases WHERE status = 'received' LIMIT 3;
EOF
