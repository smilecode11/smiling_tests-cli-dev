'use strict';

const axios = require('axios')
const semver = require('semver')
const urlJoin = require('url-join')

/** 获取 npm 包信息*/
function getNpmInfo(npmName, registry) {
    if (!npmName) return null
    const registryUrl = registry || getDefaultRegistry()
    const npmInfoUrl = urlJoin(registryUrl, npmName)

    return axios.get(npmInfoUrl).then(response => {
        if (response.status === 200) {
            return response.data
        } else {
            return null
        }
    }).catch(err => {
        return Promise.reject(err)
    })
}

/** 获取npm包的所有版本列表*/
async function getNpmVersions(npmName, registry) {
    try {
        const data = await getNpmInfo(npmName, registry)
        if (data) {
            return Object.keys(data.versions)
        } else {
            return []
        }
    } catch (error) {
        return []
    }

}

/** 获取满足条件的版本号*/
function getSemverVersions(baseVersion, versions) {
    return versions.filter(version =>
        semver.satisfies(version, `^${baseVersion}`)    //  大于等于 baseVersion
    ).sort((a, b) => semver.gt(b, a))
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
    const versions = await getNpmVersions(npmName, registry)
    const newVersions = getSemverVersions(baseVersion, versions)
    if (newVersions && newVersions.length > 0) {
        return newVersions[0]
    }
    return null
}

/** 获取默认的 registry 源*/
function getDefaultRegistry(isOriginal = false) {
    return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}

/** 获取 npm 包最新版本*/
async function getNpmLatestVersion(npmName, registry) {
    const versions = await getNpmVersions(npmName, registry)
    if (versions && versions.length) {
        return (versions.sort((a, b) => semver.gt(b, a)))[versions.length - 1]
    }
    return null
}

module.exports = {
    getNpmInfo,
    getNpmVersions,
    getNpmSemverVersion,
    getDefaultRegistry,
    getNpmLatestVersion
};
