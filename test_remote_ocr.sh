ssh -o StrictHostKeyChecking=no root@14.225.172.225 << 'SSH_EOF'
docker logs --tail 30 python-ai-service
SSH_EOF
