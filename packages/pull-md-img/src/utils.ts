
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import * as http from 'http'
import * as https from 'https'

import getLogger from './log'
const logger = getLogger()

/**
 * 更改后缀
 * @param {string} pathSrc 路径
 * @param {string} suffix 后缀
 */
const changeSuffix = (pathSrc: string, suffix: string): string => {
  const pathObj = path.parse(pathSrc)
  return `${pathObj.dir !== '/' ? pathObj.dir+'/' : '/'}${pathObj.name}.${suffix}`
}

/**
 * 创建目录
 * @param {*} imgDir
 * @returns {Promise}
 */
const createDir = (imgDir:string): Promise<any> => {
  return new Promise((resolve, reject) => {
    mkDirs(imgDir, (e) => {
      if (e) reject(e)
      resolve(void 0)
    })
  }).catch((e) => {
    logger.error('mkdir error', e)
  })
}

/**
 * @description 为了兼容低版本ndoe 使其可以多层创建文件夹
 * @param {*} dirname
 * @param {*} callback
 */
const mkDirs = (dirname: string, callback: fs.NoParamCallback) => {
  fs.exists(dirname, function (exists) {
      if (exists) {
        callback(null)
      } else {
        mkDirs(path.dirname(dirname), () => {
          fs.mkdir(dirname, callback)
        })
      }
  })
}

/**
 * 正则替换特殊符号 并 多加![]多加()
 * @param {*} str
 * @returns {string}
 */
const replaceSpecialReg = (str: string): string => {
  // 替换特殊符号
  // let res = str.replace('[','\\[')
  //             .replace(']','\\]')
  //             .replace('(','\\(')
  //             .replace(')','\\)')
  //             .replace('?', '\\?')
  const ESCAPE_RE = /[-.*+?^${}()|[\]/\\]/g
  let res = str.replace(ESCAPE_RE, '\\$&')
  // 多加![]多加()
  res = res.replace('!\\[', '!\\[(').replace('\\]', ')\\]')
  return res
}

/**
 * 检查协议
 * @param {string} inputUrl
 * @return {*} lib
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const checkProtocol = (inputUrl: string) => {
  const urlObj = url.parse(inputUrl)
  const protocol = urlObj.protocol
  return protocol === 'http:' ? http : https
}

/**
 * 读取文件
 * 封装 fs.readFile
 * @param {*} filePath 目标临近
 * @return {Promise}
 */
const readFile = (filePath: string): Promise<any> => {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  }).catch((e) => {
    logger.error(e)
  })
}

/**
 * 获取文件file state
 * 封装 fs.stat
 * @param {string} path
 * @return {Promise}
 */
const getFileSate = (path: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      if (err) {
        reject(err)
      }
      resolve(stat)
    })
  }).catch(e => {
    logger.error(e)
  })
}

/**
 * 给文件名加时间戳
 * @param {*} pathSrc
 */
const changeFileName = (pathSrc: string): string => {
  const pathObj = path.parse(pathSrc)
  const fileName = (pathObj.name || '').replace(/~|:|\?|\*|\||\\|\/|\.|>|</g, '_')
  const randomStr = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  return `${pathObj.dir}/${fileName}-${randomStr}${pathObj.ext}`
}

export {
  changeSuffix,
  createDir,
  replaceSpecialReg,
  checkProtocol,
  readFile,
  getFileSate,
  changeFileName
}