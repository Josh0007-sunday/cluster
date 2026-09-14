#!/bin/bash
unset NODE_TLS_REJECT_UNAUTHORIZED
cd /home/joshua/Desktop/project0/app/cluster
node node_modules/.bin/vite --host --port 5173
