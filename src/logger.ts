import * as kafkajs from 'kafkajs';
import 'winston-daily-rotate-file'
import winston, {transports as winstonTransports, Logger as winstonLogger} from 'winston';
import {DailyRotateFileTransportOptions, } from 'winston-daily-rotate-file';
import * as ITransport from 'winston-transport';
import {format} from "logform"

const {createLogger} = require('winston');
const {combine, timestamp, printf, colorize} = format;
const Transport = require('winston-transport');

export enum Levels {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

export interface LoggerConfig {
    level: string
    labelGenerator?: () => string
}

export interface Sink {
    name: string;
    opts?: ITransport.TransportStreamOptions;
}

export interface KafkaTransportProducerConfig extends kafkajs.ProducerConfig {
    partition?: number;
    headers?: kafkajs.IHeaders;
    acks?: number;
    timeout?: number;
    messageKey?: string;
    messageKeyEncoder?: (key: any) => Buffer | string | null;
    messageValueEncoder?: (val: any) => Buffer | string | null;
    messageTimestampEncoder?: () => string,
    producerRecordCompression?: kafkajs.CompressionTypes;
}

export interface KafkaTransportConfig extends ITransport.TransportStreamOptions {
    clientConfig?: kafkajs.KafkaConfig;
    sinkTopic?: string;
    producerConfig?: KafkaTransportProducerConfig;
}

export enum Sinks {
    CONSOLE = 'console',
    FILE = 'file',
    KAFKA = 'kafka',
    HTTP = 'http',
    STREAM = 'stream'
}

export interface ILogger extends winstonLogger {
}

export class ConsoleSink implements Sink {
    name = Sinks.CONSOLE;
    opts?: winstonTransports.ConsoleTransportOptions
}

export class KafkaSink implements Sink {
    name = Sinks.KAFKA;
    opts: KafkaTransportConfig;

    constructor(opts: KafkaTransportConfig) {
        this.opts = opts;
    }
}

export class FileSink implements Sink {
    name = Sinks.FILE;
    opts?: DailyRotateFileTransportOptions;

    constructor(opts: DailyRotateFileTransportOptions) {
        this.opts = opts;
    }
}

export class HttpSink implements Sink {
    name = Sinks.HTTP;
    opts?: winstonTransports.HttpTransportOptions;

    constructor(opts: winstonTransports.HttpTransportOptions) {
        this.opts = opts;
    }
}

export class StreamSink implements Sink {
    name = Sinks.STREAM;
    opts?: winstonTransports.StreamTransportOptions;

    constructor(opts: winstonTransports.StreamTransportOptions) {
        this.opts = opts;
    }
}

export class KafkaTransport extends Transport {
    private readonly _config: KafkaTransportConfig;
    private readonly _kafkaProducer: kafkajs.Producer;
    private readonly _sinkTopic: string;

    constructor(kafkaConfig?: KafkaTransportConfig) {
        super(Transport);
        
        if (!kafkaConfig?.clientConfig) {throw new Error(`[winston kafka transport] kafka client config required.`)}
        if (!kafkaConfig?.sinkTopic) {throw new Error(`[winston kafka transport] sink topic required.`)}
        
        // if (kafkaConfig && kafkaConfig.clientConfig && kafkaConfig.sinkTopic) {
        this._config = kafkaConfig;
        this._kafkaProducer = new kafkajs.Kafka(kafkaConfig.clientConfig).producer(kafkaConfig.producerConfig);
        this._kafkaProducer.connect().then((_) => {
            // console.log('Logger connected to Kafka.');
        });
        this._sinkTopic = kafkaConfig.sinkTopic;
        // }
        // else {
        //     this._kafkaProducer = new kafkajs.Kafka({brokers: ['localhost:9092']}).producer();
        //     this._kafkaProducer.connect().then((_) => {
        //         console.log('Logger connected to Kafka.');
        //     });
        //     this._sinkTopic = 'test_topic';
        // }
    }

    async logToKafka(info: any) {
        // try {
        const msgKey = this._config.producerConfig?.messageKey ? this._config.producerConfig.messageKey : null;
        const msgVal = this._config.producerConfig?.messageValueEncoder ? this._config.producerConfig.messageValueEncoder(info) : JSON.stringify(info);
        const msg: kafkajs.Message = {
            key: !msgKey ? null : this._config.producerConfig?.messageKeyEncoder ? this._config.producerConfig.messageKeyEncoder(msgKey) : msgKey,
            value: msgVal,
            partition: this._config.producerConfig?.partition ? this._config.producerConfig.partition : undefined,
            headers: this._config.producerConfig?.headers ? this._config.producerConfig.headers : undefined,
            timestamp: this._config.producerConfig?.messageTimestampEncoder ? this._config.producerConfig.messageTimestampEncoder() : undefined
        }
        const record: kafkajs.ProducerRecord = {
            topic: this._sinkTopic,
            messages: [msg],
            acks: this._config.producerConfig?.acks ? this._config.producerConfig.acks : undefined,
            timeout: this._config.producerConfig?.timeout ? this._config.producerConfig.timeout : undefined,
            compression: this._config.producerConfig?.producerRecordCompression ? this._config.producerConfig.producerRecordCompression : undefined,
        }
        // await this._kafkaProducer.send({
        //     topic: this._sinkTopic,
        //     messages: [{value: JSON.stringify(info)}],
        //     compression: kafkajs.CompressionTypes.GZIP,
        // });

        await this._kafkaProducer.send(record);
    }

    log(info: any, callback: any) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        this.logToKafka(info).then((_) => {
            // console.log('MESSAGE SENT')
        });
        callback();
    }

    close() {
        this._kafkaProducer.disconnect().then((_) => {
            console.log('Logger disconnected from Kafka.');
        });
    }
}

export function getFormat(colors?: boolean) {
    if (colors) {
        return combine(
            colorize(),
            timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
            printf(({message, timestamp, level, mainLabel, childLabel}: any) => {
                if (childLabel) {
                    return `${childLabel} | ${level} | ${timestamp} | ${message}`;
                } else {
                    return `${mainLabel} | ${level} | ${timestamp} | ${message}`;
                }
            }),
        );
    } else {
        return combine(
            timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
            printf(({message, timestamp, level, mainLabel, childLabel}: any) => {
                if (childLabel) {
                    return `${childLabel} | ${level} | ${timestamp} | ${message}`;
                } else {
                    return `${mainLabel} | ${level} | ${timestamp} | ${message}`;
                }
            }),
        );
    }
}

export function getDefaultLogger(config: LoggerConfig) {
    return createLogger({
        defaultMeta: {mainLabel: config.labelGenerator ? config.labelGenerator() : ''},
        level: config.level,
        format: getFormat(true),
        transports: [new winston.transports.Console()],
    });
}

export function getLogger(config: LoggerConfig, sinks: Sink[]) {
    const transports: typeof Transport[] = [];
    sinks.forEach((sink) => {
        if (sink.name === Sinks.CONSOLE) {
            transports.push(new winstonTransports.Console(sink.opts));
        } else if (sink.name === Sinks.FILE) {
            transports.push(new winstonTransports.DailyRotateFile(sink.opts));
        } else if (sink.name === Sinks.HTTP) {
            transports.push(new winstonTransports.Http(sink.opts));
        } else if (sink.name === Sinks.STREAM) {
            transports.push(new winstonTransports.Stream(sink.opts as winstonTransports.StreamTransportOptions));
        }  else if (sink.name === Sinks.KAFKA) {
            transports.push(new KafkaTransport(sink.opts));
        }
    });

    if (transports.length > 0) {
        return createLogger({
            defaultMeta: {mainLabel: config.labelGenerator ? config.labelGenerator() : ''},
            level: config.level,
            format: getFormat(false),
            transports: transports,
        });
    } else {
        return getDefaultLogger(config);
    }
}

export function getChildLogger(logger: winstonLogger, labelGenerator?: () => string) {
    return logger.child({childLabel: labelGenerator ? labelGenerator() : undefined});
}