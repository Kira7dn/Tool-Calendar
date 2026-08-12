#!/usr/bin/expect -f
set timeout 120
spawn ssh root@14.225.172.225 "
cp /root/Tool-Calendar/data_dump/documents.db /tmp/documents.db
cd /tmp
python3 backfill_vectors.py /tmp/documents.db
cp /tmp/documents.db /root/Tool-Calendar/data_dump/documents.db
"
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof
