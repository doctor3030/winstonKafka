#!/bin/bash
bash ./cleanup_environment.sh \
&& mkdir "temp" \
&& mkdir "logs" \
&& echo "Deploying kafka cluster.." \
&& docker compose --file="docker-compose.yml" --env-file=".env_development" up --detach --wait \
&& sleep 5 \
&& echo "Kafka cluster deployed."

