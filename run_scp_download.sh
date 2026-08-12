#!/usr/bin/expect -f
set timeout 120
spawn scp root@14.225.172.225:/root/Tool-Calendar/data_dump/documents.db /Users/macbookpro/Tool-Calendar/data_dump/documents_vnpt.db
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof
