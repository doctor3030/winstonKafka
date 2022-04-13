# Simple winston-based logger with Kafka transport

This logger is a simple wrap around [winston](https://www.npmjs.com/package/winston). There are standard winston transports plus [daily rotate file](https://www.npmjs.com/package/winston-daily-rotate-file) and [Kafka](https://www.npmjs.com/package/kafkajs) transports.
The Kafka transport is built around [kafkajs](https://www.npmjs.com/package/kafkajs).
> **_NOTE:_**  Transports are called Sinks in this module.
## Installation

```
npm install winston-logger-kafka
```

## Usage
First, you must supply a basic properties for the logger:
- **module:** A name of your service.
- **component:** A name of your service component.
- **level:** A log level.

### getDefaultLogger() method
The quickest way to create logger is to use **getDefaultLogger** method that returns a winston logger with console transport:
```typescript
import * as Logger from "winston-logger-kafka";

const config: Logger.LoggerConfig = {
    module: 'MyService',
    component: 'MyComponent',
    level: Logger.Levels.INFO
};

const logger = Logger.getDefaultLogger(config);

logger.info('Hello!')
```

### getLogger() method
Use this method to create logger with custom transports:

```typescript
import * as Logger from "winston-logger-kafka";

const config: Logger.LoggerConfig = {
    module: 'MyService',
    component: 'MyComponent',
    level: Logger.Levels.INFO
};

const sinks = [
    new Logger.ConsoleSink,
    new Logger.FileSink({
        filename: './logs/%DATE%_log_file.log',
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: false,
        maxSize: '20m',
        frequency: '14d',
    }),
    new Logger.KafkaSink({
        clientConfig: {brockers: ['localhost:9092']},
        producerConfig: { allowAutoTopicCreation: false },
        sinkTopic: 'test_topic',
    })
]

const logger = Logger.getLogger(config, sinks);

logger.info('Hello!')
```
> **_NOTE:_**  Standard sink options are the same as options of corresponding winston transport.

## Use standalone kafka transport
You can also use kafka transport with pure winston:
```typescript
import {KafkaTransport, KafkaTransportConfig} from "winston-logger-kafka";

const kafka_transport_conf = {
    clientConfig: {brockers: ['localhost:9092']},
    producerConfig: { allowAutoTopicCreation: false },
    sinkTopic: 'test_topic',
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new KafkaTransport(kafka_transport_conf)
    ],
});
```

## getChildLogger method
Get logger for a child class:
```typescript

const childLoggerConf = {
    module: 'MyService',
    component: 'ChildClass',
    level: Logger.Levels.INFO
};

const childLogger = Logger.getChildLogger(parentlogger, childLoggerConf);
```

## LICENSE
MIT

##### AUTHOR: [Dmitry Amanov](https://github.com/doctor3030)