'use strict';
const childProcess = require("child_process")

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

/** 兼容 windows 系统 spawn */
function exec(command, args, options) {
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args

    return childProcess.spawn(cmd, cmdArgs, options || {})
}

function execAsync(command, args, options) {
    return new Promise((resolve, reject) => {
        const p = exec(command, args, options)
        p.on('error', e => reject(e))
        p.on('exit', c => resolve(c))
    })
}

/** 睡眠*/
function sleep(timeout = 1000) {
    return new Promise(resolve => setTimeout(() => resolve(), timeout))
}

module.exports = {
    isObject,
    spinnerStart,
    sleep,
    exec,
    execAsync
};
