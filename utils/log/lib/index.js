'use strict';

const log = require('npmlog')

//  给 log 添加自定义错误类型
log.addLevel('success', 2000, { fg: 'green', bold: true })

//  修改 log level, 当 log 的 level 低于当前(默认是 info 2000) 时, 执行 log.verbose(1000) 错误不会被输出
//  所以我们可以通过修改 level 等级, 来输出调试日志 log.verbose('调试日志', '调试')
//  通过环境变量来实现 log.level 的变更
log.level = process.env.CLI_LOG_LEVEL ? process.env.CLI_LOG_LEVEL : 'info'

//  修改 log 前缀
log.heading = "smiling."

//  导出 log
module.exports = log;
