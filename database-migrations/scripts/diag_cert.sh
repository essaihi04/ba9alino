#!/bin/bash
echo "=== ssl_certificate dans la config ACTIVE (conf.d) ==="
grep -n 'ssl_certificate\|server_name\|listen' /etc/nginx/conf.d/ba9alino.conf

echo
echo "=== ssl_certificate dans la SAUVEGARDE qui marchait (bak3) ==="
grep -n 'ssl_certificate\|server_name\|listen' /etc/nginx/conf.d/ba9alino.conf.bak3

echo
echo "=== Certificats Let's Encrypt disponibles ==="
ls -1 /etc/letsencrypt/live/

echo
echo "=== CN/SAN du certificat servi reellement (via SNI duckdns) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername ba9alino.duckdns.org 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null
