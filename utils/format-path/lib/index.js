'use strict';

const path = require('path')

//  处理路径方法 ->  \ -> /
function formatPath(p) {
    if (p && typeof p === 'string') {
        const sep = path.sep;   //  分隔符
        if (sep === '/') {
            return p
        } else {
            return p.replace(/\\/g, '/')
        }
    }

    return p
}

module.exports = formatPath;