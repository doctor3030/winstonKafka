import * as Logger from '../src/logger';
import {KafkaListener} from './utils/kafka_utils';
import {v4 as uuid} from 'uuid';
import {CompressionTypes, KafkaMessage} from 'kafkajs';
import {Logger as WinstonLogger} from 'winston';
import * as chai from 'chai';
import 'mocha';
import ErrnoException = NodeJS.ErrnoException;

const path = require('path');
const fs = require('fs');


const kafkaClientConfig = {brokers: ['127.0.0.1:29092'], clientId: uuid()};

async function delay(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

class ThisClass {
    private _logger: Logger.ILogger;
    private _childClass: ChildClass;

    constructor() {
        this._logger = Logger.getLogger({
            level: Logger.Levels.DEBUG,
            labelGenerator: () => {
                return `SERVICE NAME: TestService | SERVICE ID: TestID | MODULE: ${path.basename(__filename)} | COMPONENT: ThisClass | PID: ${process.pid}`;
            }
        }, [
            new Logger.ConsoleSink,
            new Logger.FileSink({
                filename: './logs/%DATE%_log_file.log',
                datePattern: 'YYYY-MM-DD-HH',
                zippedArchive: false,
                maxSize: '20m',
                frequency: '14d',
            }),
            new Logger.KafkaSink({
                clientConfig: kafkaClientConfig,
                producerConfig: {
                    allowAutoTopicCreation: false,
                    messageKey: 'log_message',
                    messageKeyEncoder: Buffer.from,
                    messageValueEncoder: val => {
                        const label = val.childLabel ? val.childLabel : val.mainLabel
                        return JSON.stringify({
                            serviceName: label.split('|')[0].split(':')[1].trim(),
                            serviceID: label.split('|')[1].split(':')[1].trim(),
                            module: label.split('|')[2].split(':')[1].trim(),
                            component: label.split('|')[3].split(':')[1].trim(),
                            level: val.level,
                            message: val.message,
                        })
                    },
                    producerRecordCompression: CompressionTypes.GZIP,
                },
                sinkTopic: 'test_topic',
            }),
        ]);

        const childLogger = Logger.getChildLogger(this._logger, () => {
            return `SERVICE NAME: TestService | SERVICE ID: TestID | MODULE: ${path.basename(__filename)} | COMPONENT: ChildClass | PID: ${process.pid}`;
        })
        this._childClass = new ChildClass(childLogger);
    }

    public async logSomething() {
        this._logger.info('HELOOOOO from ThisClass!!!');
        this._childClass.logSomething();
    }

    public close() {
        console.log('Closing ThisClass...');
        this._logger.close();
    }
}

class ChildClass {
    private _logger: WinstonLogger;

    constructor(logger: WinstonLogger) {
        this._logger = logger;
    }

    public logSomething() {
        this._logger.debug('HELOOOOO from ChildClass!!!');
    }
}

describe('Logger tests', () => {
    it('checking kafka logger', async () => {
        const cls = new ThisClass();
        const kafkaListener = new KafkaListener({
            client_config: kafkaClientConfig,
            consumer_config: {
                groupId: 'test_group',
                sessionTimeout: 25000,
                allowAutoTopicCreation: false,
            },
        });

        const expectedOutput = [
            {
                serviceName: 'TestService',
                serviceID: 'TestID',
                module: 'test_kafka_logger.ts',
                component: 'ThisClass',
                level: 'info',
                message: 'HELOOOOO from ThisClass!!!',
            },
            {
                serviceName: 'TestService',
                serviceID: 'TestID',
                module: 'test_kafka_logger.ts',
                component: 'ChildClass',
                level: 'debug',
                message: 'HELOOOOO from ChildClass!!!',
            },
        ];

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        process.on('SIGBREAK', shutdown);

        function shutdown() {
            console.log('Shutting down...');
            kafkaListener.close().then((_) => {
                process.exit(0);
            });
        }

        // let msgCounter = 0;
        function onMessage(topic: string, partition: number, message: KafkaMessage) {
            const outputFile = 'test_output_kafka.json';

            if (message.value) {
                const output = JSON.parse(message.value.toString());

                // console.log('LOG RECEIVED: ', output);

                if (fs.existsSync(outputFile)) {
                    fs.readFile(outputFile, (err: ErrnoException | null, data: Buffer) => {
                        if (err) {
                            console.log(err);
                        } else {
                            // console.log(data.toString())
                            const json = JSON.parse(data.toString());
                            json.push(output);
                            fs.writeFile(outputFile, JSON.stringify(json), (err: ErrnoException | null) => {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        }
                    });
                } else {
                    fs.writeFile(outputFile, JSON.stringify([output]), (err: ErrnoException | null) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            }
        }

        await kafkaListener.listen('test_topic', false, onMessage);
        await cls.logSomething();
        await delay(1000);

        await cls.close();
        await kafkaListener.close()

        const outputFile = 'test_output_kafka.json';
        fs.readFile(outputFile, (err: ErrnoException | null, data: Buffer) => {
            const output = JSON.parse(data.toString());
            chai.assert.deepEqual(expectedOutput, output);
        });
        fs.unlink(outputFile, (err: ErrnoException | null) => {
            if (err) {
                console.log(err);
            }
        });
    });
});
