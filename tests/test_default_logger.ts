import * as Logger from '../src/logger';
import {Logger as WinstonLogger} from 'winston';
import * as chai from 'chai';
import 'mocha';

const path = require('path');

class ThisClass {
    private _logger: Logger.ILogger;
    private _childClass: ChildClass;

    constructor() {
        this._logger = Logger.getDefaultLogger({
            level: Logger.Levels.DEBUG,
            labelGenerator: () => {
                return `SERVICE NAME: TestService | SERVICE ID: TestID | MODULE: ${path.basename(__filename)} | COMPONENT: ThisClass | PID: ${process.pid}`;
            }
        });

        // const labelGenerator = () => {
        //     return `SERVICE NAME: TestService | SERVICE ID: TestID | MODULE: ${path.basename(__filename)} | COMPONENT: ChildClass | PID: ${process.pid}`;
        // }
        const childLogger = Logger.getChildLogger(this._logger, () => {
            return `SERVICE NAME: TestService | SERVICE ID: TestID | MODULE: ${path.basename(__filename)} | COMPONENT: ChildClass | PID: ${process.pid}`;
        })
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
        this._logger.debug('HELOOOOO from ChildClass!!!');
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

        const expectedOutput = [
            {
                serviceName: 'TestService',
                serviceID: 'TestID',
                module: 'test_default_logger.ts',
                component: 'ThisClass',
                level: 'info',
                message: 'HELOOOOO from ThisClass!!!',
            },
            {
                serviceName: 'TestService',
                serviceID: 'TestID',
                module: 'test_default_logger.ts',
                component: 'ChildClass',
                level: 'debug',
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
            // console.log(arr)
            const _obj = {
                serviceName: arr[0].split(':')[1].trim(),
                serviceID: arr[1].split(':')[1].trim(),
                module: arr[2].split(':')[1].trim(),
                component: arr[3].split(':')[1].trim(),
                level: arr[5].trim(),
                message: arr[7].trim(),
            };
            output.push(_obj);
        });

        chai.assert.deepEqual(expectedOutput, output);
    });
});
