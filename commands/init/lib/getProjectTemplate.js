const request = require("@smiling_tests/cli-dev-request")

/** 获取模板列表*/
module.exports = function () {
    return request({
        url: '/project/template'
    })
}