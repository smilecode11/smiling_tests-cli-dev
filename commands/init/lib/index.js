'use strict';

const Command = require('@smiling_tests/cli-dev-command')
const log = require('@smiling_tests/cli-dev-log')


class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force; 
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    exec() {

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
