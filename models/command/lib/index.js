'use strict';

const semver = require('semver')
const colors = require('colors')
const log = require('@smiling_tests/cli-dev-log')
const LOWEST_NODE_VERSION = '12.0.0'

class Command {
    constructor(argv) {
        if (!argv) throw new Error('参数不能为空')
        if (!Array.isArray(argv)) throw new Error("参数必须为数组")
        if (argv.length < 1) throw new Error("参数列表为空")

        this._argv = argv;

        let runner = new Promise((resolve, reject) => {
            let chain = Promise.resolve()
            chain = chain.then(() => this.checkNodeVersion())
            chain = chain.then(() => this.initArgv())
            chain = chain.then(() => this.init())
            chain = chain.then(() => this.exec())
            //  侦听 promise 返回错误
            chain.catch(error => {
                log.error(error.message)
            })
            resolve()
        })
    }


    /** 检查 node 版本*/
    checkNodeVersion() {
        //  获取当前 node 版本号
        const currentVersion = process.version
        //  比对最低版本号
        const lowestVersion = LOWEST_NODE_VERSION
        if (semver.lte(currentVersion, lowestVersion)) {
            throw new Error(colors.red(`需要安装 v${lowestVersion} 以上版本的 Node.js, 当前版本 ${currentVersion}!`))
        }
    }

    /** 初始化参数*/
    initArgv() {
        this._cmd = this._argv[this._argv.length - 1]
        this._argv = this._argv.slice(0, this._argv.length - 1)
    }

    init() {
        throw new Error('子类必须实现 init')
    }

    exec() {
        throw new Error("子类必须实现 exec")
    }
}

module.exports = Command