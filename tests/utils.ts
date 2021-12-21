import { Logger, ConsoleSink, FileSink, KafkaSink } from "../src/logger";
const path = require('path')
import { v4 as uuid } from 'uuid';
import {CompressionTypes, Kafka, Producer, Consumer, PartitionAssigner, RetryOptions} from "kafkajs";
import {Logger as WinstonLogger} from "winston";


class KafkaListener {

}