import { Logger } from '../src/logger';
import { Logger as WinstonLogger } from 'winston';
import * as chai from 'chai';
import 'mocha';

const path = require('path');

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
    this._logger = this._clsLogger.getDefaultLogger();

    const childLoggerConf = {
      module: this.module,
      component: 'ChildClass',
      serviceID: this.serviceID,
    };
    const childLogger = this._logger.child({ childLabel: this._clsLogger.getLabel(childLoggerConf) });
    this._childClass = new ChildClass(childLogger);
  }

  public logSomething() {
    this._logger.info('HELOOOOO from ThisClass!!!');
    this._childClass.logSomething();
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
  it('checking default logger (console)', () => {
    let consoleOutput = '';

    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    // @ts-ignore
    process.stdout.write = (chunk, encoding, callback) => {
      if (typeof chunk === 'string') {
        consoleOutput += chunk;
      }

      return originalStdoutWrite(chunk, encoding, callback);
    };

    // MODULE: test_default_logger.js | COMPONENT: ThisClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | info | 2021-12-21 23:06:54.505 | HELOOOOO from ThisClass!!!
    // MODULE: test_default_logger.js | COMPONENT: ChildClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | error | 2021-12-21 23:06:54.507 | HELOOOOO from ChildClass!!!

    const expectedOutput = [
      {
        module: 'test_default_logger.ts',
        component: 'ThisClass',
        serviceID: 'TestID',
        level: 'info',
        message: 'HELOOOOO from ThisClass!!!',
      },
      {
        module: 'test_default_logger.ts',
        component: 'ChildClass',
        serviceID: 'TestID',
        level: 'error',
        message: 'HELOOOOO from ChildClass!!!',
      },
    ];

    const cls = new ThisClass();
    cls.logSomething();

    process.stdout.write = originalStdoutWrite;
    const outputArr = consoleOutput
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
      .split('\n')
      .filter((i) => {
        return i.length > 0;
      });

    const output: any = [];
    outputArr.forEach((msg) => {
      const arr = msg.split('|');
      const _obj = {
        module: arr[0].split(':')[1].trim(),
        component: arr[1].split(':')[1].trim(),
        serviceID: arr[3].split(':')[1].trim(),
        level: arr[4].trim(),
        message: arr[6].trim(),
      };
      output.push(_obj);
    });

    chai.assert.deepEqual(expectedOutput, output);
  });
});
