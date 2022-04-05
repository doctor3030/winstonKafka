#!/bin/bash
cd /usr/local/kafka/bin
./kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 4 --config compression.type=gzip --topic test_topic
