'use strict';

const path = require('path')
const fs = require('fs')
const inquirer = require("inquirer")
const fse = require('fs-extra')
const semver = require('semver')
const userHome = require('user-home')
const kebabCase = require('kebab-case')
const ejs = require('ejs')
const glob = require('glob')
const Command = require('@smiling_tests/cli-dev-command')
const log = require('@smiling_tests/cli-dev-log')
const Package = require('@smiling_tests/cli-dev-package')
const { spinnerStart, sleep, execAsync } = require('@smiling_tests/cli-dev-utils')
const getProjectTemplate = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'
const WHITE_COMMAND = ['npm', 'cnpm', 'yarn']

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
            await this.installTemplate()
        } catch (e) {
            log.error(e.message)
            if (process.env.CLI_LOG_LEVEL === 'verbose') {
                console.log(e)
            }
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
        function isValidateName(v) {
            return /^[a-zA-Z]+([-][a-zA-z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
        }

        let projectInfo = {}
        let isProjectValidate = false;
        if (isValidateName(this.projectName)) {
            isProjectValidate = true
            projectInfo.projectName = this.projectName
        }
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
        let title = projectInfo.type === TYPE_PROJECT ? '项目' : '组件'
        const projectPromptArr = []
        const projectNamePrompt = {
            type: 'input',
            message: `请输入${title}的名称`,
            name: 'projectName',
            default: '',
            validate: function (v) {
                //  输入首字符必须为英文字符, 尾字符必须是英文或数字, 字符仅允许输入 - 或 _
                //  合法 a-b a_b aaa bbb a-b1-c1
                //  不合法 a_1 a-1 a_ a-
                const done = this.async()

                setTimeout(function () {
                    if (!isValidateName(v)) {
                        done(`输入${title}名称格式有误`)
                        return;
                    }
                    done(null, true)
                }, 0)
            },
            filter: function (v) {
                return v
            }
        }
        if (!isProjectValidate) projectPromptArr.push(projectNamePrompt)
        projectPromptArr.push({
            type: 'input',
            name: 'projectVersion',
            message: `请输入${title}版本号`,
            default: '',
            validate: function (v) {
                const done = this.async()
                setTimeout(function () {
                    if (!!!semver.valid(v)) {
                        done('输入版本号不合法')
                        return
                    }
                    done(null, true)
                }, 0)
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
            message: `请选择${title}模板`,
            choices: this.renderTemplateChoices(type)
        })
        if (type === TYPE_PROJECT) {
            const project = await inquirer.prompt(projectPromptArr)
            //  重新赋值项目信息
            projectInfo = {
                ...project,
                ...projectInfo
            }
        } else if (type === TYPE_COMPONENT) {
            const descriptionPrompt = {
                type: 'input',
                name: 'componentDescription',
                message: "请输入组件描述信息",
                validate: function (v) {
                    const done = this.async()
                    setTimeout(function () {
                        if (!v) {
                            done('请输入组件描述信息')
                            return
                        }
                        done(null, true)
                    }, 300)
                }
            }
            projectPromptArr.push(descriptionPrompt)
            const component = await inquirer.prompt(projectPromptArr)
            //  重新赋值组件信息
            projectInfo = {
                ...component,
                ...projectInfo
            }
        }
        //  项目名称格式化: 生成 classname 
        //  驼峰转 -> - 连接 AbcD -> abc-d 使用 kebabCase
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName;
            projectInfo.className = kebabCase(projectInfo.projectName).replace(/^-/, "")
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription
        }
        this.projectInfo = projectInfo;
        log.verbose('projectInfo', projectInfo)
        return projectInfo;
    }

    /** 下载模板功能*/
    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo
        const templateInfo = this.templates.find(template => template.npmName === projectTemplate)
        this.templateInfo = templateInfo;
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
                await templateNpm.install(true)
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('下载模板成功')
                    this.templateNpm = templateNpm;
                }
            }
        } else {
            const spinner = spinnerStart('正在更新模板...')
            await sleep()
            try {
                await templateNpm.update(true)
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('更新模板成功')
                    this.templateNpm = templateNpm;
                }
            }
        }
    }

    /** 安装模板功能*/
    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) this.templateInfo.type = TEMPLATE_TYPE_NORMAL; //  无设置, 默认走标准
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                await this.installNormalTemplate()  //  标准安装
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                await this.installCustomTemplate()  //  自定义安装
            } else {
                throw new Error('项目模板类型无法识别')
            }
        } else {
            throw new Error('项目模板信息不存在')
        }
    }

    /** 标准安装*/
    async installNormalTemplate() {
        //  (1) 拷贝模板代码到当前目录
        let spinner = spinnerStart('正在安装模板...')
        await sleep()
        try {
            const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
            const targetPath = process.cwd()
            fse.ensureDirSync(templatePath) //  确保模板目录存在, 不存在创建
            fse.ensureDirSync(targetPath)   //  确保当前目录存在
            fse.copySync(templatePath, targetPath)
        } catch (e) {
            throw e
        } finally {
            spinner.stop(true)
            log.success('模板安装成功')
        }

        //  (2) ejs 模板渲染
        const tempIgnore = this.templateInfo.ignore;
        const ignore = ['node_modules/**', ...tempIgnore]
        await this.ejsRender({ ignore })

        //  (3) 模板依赖安装 & 启动命令
        const { installCommand, startCommand } = this.templateInfo;

        await this.execCommand(installCommand, '依赖安装失败')
        await this.execCommand(startCommand, '项目启动失败')
    }

    /** ejs模板渲染替换模板内容*/
    async ejsRender(options) {
        return new Promise((resolve, reject) => {
            glob("**", {
                cwd: process.cwd(),
                ignore: options.ignore || '', //  忽略文件
                nodir: true //  忽略文件目录
            }, (err, files) => {
                if (err) return reject(err)
                Promise.all(files.map(file => {
                    const filePath = path.join(process.cwd(), file)
                    return new Promise((resolve1, reject1) => {
                        ejs.renderFile(filePath, this.projectInfo, {
                        }, (err, result) => {
                            if (err) return reject1(err)
                            // 重新写入
                            fse.writeFileSync(filePath, result)
                            resolve1(result)
                        })
                    })
                })).then(() => {
                    resolve()
                }).catch(err => {
                    reject(err)
                })
            })
        })
    }

    async execCommand(command, message) {
        log.verbose('执行操作命令:', command)
        const cmdArr = command.split(' ')
        const cmd = this.checkCommand(cmdArr[0])
        const args = cmdArr.slice(1)

        if (!cmd) {
            throw new Error('命令不存在')
        }

        const execRet = await execAsync(cmd, args, {
            stdio: 'inherit',
            cwd: process.cwd()
        })

        if (execRet !== 0) {
            throw new Error(message)
        }
    }

    //  检查命令是否合法
    checkCommand(cmd) {
        return WHITE_COMMAND.indexOf(cmd) !== -1 ? cmd : null
    }

    /** 自定义安装*/
    async installCustomTemplate() {
        //  查询自定义模板入口文件
        if (await this.templateNpm.exists()) {
            const rootFile = this.templateNpm.getRootFilePath()
            if (fs.existsSync(rootFile)) {
                log.notice('开始执行自定义模板')
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
                const options = {
                    templateNpm: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd()
                }
                const code = `require('${rootFile}')(${JSON.stringify(options)})`
                execAsync('node', ['-e', code], {
                    stdio: 'inherit',
                    cwd: process.cwd()
                })
                log.notice('自定义模板安装成功')
            } else {
                throw new Error('自定义模板入口文件不存在')
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

    renderTemplateChoices(type) {
        return this.templates
            .filter(temp => temp.tag.includes(type))
            .map(template => ({
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
