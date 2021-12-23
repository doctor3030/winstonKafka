import { Logger, ConsoleSink, FileSink, KafkaSink } from "../src/logger";
import { KafkaListener } from './utils/kafka_utils'
const path = require('path')
const fs = require('fs')
import { v4 as uuid } from 'uuid';
import {CompressionTypes, Kafka, Producer, Consumer, PartitionAssigner, RetryOptions, KafkaMessage} from "kafkajs";
import {format, Logger as WinstonLogger} from "winston";
// import {deepEqual} from "assert";
// import label = format.label;
import ErrnoException = NodeJS.ErrnoException;
// import JSON = Mocha.reporters.JSON;
// const assert = require('assert');
import * as chai from 'chai';
import 'mocha';

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
                filename: './logs/%DATE%_log_file.log',
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
        // console.log(child_logger.transports);
        // child_logger.info('AAAAAAAAAAAAAAAAA')
        this._childClass = new ChildClass(child_logger)
    }

    public async logSomething () {
        this._logger.info('HELOOOOO from ThisClass!!!')
        this._childClass.logSomething();
        // this._logger.info('HELOOOOO from ThisClass AGAIN!!!')
        // this._logger.close();
    }

    public close() {
        console.log('Closing ThisClass...')
        // this._childClass.close();
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

    // public close() {
    //     console.log('Closing ChildClass...')
    //     this._logger.close();
    // }
}

describe('Logger tests', () => {
    it('checking kafka logger', () => {
        const cls = new ThisClass();
        const kafka_listener = new KafkaListener(
            {
                client_config: {brokers: ['192.168.2.190:9092'], clientId: uuid()},
                // client_config: {brokers: ['10.0.0.74:9092'], clientId: uuid()},
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
            kafka_listener.close().then(_ => {
                process.exit(0);
            });
        }

        // declare var output: any[];
        function onMessage(topic: string, partition: number, message: KafkaMessage) {
            // declare global output;

            let output_file = 'test_output_kafka.json';
            // let output_file = path.basename(__filename)

            if (message.value) {
                let message_json = JSON.parse(message.value.toString());
                let label: string;
                if (message_json.childLabel) { label = message_json.childLabel; } else { label = message_json.mainLabel; }

                let output = {
                    module: label.split('|')[0].split(':')[1].trim(),
                    component: label.split('|')[1].split(':')[1].trim(),
                    serviceID: label.split('|')[3].split(':')[1].trim(),
                    level: message_json.level,
                    message: message_json.message
                }

                console.log("LOG RECEIVED: ", output);

                if (fs.existsSync(output_file)) {
                    fs.readFile(output_file, function (err: ErrnoException | null, data: Buffer) {
                        if (err) {
                            console.log(err);
                        } else {
                            let json = JSON.parse(data.toString());
                            json.push(output);
                            fs.writeFile(output_file, JSON.stringify(json), function (err: ErrnoException | null) {
                                if (err) {
                                    console.log(err);
                                }
                            })
                        }
                    })
                } else {
                    fs.writeFile(output_file, JSON.stringify([output]), function(err: ErrnoException | null) {
                        if (err) { console.log(err); }
                    });
                }
            }
        }

        function delay(time: number) {
            return new Promise(resolve => setTimeout(resolve, time));
        }

        let expected_output = [
            {
                module: path.basename(__filename),
                component: 'ChildClass',
                serviceID: 'TestID',
                level: 'error',
                message: 'HELOOOOO from ChildClass!!!'
            },
            {
                module: path.basename(__filename),
                component: 'ThisClass',
                serviceID: 'TestID',
                level: 'info',
                message: 'HELOOOOO from ThisClass!!!'
            }
            ];

        (async () => {
            await kafka_listener.listen('test_topic', false, onMessage);
            await cls.logSomething();
            await delay(5000);
            cls.close();
            // let output_file = 'test_output_kafka.json';


            // shutdown();
            await kafka_listener.close();
        })().then(_ => {
            let output_file = 'test_output_kafka.json';
            // let output_file = path.basename(__filename)
            fs.readFile(output_file, function (err: ErrnoException | null, data: Buffer) {
                let output = JSON.parse(data.toString());
                // console.log(output);
                chai.assert.deepEqual(expected_output, output)
            });
            fs.unlink(output_file, function (err: ErrnoException | null) {
                if (err) { console.log(err); }
            })
        })
    })
})



