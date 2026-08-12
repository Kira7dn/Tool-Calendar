#!/usr/bin/expect -f
set timeout -1
spawn ssh -L 11434:localhost:11434 root@14.225.172.225 -N
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
interact
