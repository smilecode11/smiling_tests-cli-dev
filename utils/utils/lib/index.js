'use strict';

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]'
}

/** 终端 loading -> Spinner 开始*/
function spinnerStart(message = 'loading..', spinnerString = '|/-\\') {
    const Spinner = require('cli-spinner').Spinner

    const spinner = new Spinner(message + ' %s');
    spinner.setSpinnerString(spinnerString)
    spinner.start()
    
    return spinner
}

/** 睡眠*/
function sleep(timeout = 1000) {
    return new Promise(resolve => setTimeout(() => resolve(), timeout))
}


module.exports = {
    isObject,
    spinnerStart,
    sleep
};
