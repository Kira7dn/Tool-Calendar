#!/usr/bin/expect -f
set timeout 300
spawn ssh root@14.225.172.225 "
docker run --rm -v /root/Tool-Calendar/data_dump:/data --network host python:3.10-slim bash -c \"pip install requests; python3 /data/backfill_vectors.py /data/documents.db\"
"
expect "password:"
send "sMOh_1{k~*AczwlP\$\r"
expect eof
