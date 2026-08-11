#!/bin/bash
source .deploy.env

# Copy the python script to the server
expect << EXP
set timeout 60
spawn scp -o StrictHostKeyChecking=no test_ai.py $VNPT_USER@$VNPT_HOST:/root/Tool-Calendar/
expect "password:"
send "$VNPT_PASS\r"
expect eof
EXP

# Execute the script
expect << EXP
set timeout 300
spawn ssh -o StrictHostKeyChecking=no $VNPT_USER@$VNPT_HOST
expect "password:"
send "$VNPT_PASS\r"
expect "#"

send "cd /root/Tool-Calendar\r"
expect "#"

send "python3 test_ai.py\r"
expect "#"

send "rm test_ai.py\r"
expect "#"

send "exit\r"
expect eof
EXP
