import * as kafkajs from 'kafkajs';
import 'winston-daily-rotate-file'
import winston, {transports as winstonTransports, Logger as winstonLogger} from 'winston';
import {DailyRotateFileTransportOptions, } from 'winston-daily-rotate-file';
import * as ITransport from 'winston-transport';

const {createLogger} = require('winston');
const {format} = require('logform');
const {combine, timestamp, label, printf, colorize} = format;
const Transport = require('winston-transport');

export enum Levels {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

export interface LoggerConfig {
    // module: string;
    // component: string;
    level: string
    // serviceID?: string;
    labelGenerator?: () => string
}

export interface Sink {
    name: string;
    opts?: ITransport.TransportStreamOptions;
}

export interface KafkaTransportConfig extends ITransport.TransportStreamOptions {
    clientConfig?: kafkajs.KafkaConfig;
    producerConfig?: kafkajs.ProducerConfig;
    sinkTopic?: string;
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
    private readonly _kafkaProducer: kafkajs.Producer;
    private readonly _sinkTopic: string;

    constructor(kafkaConfig: KafkaTransportConfig | undefined) {
        super(Transport);
        if (kafkaConfig && kafkaConfig.clientConfig && kafkaConfig.sinkTopic) {
            this._kafkaProducer = new kafkajs.Kafka(kafkaConfig.clientConfig).producer(kafkaConfig.producerConfig);
            this._kafkaProducer.connect().then((_) => {
                console.log('Logger connected to Kafka.');
            });
            this._sinkTopic = kafkaConfig.sinkTopic;
        } else {
            this._kafkaProducer = new kafkajs.Kafka({brokers: ['localhost:9092']}).producer();
            this._kafkaProducer.connect().then((_) => {
                console.log('Logger connected to Kafka.');
            });
            this._sinkTopic = 'test_topic';
        }
    }

    async logToKafka(info: any) {
        // try {
        await this._kafkaProducer.send({
            topic: this._sinkTopic,
            messages: [{value: JSON.stringify(info)}],
            compression: kafkajs.CompressionTypes.GZIP,
        });
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