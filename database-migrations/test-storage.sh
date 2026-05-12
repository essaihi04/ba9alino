#!/bin/bash
FILE=$(find /opt/ba9alino/storage/magasin -type f | head -1 | sed 's|/opt/ba9alino/storage/magasin/||')
echo "File: $FILE"
echo "Testing URL: https://ba9alino.duckdns.org/storage/v1/object/public/magasin/$FILE"
curl -sI "https://ba9alino.duckdns.org/storage/v1/object/public/magasin/$FILE" | head -5
