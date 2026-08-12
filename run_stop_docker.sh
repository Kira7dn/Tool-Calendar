#!/usr/bin/expect -f
set timeout 120
spawn ssh root@14.225.172.225 "
docker stop doc-coordination-system
cd /root/Tool-Calendar/data_dump
python3 backfill_vectors.py /root/Tool-Calendar/data_dump/documents.db
docker start doc-coordination-system
"
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof
