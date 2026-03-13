#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "==> Building Docker image for linux/amd64..."

# Try Harbor first
if docker login ${REGISTRY:-harbor.example.com} 2>/dev/null; then
    echo "==> Using registry"
    docker buildx build \
        --platform linux/amd64 \
        --tag ${REGISTRY:-harbor.example.com}/apps/rafael-exhibit:fredo \
        --file deployment/docker/Dockerfile \
        --push \
        .

    echo "==> Deploying to fredo via Ansible..."
    cd deployment/ansible
    ansible-playbook -i inventory-fredo.ini deploy-fredo.yml
else
    echo "==> Harbor not available, using local build + transfer"
    docker buildx build \
        --platform linux/amd64 \
        --tag rafael-exhibit:fredo \
        --file deployment/docker/Dockerfile \
        --load \
        .

    echo "==> Saving and transferring image..."
    docker save rafael-exhibit:fredo | gzip > /tmp/rafael-exhibit-fredo.tar.gz
    scp /tmp/rafael-exhibit-fredo.tar.gz fredo:/tmp/

    echo "==> Loading image on fredo..."
    ssh fredo "docker load < /tmp/rafael-exhibit-fredo.tar.gz && rm /tmp/rafael-exhibit-fredo.tar.gz"
    rm /tmp/rafael-exhibit-fredo.tar.gz

    echo "==> Deploying to fredo via Ansible..."
    cd deployment/ansible
    # Use local image instead of Harbor
    ansible-playbook -i inventory-fredo.ini deploy-fredo.yml -e "docker_image=rafael-exhibit:fredo"
fi

echo "==> Deployment complete!"
echo "==> Deployment complete. Check your target host on port 8082."
