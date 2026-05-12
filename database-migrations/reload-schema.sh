#!/bin/bash
sudo -u postgres psql -d ba9alino -c "NOTIFY pgrst, 'reload schema';"
echo "Schema reload sent"
