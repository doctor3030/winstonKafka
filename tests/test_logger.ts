import {Logger} from "../winston_logger";
const path = require('path')

class thisClass {
    private _clsLogger = new Logger({
        module: path.basename(__filename),
        component: "thisClass",
        serviceID: "fskevhs8v7s4"
    });
    private _logger = this._clsLogger.getDefaultLogger();

    public doSomething () {
        this._logger.info('HELOOOOO!!!')
    }
}

const cls = new thisClass();
cls.doSomething();


// console.log(__filename);