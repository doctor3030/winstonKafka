import { Logger, ConsoleSink, FileSink, KafkaSink } from '../src/logger';
import { KafkaListener } from './utils/kafka_utils';
import { v4 as uuid } from 'uuid';
import { KafkaMessage } from 'kafkajs';
import { Logger as WinstonLogger } from 'winston';
import ErrnoException = NodeJS.ErrnoException;
import * as chai from 'chai';
import 'mocha';

const path = require('path');
const fs = require('fs');

class ThisClass {
  public readonly module = path.basename(__filename);
  public readonly component = 'ThisClass';
  public readonly serviceID = 'TestID';
  private _clsLogger: Logger;
  private _logger: WinstonLogger;
  private _childClass: ChildClass;

  constructor() {
    this._clsLogger = new Logger({
      module: this.module,
      component: this.component,
      serviceID: this.serviceID,
    });
    this._logger = this._clsLogger.getLogger([
      ConsoleSink,
      new FileSink({
        filename: './logs/%DATE%_log_file.log',
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new KafkaSink({
        client_config: { brokers: ['192.168.2.190:9092'], clientId: uuid() },
        // client_config: {brokers: ['10.0.0.74:9092'], clientId: uuid()},
        producer_config: { allowAutoTopicCreation: false },
        sink_topic: 'test_topic',
      }),
    ]);

    const childLoggerConf = {
      module: this.module,
      component: 'ChildClass',
      serviceID: this.serviceID,
    };
    const childLogger = this._logger.child({ childLabel: this._clsLogger.getLabel(childLoggerConf) });
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
    this._logger.error('HELOOOOO from ChildClass!!!');
  }
}

describe('Logger tests', () => {
  it('checking kafka logger', () => {
    const cls = new ThisClass();
    const kafkaListener = new KafkaListener({
      client_config: { brokers: ['192.168.2.190:9092'], clientId: uuid() },
      // client_config: {brokers: ['10.0.0.74:9092'], clientId: uuid()},
      consumer_config: {
        groupId: 'test_group',
        sessionTimeout: 25000,
        allowAutoTopicCreation: false,
      },
    });

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGBREAK', shutdown);

    function shutdown() {
      console.log('Shutting down...');
      kafkaListener.close().then((_) => {
        process.exit(0);
      });
    }

    function onMessage(topic: string, partition: number, message: KafkaMessage) {
      const outputFile = 'test_output_kafka.json';

      if (message.value) {
        const messageJson = JSON.parse(message.value.toString());
        let label: string;
        if (messageJson.childLabel) {
          label = messageJson.childLabel;
        } else {
          label = messageJson.mainLabel;
        }

        const output = {
          module: label.split('|')[0].split(':')[1].trim(),
          component: label.split('|')[1].split(':')[1].trim(),
          serviceID: label.split('|')[3].split(':')[1].trim(),
          level: messageJson.level,
          message: messageJson.message,
        };

        console.log('LOG RECEIVED: ', output);

        if (fs.existsSync(outputFile)) {
          fs.readFile(outputFile, (err: ErrnoException | null, data: Buffer) => {
            if (err) {
              console.log(err);
            } else {
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

    function delay(time: number) {
      return new Promise((resolve) => setTimeout(resolve, time));
    }

    const expectedOutput = [
      {
        module: path.basename(__filename),
        component: 'ChildClass',
        serviceID: 'TestID',
        level: 'error',
        message: 'HELOOOOO from ChildClass!!!',
      },
      {
        module: path.basename(__filename),
        component: 'ThisClass',
        serviceID: 'TestID',
        level: 'info',
        message: 'HELOOOOO from ThisClass!!!',
      },
    ];

    (async () => {
      await kafkaListener.listen('test_topic', false, onMessage);
      await cls.logSomething();
      await delay(5000);
      cls.close();
      await kafkaListener.close();
    })().then((_) => {
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
});
