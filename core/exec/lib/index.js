'use strict';

const path = require('path')
const childProcess = require("child_process")
const Package = require('@smiling_tests/cli-dev-package')
const log = require('@smiling_tests/cli-dev-log')

/** 命令映射列表*/
const COMMAND_SETTINGS = {
    // init: '@smiling_tests/cli-dev-init',
    init: '@imooc-cli/init'
}

//  缓存文件目录
const CATCH_DIR = 'dependencies'

async function exec() {
    let targetPath = process.env.CLI_TARGET_PATH;
    const homePath = process.env.CLI_HOME_PATH;
    let storeDir = '';
    let pkg;
    log.verbose('targetPath', targetPath)
    log.verbose('homePath', homePath)

    //  arguments 第二个(最后)的参数是 Command 对象
    //  Command.name() 获取 Comand name
    const cmdObj = arguments[arguments.length - 1]
    const cmdName = cmdObj.name()
    const packageName = COMMAND_SETTINGS[cmdName]
    const packageVersion = 'latest' //  指定最新版本

    if (!targetPath) {
        targetPath = path.resolve(homePath, CATCH_DIR)  //  生成缓存路径
        storeDir = path.resolve(targetPath, 'node_modules');
        log.verbose('targetPath', targetPath)
        log.verbose('storeDir', storeDir)
        pkg = new Package({
            targetPath,
            storeDir,
            name: packageName,
            version: packageVersion
        })

        if (await pkg.exists()) {
            log.verbose("更新安装依赖包")
            await pkg.update()
        } else {
            log.verbose("下载安装依赖包")
            await pkg.install()
        }
    } else {
        pkg = new Package({
            targetPath,
            name: packageName,
            version: packageVersion
        })
    }

    const rootFilePath = pkg.getRootFilePath()
    if (rootFilePath) {
        log.verbose('getRootFilePath', rootFilePath)
        try {
            // 当前进程调用
            // require(rootFilePath).call(null, Array.from(arguments))

            //  在 node 子进程中调用
            //  1. 处理参数
            const args = Array.from(arguments);
            const cmd = args[args.length - 1];
            const o = Object.create(null)
            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
                    o[key] = cmd[key]
                }
            })
            args[args.length - 1] = o
            //  2. 合成多进程执行 shell 脚本命令
            const code = `require('${rootFilePath}').call(null, ${JSON.stringify(args)})`
            //  3. 使用 child_process 的 spawn 生成一个子进程执行
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit'
            })
            child.on('error', (e) => {
                log.error(e.message)
            })
            child.on('exit', (e) => {
                log.verbose("命令执行成功:" + e)
                process.exit(e)
            })

        } catch (e) {
            log.error(e.message)
        }
    }
}

/** 兼容 windows 系统 spawn */
function spawn(command, args, options) {
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args

    return childProcess.spawn(cmd, cmdArgs, options || {})
}

module.exports = exec;
