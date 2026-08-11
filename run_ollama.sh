#!/bin/bash
expect << EOD
set timeout -1
spawn ssh -o StrictHostKeyChecking=no root@14.225.172.225 "curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5:3b"
expect {
    "password:" {
        send "sMOh_1{k~*AczwlP$\r"
        exp_continue
    }
    eof
}
EOD
