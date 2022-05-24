'use strict';

const path = require('path')
const fs = require('fs')
const inquirer = require("inquirer")
const fse = require('fs-extra')
const semver = require('semver')
const userHome = require('user-home')
const Command = require('@smiling_tests/cli-dev-command')
const log = require('@smiling_tests/cli-dev-log')
const Package = require('@smiling_tests/cli-dev-package')
const { spinnerStart, sleep } = require('@smiling_tests/cli-dev-utils')
const getProjectTemplate = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    async exec() {
        try {
            //  1. 准备阶段
            await this.prepare()
            //  2. 下载模板
            await this.downloadTemplate()
            //  3. 安装模板
        } catch (e) {
            log.error(e.message)
        }
    }

    async prepare() {
        //  (0) 判断项目模板是否存在 -> 获取模板列表
        const templates = await getProjectTemplate()
        if (!templates || templates.length === 0) {
            throw new Error('当前项目模板不存在')
        }
        this.templates = templates;

        const localPath = process.cwd() //   使用 process.cwd() | path.resolve('.) 获取当前目录
        //  (1) 判断当前目录是否为空
        if (!this.isDirEmpty(localPath)) {
            let ifContinue = false;
            //  (2) 是否启动强制更新
            if (!this.force) {
                ifContinue = (await inquirer.prompt({
                    type: 'confirm',
                    name: 'ifContinue',
                    default: false,
                    message: "当前文件目录不为空, 是否继续创建项目?"
                }))['ifContinue'];
                //  如果第一次就不创建项目, 则不再执行后面逻辑
                if (!ifContinue) return
            }

            if (ifContinue || this.force) {
                //  二次确认清空文件
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    default: false,
                    message: '是否确认清空当前目录下的文件?'
                })
                if (confirmDelete) {
                    fse.emptyDirSync(localPath)  //  清空目录下的文件
                }
            }
        }
        //  返回用户操作反馈的项目基本信息
        return this.getProjectInfo()
    }

    /** 获取用户操作反馈的项目基本信息*/
    async getProjectInfo() {
        let projectInfo = {}
        //  (3) 选择创建项目或组件
        const { type } = await inquirer.prompt({
            type: 'list',
            name: "type",
            message: "请选择初始化类型",
            default: TYPE_PROJECT,
            choices: [{
                name: "项目",
                value: TYPE_PROJECT
            }, {
                name: "组件",
                value: TYPE_COMPONENT
            }]
        })
        log.verbose('type:', type)
        //  (4) 获取项目基本信息 (object)
        if (type === TYPE_PROJECT) {
            const project = await inquirer.prompt([{
                type: 'input',
                message: "请输入项目的名称",
                name: 'projectName',
                default: '',
                validate: function (v) {
                    //  输入首字符必须为英文字符, 尾字符必须是英文或数字, 字符仅允许输入 - 或 _
                    //  合法 a-b a_b aaa bbb a-b1-c1
                    //  不合法 a_1 a-1 a_ a-
                    const done = this.async()

                    setTimeout(function () {
                        if (!/^[a-zA-Z]+([-][a-zA-z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)) {
                            done("输入项目名称格式有误 (仅支持 a-b a_b aaa bbb a-b1-c1  a1 等)")
                            return;
                        }
                        done(null, true)
                    }, 300)
                },
                filter: function (v) {
                    return v
                }
            }, {
                type: 'input',
                name: 'projectVersion',
                message: "请输入项目版本号",
                default: '',
                validate: function (v) {
                    const done = this.async()
                    setTimeout(function () {
                        if (!!!semver.valid(v)) {
                            done('输入版本号不合法')
                            return
                        }
                        done(null, true)
                    }, 300)
                },
                filter: function (v) {
                    if (!!semver.valid(v)) {
                        return semver.valid(v)
                    } else {
                        return v
                    }
                }
            }, {
                type: 'list',
                name: 'projectTemplate',
                message: '请选择项目模板',
                choices: this.renderTemplateChoices()
            }])
            //  重新赋值项目信息
            projectInfo = {
                type,
                ...project
            }
        } else if (type === TYPE_COMPONENT) {

        }
        this.projectInfo = projectInfo;
        log.verbose('projectInfo', projectInfo)
        return projectInfo;
    }

    /** 下载模板功能*/
    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo
        const templateInfo = this.templates.find(template => template.npmName === projectTemplate)
        const { npmName: name, version } = templateInfo
        //  合成 package 数据, 下载/更新 模板
        const targetPath = path.resolve(userHome, '.cli-dev', 'template')
        const storeDir = path.resolve(targetPath, 'node_modules')
        const templateNpm = new Package({
            targetPath,
            storeDir,
            name,
            version
        })
        if (!await templateNpm.exists()) {
            const spinner = spinnerStart('正在下载模板...')
            await sleep()
            try {
                await templateNpm.install()
                log.success('下载模板成功')
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
            }
        } else {
            const spinner = spinnerStart('正在更新模板...')
            await sleep()
            try {
                await templateNpm.update()
                log.success('更新模板成功')
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
            }
        }
    }

    /** 判断当前目录是否为空*/
    isDirEmpty(localPath) {
        //  筛选除了 node_modules 和 .git 等文件
        let fileList = fs.readdirSync(localPath)
        fileList = fileList.filter(file => !file.startsWith('.') && ['node_modules'].indexOf(file) < 0)

        return !fileList || fileList.length <= 0
    }

    renderTemplateChoices() {
        return this.templates.map(template => ({
            name: template.name,
            value: template.npmName
        }))
    }
}

function init(argv) {
    //  全局属性 cmdObj.parent.xxx(cmdObj.parent.targetPath)
    //  通过环境变量获取 process.env.CLI_TARGET_PATH
    // console.log(projectName, cmdObj.force, process.env.CLI_TARGET_PATH)
    return new InitCommand(argv)
}

module.exports.InitCommand = InitCommand;
module.exports = init;
