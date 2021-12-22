import { Logger, ConsoleSink, FileSink, KafkaSink } from "../src/logger";
import { KafkaListener } from './utils/kafka_utils'
const path = require('path')
import { v4 as uuid } from 'uuid';
import {CompressionTypes, Kafka, Producer, Consumer, PartitionAssigner, RetryOptions, KafkaMessage} from "kafkajs";
import {Logger as WinstonLogger} from "winston";

class ThisClass {
    public readonly module = path.basename(__filename);
    public readonly component = "ThisClass";
    public readonly serviceID = 'TestID';
    private _clsLogger: Logger;
    private _logger: WinstonLogger;
    private _childClass: ChildClass;

    constructor() {
        this._clsLogger = new Logger({
            module: this.module,
            component: this.component,
            serviceID: this.serviceID
        });
        this._logger = this._clsLogger.getLogger([
            ConsoleSink,
            new FileSink({
                filename: 'log.log',
                datePattern: 'YYYY-MM-DD-HH',
                zippedArchive: false,
                maxSize: '20m',
                maxFiles: '14d'
            }),
            new KafkaSink({
                client_config: {brokers: ['192.168.2.190:9092'], clientId: uuid()},
                // client_config: {brokers: ['10.0.0.74:9092'], clientId: uuid()},
                producer_config: {allowAutoTopicCreation: false},
                sink_topic: 'test_topic'
            })
        ]);

        let child_logger_conf = {
                module: this.module,
                component: 'ChildClass',
                serviceID: this.serviceID
            }
        let child_logger = this._logger.child({ childLabel: this._clsLogger.getLabel(child_logger_conf) })
        this._childClass = new ChildClass(child_logger)
    }

    public async logSomething () {
        this._logger.info('HELOOOOO from ThisClass!!!')
        this._childClass.logSomething();
        this._logger.close();
    }
}

class ChildClass {
    private _logger: WinstonLogger;

    constructor(logger: WinstonLogger) {
        this._logger = logger
    }

    public logSomething () {
        this._logger.error('HELOOOOO from ChildClass!!!')
    }
}

const cls = new ThisClass();
const kafka_listener = new KafkaListener(
    {
        client_config: {brokers: ['192.168.2.190:9092'], clientId: uuid()},
        consumer_config: {
            groupId: 'test_group',
            sessionTimeout: 25000,
            allowAutoTopicCreation: false
        }}
);


process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGBREAK', shutdown);

function shutdown() {
    console.log('Shutting down...');
    kafka_listener.close();
    process.exit(1);
}

function onMessage(topic: string, partition: number, message: KafkaMessage) {
    // @ts-ignore
    console.log("LOG RECEIVED", JSON.parse(message.value.toString()))
}

(async () => {
    await kafka_listener.listen('test_topic', false, onMessage);
    await cls.logSomething();
})()


