import {Logger} from "../src/logger";
const path = require('path')
// import { v4 as uuid } from 'uuid';
import { Logger as WinstonLogger } from "winston";
import * as chai from 'chai';
import 'mocha';
// import {deepEqual} from "assert";
// const assert = require('assert');

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
        this._logger = this._clsLogger.getDefaultLogger();

        let child_logger_conf = {
                module: this.module,
                component: 'ChildClass',
                serviceID: this.serviceID
            }
        let child_logger = this._logger.child({ childLabel: this._clsLogger.getLabel(child_logger_conf) })
        this._childClass = new ChildClass(child_logger)
    }

    public logSomething () {
        this._logger.info('HELOOOOO from ThisClass!!!');
        this._childClass.logSomething();
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
}

describe('Logger tests', () => {
    it('checking default logger (console)', () => {
        let console_output = '';

        const originalStdoutWrite = process.stdout.write.bind(process.stdout);
        // @ts-ignore
        process.stdout.write = (chunk, encoding, callback) => {
          if (typeof chunk === 'string') {
            console_output += chunk;
          }

          return originalStdoutWrite(chunk, encoding, callback);
        };

        // MODULE: test_default_logger.js | COMPONENT: ThisClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | info | 2021-12-21 23:06:54.505 | HELOOOOO from ThisClass!!!
        // MODULE: test_default_logger.js | COMPONENT: ChildClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | error | 2021-12-21 23:06:54.507 | HELOOOOO from ChildClass!!!

        let expected_output = [{
                module: 'test_default_logger.ts',
                component: 'ThisClass',
                serviceID: 'TestID',
                level: 'info',
                message: 'HELOOOOO from ThisClass!!!'
            },
            {
                module: 'test_default_logger.ts',
                component: 'ChildClass',
                serviceID: 'TestID',
                level: 'error',
                message: 'HELOOOOO from ChildClass!!!'
            }]

        const cls = new ThisClass();
        cls.logSomething();

        process.stdout.write = originalStdoutWrite;
        let output_arr = console_output
            .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
            .split('\n')
            .filter((i) => { return i.length > 0; })

        let output: any = [];
        output_arr.forEach(msg => {
            let arr = msg.split('|')
            // console.log(arr[3].split(':')[1].trim())
            let _obj = {
                module: arr[0].split(':')[1].trim(),
                component: arr[1].split(':')[1].trim(),
                serviceID: arr[3].split(':')[1].trim(),
                level: arr[4].trim(),
                message: arr[6].trim(),
            };
            output.push(_obj);

        })
        // console.log(output_obj);
        // console.log(console_output);
        // output;
        // assert.deepEqual(expected_output, output);
        chai.assert.deepEqual(expected_output, output);
    });
});


// let console_output = '';
//
// const originalStdoutWrite = process.stdout.write.bind(process.stdout);
// // @ts-ignore
// process.stdout.write = (chunk, encoding, callback) => {
//   if (typeof chunk === 'string') {
//     console_output += chunk;
//   }
//
//   return originalStdoutWrite(chunk, encoding, callback);
// };
//
// // MODULE: test_default_logger.js | COMPONENT: ThisClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | info | 2021-12-21 23:06:54.505 | HELOOOOO from ThisClass!!!
// // MODULE: test_default_logger.js | COMPONENT: ChildClass | SERVICE_PID: 347469 | SERVICE_ID: TestID | error | 2021-12-21 23:06:54.507 | HELOOOOO from ChildClass!!!
//
// let expected_output = [{
//         module: 'test_default_logger.js',
//         component: 'ThisClass',
//         serviceID: 'TestID',
//         level: 'info',
//         message: 'HELOOOOO from ThisClass!!!'
//     },
//     {
//         module: 'test_default_logger.js',
//         component: 'ChildClass',
//         serviceID: 'TestID',
//         level: 'error',
//         message: 'HELOOOOO from ChildClass!!!'
//     }]
//
// const cls = new ThisClass();
// cls.logSomething();
//
// process.stdout.write = originalStdoutWrite;
// let output_arr = console_output
//     .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
//     .split('\n')
//     .filter((i) => { return i.length > 0; })
//
// let output: any = [];
// output_arr.forEach(msg => {
//     let arr = msg.split('|')
//     // console.log(arr[3].split(':')[1].trim())
//     let _obj = {
//         module: arr[0].split(':')[1].trim(),
//         component: arr[1].split(':')[1].trim(),
//         serviceID: arr[3].split(':')[1].trim(),
//         level: arr[4].trim(),
//         message: arr[6].trim(),
//     };
//     output.push(_obj);
//
// })
// // console.log(output_obj);
// // console.log(console_output);
// // output;
// assert.deepEqual(expected_output, output);
