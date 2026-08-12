#!/usr/bin/expect -f
set timeout 120
spawn scp test_api_chat.py root@14.225.172.225:/tmp/
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof

spawn ssh root@14.225.172.225 "python3 /tmp/test_api_chat.py"
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof
