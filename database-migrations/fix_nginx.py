import re

path = '/etc/nginx/conf.d/ba9alino.conf'
content = open(path).read()

new_block = """location /rest/v1/ {
        rewrite ^/rest/v1/(.*) /$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Authorization $http_authorization;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Prefer, Range, apikey" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        if ($request_method = OPTIONS) { return 204; }
    }"""

content2 = re.sub(r'location /rest/v1/ \{[^}]+\}', new_block, content, count=1)
open(path, 'w').write(content2)
print('done')
