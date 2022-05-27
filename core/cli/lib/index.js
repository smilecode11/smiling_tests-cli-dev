'use strict'

module.exports = core

const path = require('path')
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExist = require('path-exists').sync
const commander = require('commander')
const pkg = require("../package.json")
const constant = require('./const')
const log = require('@smiling_tests/cli-dev-log')
const exec = require('@smiling_tests/cli-dev-exec')

const program = new commander.Command()

async function core() {
    try {
        //  准备阶段
        await prepare()
        // 命令注册
        registerCommand()
    } catch (e) {
        log.error(e.message)
        if (program.debug) {
            console.log(e)
        }
    }
}

/** 命令注册*/
function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>', "是否指定本地调试文件路径", '');


    program
        .command('init [projectName]')
        .option('-f, --force', '是否强制初始化项目')
        .action(exec);


    //  debug 参数监听
    program.on('option:debug', function () {
        if (program.debug) {
            process.env.CLI_LOG_LEVEL = 'verbose'
        } else {
            process.env.CLI_LOG_LEVEL = 'info'
        }
        log.level = process.env.CLI_LOG_LEVEL
    });

    //  targetPath 参数监听, 通过环境变量进行存储
    program.on('option:targetPath', function () {
        process.env.CLI_TARGET_PATH = program.targetPath;
    })

    //  未知命令监听
    program.on('command:*', function (cmdObj) {
        console.log(colors.red(`未知的命令:${cmdObj[0]}`))
        const availableCommands = program.commands.map(cmd => cmd.name())
        if (availableCommands.length > 0) {
            console.log(colors.red(`可用命令:${availableCommands.join(',')}`))
        }
    });

    program.parse(process.argv);

    //  没有实际执行命令时打印帮助文档
    if (program.args && program.args.length < 1) {
        console.log()
        program.outputHelp()
    }
}

/** 准备阶段*/
async function prepare() {
    checkPkgVersion()
    checkRoot()
    checkUserHome()
    checkEnv()
    await checkGlobalUpdate()
}

/** 检查版本号*/
function checkPkgVersion() {
    log.notice('cli version', pkg.version)
}

/** 检查 root 启动*/
function checkRoot() {
    const rootCheck = require('root-check')
    rootCheck()
}

/** 检查用户主目录*/
function checkUserHome() {
    if (!userHome || !pathExist(userHome)) {
        throw new Error(colors.red('当前登录用户主目录不存在!'))
    }
}

/** 检查环境变量*/
function checkEnv() {
    const dotenv = require('dotenv')
    const dotenvPath = path.resolve(userHome, '.env')
    if (pathExist(dotenvPath)) {
        dotenv.config({
            path: dotenvPath
        })
    }
    createDefaultConfig()
}

/** 生成默认的环境变量*/
function createDefaultConfig() {
    const cliConifg = {
        home: userHome
    }
    if (process.env.CLI_HOME_PATH) {
        cliConifg['cliHome'] = path.join(userHome, process.env.CLI_HOME_PATH)
    } else {
        cliConifg['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
    }
    //  环境变量中写入 CLI_HOME_PATH(脚手架路径)
    process.env.CLI_HOME_PATH = cliConifg.cliHome
    return cliConifg
}

/** 检查全局更新*/
async function checkGlobalUpdate() {
    //  1.获取当前版本号和模块名
    const currentVersion = pkg.version
    const npmName = pkg.name
    //  2.调用 npm API, 获取所有版本号
    const { getNpmSemverVersion } = require('@smiling_tests/cli-dev-get-npm-info')
    const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
    //  3.提取所有版本号, 对比哪些版本是大于当前版本号的
    //  4.获取最新的版本号, 提示用户更新到该版本
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
        log.warn(colors.yellow(`请手动更新 ${npmName}, 当前版本是 ${currentVersion}, 最新的版本是 ${lastVersion}. 更新命令: npm install -g ${npmName}`))
    }
}
