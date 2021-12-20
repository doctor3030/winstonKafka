// import { v4 as uuid } from 'uuid';
import { CompressionTypes, Kafka, Producer } from "kafkajs";
import { Format, TransformableInfo } from "logform";
// import * as Config from "winston/lib/winston/config";
// import * as logform from "logform";

// const winston = require('winston');
import { transports as winstonTransports } from 'winston'
const { createLogger } = require('winston');
const { format } = require('logform');
const { combine, timestamp, label, printf, colorize } = format;
// const path = require('path')

import  'winston-daily-rotate-file';

import * as ITransport from "winston-transport";
const Transport = require('winston-transport');


interface Sink {
    name: string;
    opts?: object;
}

export class ConsoleSink implements Sink {
    name = 'console'
}

export class KafkaSink implements Sink {
    name = 'kafka';
    opts: object;

    constructor(
        opts: {
            client_config: {brokers: Array<string>, clientId: string},
            producer_config: {allowAutoTopicCreation: boolean},
            sink_topic: string}
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

interface LoggerConfig {
    module: string;
    component: string;
    serviceID: string;
}

enum Sinks {
    CONSOLE = 'console',
    FILE = 'file',
    KAFKA = 'kafka'
}


class KafkaTransport extends Transport {
    private readonly _kafka: Kafka;
    private readonly _kafkaProducer: Producer;
    private readonly _sink_topic: string;

    constructor(kafkaOpts: any, winstonTransportOpts?: ITransport.TransportStreamOptions) {
        super(winstonTransportOpts);
        this._kafka = new Kafka(kafkaOpts.client_config)
        this._kafkaProducer = this._kafka.producer(kafkaOpts.producer_config)
        this._kafkaProducer.connect().then(r => {
            console.log('Logger connected to Kafka.');
        });

        this._sink_topic = kafkaOpts.sink_topic;
    }

    logKafkaSink(msg: any) {
        this._kafkaProducer?.send({
            topic: this._sink_topic,
            messages: [{value: msg}],
            compression: CompressionTypes.GZIP
        })
    }

    log(info: any, callback=this.logKafkaSink) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        // this.logKafkaSink(JSON.stringify(info));

        callback(JSON.stringify(info));
    }

    close () {
        this._kafkaProducer?.disconnect().then(r => {
            console.log('Logger disconnected from Kafka.');
        });
    }
}


export class Logger {
    private readonly _kafka: Kafka | undefined;
    private readonly _kafkaProducer: Producer | undefined;
    // private readonly _sink_topic: string = '';
    private readonly _format: Format;

    constructor(config: LoggerConfig) {
        // if (config) {
        //     this._kafka = new Kafka(kafka_config.client_config)
        //     this._kafkaProducer = this._kafka.producer(kafka_config.producer_config)
        //     this._kafkaProducer.connect().then(r => {
        //         console.log('Logger connected to Kafka.');
        //     });
        //
        //     this._sink_topic = kafka_config.sink_topic;
        // }


        this._format = combine(
            colorize(),
            label({ label: `MODULE: ${config.module} | COMPONENT: ${config.component} | SERVICE_PID: ${process.pid} | SERVICE_ID: ${config.serviceID}` }),
            timestamp(),
            printf((info: TransformableInfo) => {return `${info.label} | ${info.level} | ${info.timestamp} | ${info.message}`})
        )

        // if (config.sinks) {
        //
        // } else {
        //     transports
        // }


    }

    // private logKafkaSink(msg: any) {
    //     this._kafkaProducer?.send({
    //         topic: this._sink_topic,
    //         messages: [{value: msg}],
    //         compression: CompressionTypes.GZIP
    //     })
    // }

    public getDefaultLogger () {
        return new createLogger({transports: [new (winstonTransports.Console)()], format: this._format});
    }

    // def get_logger(self, sinks, **args):
    //     logger.remove()
    //     if 'stdout' in sinks:
    //         logger.add(sys.stdout,
    //                    format=self.stdout_format,
    //                    level='INFO', filter=self.filter_stdout)
    //     if 'stderr' in sinks:
    //         logger.add(sys.stderr,
    //                    format=self.stderr_format,
    //                    level='ERROR')
    //     if 'kafka' in sinks:
    //         if self.producer is not None:
    //             logger.add(self.log_kafka_sink,
    //                        format=self.plain_format,
    //                        level='INFO', serialize=True)
    //         else:
    //             print('Kafka channel requested but no bootstrap servers provided.', file=sys.stderr)
    //     if 'file' in sinks:
    //         path = args.get('path')
    //         rotation = args.get('rotation')
    //         retention = args.get('retention')
    //
    //         logger.add(path,
    //                    rotation=rotation,
    //                    retention=retention,
    //                    format=self.plain_format,
    //                    level='INFO', serialize=True)
    //     return logger.bind(service_id=str(uuid.uuid4()))

    public getLogger(sinks: Array<Sink>) {
            const transports: Array<any> = [];
            sinks.forEach(sink => {
                if (sink.name === Sinks.CONSOLE) {
                    transports.push(new (winstonTransports.Console)());
                } else if (sink.name === Sinks.FILE) {
                    transports.push(new winstonTransports.DailyRotateFile(sink.opts));
                } else if (sink.name === Sinks.KAFKA) {
                    transports.push(new KafkaTransport(sink.opts))
                }
            })
        // console.log(transports);
        if (transports.length > 0) {
            return new createLogger({transports: transports, format: this._format});
        } else {
            return this.getDefaultLogger();
        }
    }

    // close () {
    //     this._kafkaProducer?.disconnect().then(r => {
    //         console.log('KAFKA DISCONNECTED');
    //     });
    // }
}