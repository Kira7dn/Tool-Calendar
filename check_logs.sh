#!/bin/bash
source .deploy.env
expect << EXP
set timeout 10
spawn ssh -o StrictHostKeyChecking=no $VNPT_USER@$VNPT_HOST "docker logs --tail 30 doc-coordination-system"
expect "password:"
send "$VNPT_PASS\r"
expect eof
EXP
