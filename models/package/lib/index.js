'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;
const fse = require('fs-extra')
const { isObject } = require("@smiling_tests/cli-dev-utils");
const formatPath = require('@smiling_tests/cli-dev-format-path')
const { getDefaultRegistry, getNpmLatestVersion } = require('@smiling_tests/cli-dev-get-npm-info')

class Package {
    constructor(options) {
        if (!options) throw new Error("Package 类的 options 参数不能为空")
        if (!isObject(options)) throw new Error("Package 类的 options 参数必须为对象")

        //  package 目标路径
        this.targetPath = options.targetPath;
        //  package 缓存路径
        this.storeDir = options.storeDir;
        //  package name
        this.packageName = options.name;
        //  package version
        this.packageVersion = options.version;
        //  package 缓存目录前缀
        this.cacheFilePathPrefix = this.packageName.replace('/', '_');
    }

    //  前缀操作: 判断是否是需要更新等
    async prepare() {
        //  生成缓存目录
        if (this.storeDir && !pathExists(this.storeDir)) {
            fse.mkdirpSync(this.storeDir)
        }
        //  将 latest 转成实际地址
        if (this.packageVersion === 'latest') {
            this.packageVersion = await getNpmLatestVersion(this.packageName)
        }
    }

    get cacheFilePath() {
        //  生成缓存路径, 下载安装到 node_modules 的实际文件路径 (_@imooc-cli_init@1.0.1@@imooc-cli)
        //  实际包名存储包名  @imooc-cli/init
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
    }

    //  生成指定版本npm宝缓存文件路径
    getSpecificCacheFilePath(packageVersion) {
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
    }

    //  判断 package 是否存在
    async exists() {
        //  1.判断当前是否处于缓存模式还是直接使用 targetPath
        if (this.storeDir) {
            await this.prepare()
            return pathExists(this.cacheFilePath)
        } else {
            return pathExists(this.targetPath)
        }
    }

    //  安装 package
    async install() {
        await this.prepare()

        await npminstall({
            root: this.targetPath,
            storeDir: this.storeDir,
            registry: getDefaultRegistry(),
            pkgs: [{
                name: this.packageName,
                version: this.packageVersion
            }]
        })
    }

    //  更新 package
    async update() {
        await this.prepare()
        //  获取最新版本号
        const latestPackageVersion = await getNpmLatestVersion(this.packageVersion)
        //  查询最新版本号对应缓存文件路径是否存在
        const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
        //  如果不存在, 执行安装最新版本
        if (!latestFilePath) {
            await npminstall({
                root: this.targetPath,
                storeDir: this.storeDir,
                registry: getDefaultRegistry(),
                pkgs: [{
                    name: this.packageName,
                    version: latestPackageVersion
                }]
            })
            //  安装完成, 更新最新版本
            this.packageVersion = latestPackageVersion
        }
    }

    //  获取入口文件路径
    getRootFilePath() {
        
        function _getRootFile(targetPath) {
            //  1. 获取 package.json 所在目录 - pkg-dir
            const dir = pkgDir(targetPath)
            if (dir) {
                //  2. 读取 package.json - require()
                const pkgFile = require(path.resolve(dir, 'package.json'))
                //  3. 读取 main/lib - path
                if (pkgFile && pkgFile.main) {
                    //  4. 路径兼容(mocOS/windows)
                    return formatPath(path.resolve(dir, pkgFile.main))
                }
            }
            return null
        }

        if (this.storeDir) {
            return _getRootFile(this.cacheFilePath)
        } else {
            return _getRootFile(this.targetPath)
        }
    }
}

module.exports = Package;

