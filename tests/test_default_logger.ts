import {Logger} from "../src/logger";
const path = require('path')
import { v4 as uuid } from 'uuid';
import { Logger as WinstonLogger } from "winston";

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

const cls = new ThisClass();
cls.logSomething();