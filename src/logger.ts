import { CompressionTypes, Kafka, Producer } from "kafkajs";
// import { Format, TransformableInfo } from "logform";
import winston, { transports as winstonTransports } from 'winston'
import  'winston-daily-rotate-file';
import * as ITransport from "winston-transport";
// import {inspect} from "util";
// import colors = module

const { createLogger } = require('winston');
const { format } = require('logform');
const { combine, timestamp, label, printf, colorize } = format;
const Transport = require('winston-transport');

interface LoggerConfig {
    module: string;
    component: string;
    serviceID: string;
}

interface Sink {
    name: string;
    opts?: any;
}

interface KafkaConfig {
    client_config: {brokers: string[], clientId: string},
    producer_config: {
        allowAutoTopicCreation: boolean
    },
    sink_topic: string
}

export enum Sinks {
    CONSOLE = 'console',
    FILE = 'file',
    KAFKA = 'kafka'
}

export class ConsoleSink implements Sink {
    name = 'console'
}

export class KafkaSink implements Sink {
    name = 'kafka';
    opts: KafkaConfig;

    constructor(
        opts: KafkaConfig
    ) {
        this.opts = opts;
    }
}

export class FileSink implements Sink {
    name = 'file';
    opts: object;

    constructor(opts: {
        filename: string,
        datePattern: string,
        zippedArchive: boolean,
        maxSize: string,
        maxFiles: string
    }) {
        this.opts = opts;
    }
}

class KafkaTransport extends Transport {
    // private readonly _kafka: Kafka;
    private readonly _kafkaProducer: Producer;
    private readonly _sinkTopic: string;

    constructor(kafka_config: KafkaConfig, winstonTransportOpts?: ITransport.TransportStreamOptions) {
        super(winstonTransportOpts);
        // this._kafka = new Kafka(kafkaOpts.client_config)
        this._kafkaProducer = (new Kafka(kafka_config.client_config)).producer(kafka_config.producer_config);
        this._kafkaProducer.connect().then(_ => {
            console.log('Logger connected to Kafka.');
        });

        this._sinkTopic = kafka_config.sink_topic;
    }

    async logToKafka(info: any) {
        try {
            await this._kafkaProducer.send({
                topic: this._sinkTopic,
                messages: [{value: JSON.stringify(info)}],
                compression: CompressionTypes.GZIP
            })
        }
        catch (e) {
            console.log(e);
        }
    }

    log(info: any, callback: void) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        this.logToKafka(info).then(_ => {});
    }

    close () {
        this._kafkaProducer.disconnect().then(_ => {
            console.log('Logger disconnected from Kafka.');
        });
    }
}

export class Logger {
    public config: LoggerConfig;

    constructor(config: LoggerConfig) {
        this.config = config
    }

    public getFormat(colors?: boolean) {
        if (colors) {
            return combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                printf(({ message, timestamp, level, mainLabel, childLabel }: any) => {
                    if (childLabel) {return `${childLabel} | ${level} | ${timestamp} | ${message}`;}
                    else {return `${mainLabel} | ${level} | ${timestamp} | ${message}`;}
                })
            )
        } else {
            return combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                printf(({ message, timestamp, level, mainLabel, childLabel }: any) => {
                    if (childLabel) {return `${childLabel} | ${level} | ${timestamp} | ${message}`;}
                    else {return `${mainLabel} | ${level} | ${timestamp} | ${message}`;}
                })
            )
        }
    }

    public getLabel(child_config?: LoggerConfig) {
        if (child_config) {
            return `MODULE: ${child_config.module} | COMPONENT: ${child_config.component} | SERVICE_PID: ${process.pid} | SERVICE_ID: ${child_config.serviceID}`;
        } else {
            return `MODULE: ${this.config.module} | COMPONENT: ${this.config.component} | SERVICE_PID: ${process.pid} | SERVICE_ID: ${this.config.serviceID}`;
        }
    }

    public getDefaultLogger () {
        return createLogger({
            defaultMeta: { mainLabel: this.getLabel() },
            level: 'info',
            format: this.getFormat(true),
            transports: [new winston.transports.Console()],
        });
    }

    public getLogger(sinks: Sink[]) {
            const transports: any[] = [];
            sinks.forEach(sink => {
                if (sink.name === Sinks.CONSOLE) {
                    transports.push(new (winstonTransports.Console)());
                } else if (sink.name === Sinks.FILE) {
                    transports.push(new winstonTransports.DailyRotateFile(sink.opts));
                } else if (sink.name === Sinks.KAFKA) {
                    transports.push(new KafkaTransport(sink.opts))
                }
            })

        if (transports.length > 0) {
            // return new createLogger({transports: transports, format: this.getFormat()});
            return createLogger({
                defaultMeta: { mainLabel: this.getLabel() },
                level: 'info',
                format: this.getFormat(false),
                transports: transports,
            });
        } else {
            return this.getDefaultLogger();
        }
    }
}