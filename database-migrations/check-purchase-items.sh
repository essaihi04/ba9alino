#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'
-- Check purchase_items table
\d purchase_items

-- Check JSONB items sample
SELECT id, jsonb_array_length(items) AS nb_items,
       items->0 AS first_item
FROM purchases 
WHERE status = 'received' AND items IS NOT NULL
LIMIT 3;
EOF
