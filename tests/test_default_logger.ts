import {Logger} from "../winston_logger";
const path = require('path')
import { v4 as uuid } from 'uuid';

class thisClass {
    private _clsLogger = new Logger({
        module: path.basename(__filename),
        component: "thisClass",
        serviceID: uuid()
    });
    private _logger = this._clsLogger.getDefaultLogger();

    public doSomething () {
        this._logger.info('HELOOOOO!!!')
    }
}

const cls = new thisClass();
cls.doSomething();


// console.log(__filename);