#!/bin/bash

cd /usr/local/kafka/bin
./kafka-topics.sh --zookeeper localhost:2181 --delete --topic test_topic



