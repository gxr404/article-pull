import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

import * as progressBar from 'progress'
import getLogger from './log'
import config from './config'
import { shellArgsInit } from './args'
import * as randUserAgent from 'rand-user-agent'
import * as mime from 'mime-types'

import {
  createDir,
  changeSuffix,
  checkProtocol,
  replaceSpecialReg,
  readFile,
  changeFileName
} from './utils'

// log 初始化
const logger = getLogger()

/**
 * 获取img 列表
 * @param {*} data
 * @returns {string[]}
 */
const getImgList = (data: string): Array<string> => {
  let list = Array.from(data.match(config.mdImgReg) || [])
  list = list.map(itemUrl => {
    itemUrl = itemUrl.replace(config.mdImgReg, '$2')
    // 如果出现非http开头的图片 如 "./xx.png" 则跳过
    if (!(/^http.*/g.test(itemUrl))) return ''
    const itemUrlObj = new url.URL(itemUrl)
    itemUrl = url.format(itemUrlObj, {
      fragment: false,
      unicode: false,
      auth: false,
      search: false
    })
    return itemUrl
  }).filter(url => Boolean(url))
  // 去重
  const resSet = new Set(list)
  list = Array.from(resSet)
  return list
}

/**
 * 下载图片
 * @param {*} url
 * @param {*} imgDir
 */
const downloadImg = (url: string, imgDir: string): Promise<string> => {
  let fileName = path.basename(url)
  // 移除带有 1.jpg?xxx或 1.jpg#12的 fileName
  fileName = fileName.replace(/(\?.*)|(#.*)/g, '')
  fileName = changeFileName(fileName)
  if (config.suffix) fileName = changeSuffix(fileName, config.suffix)

  // 检查协议
  const lib = checkProtocol(url)
  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      headers: {
        "user-agent": randUserAgent("desktop", "chrome")
      }
    }, (res) => {

      // url是否带有文件后缀 没有则尝试从content-type获取
      const isExt = path.parse(fileName).ext
      const contentType = res.headers['content-type']
      if (!isExt) {
        const fileSuffix = mime.extension(contentType)
        if (fileSuffix) fileName = changeSuffix(fileName, fileSuffix)
      }

      // 检查是否重定向
      const isRedirect = [302, 301].indexOf(res.statusCode)
      if (~isRedirect) {
        if (!config.isIgnoreConsole) {
          logger.info(`${fileName} 重定向...`)
        }
        // 重定向则向 响应头的location 重新下载
        resolve(downloadImg(res.headers['location'], imgDir))
        return
      }

      const contentLength = parseInt(res.headers['content-length'], 10)
      const distPath = `${imgDir}/${fileName}`
      const out = fs.createWriteStream(distPath)
      const disableProgressBar = isNaN(contentLength)
      const bar = new progressBar(`downloading ${fileName} [:bar] :rate/bps :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: contentLength
      })

      res.on('data', (chunk) => {
          // 输入后的回调
        out.write(chunk, () => {
          if (!config.isIgnoreConsole && !disableProgressBar) {
            bar.tick(chunk.length)
          }
          // logger.error('file wirte error: ',e)
        })
      })
      res.on('end', () => {
        // logger.info(`${fileName} download OK`)
        resolve(distPath)
      })

    })
    req.on('error', e => {
      if (!config.isIgnoreConsole) {
        logger.error(`download ${url} error`)
        logger.error(e)
      }
      reject({
        error: e,
        url
      })
    })
    req.end()
  })
}

/**
 * 创建新的markdown并更改img Url
 * @param {string} data 处理的markdown数据
 * @param {array} imgList 图片列表
 * @return {string} 更改markdown中远程图片链接为本地链接
 */
const changeMarkdown = (data: string, imgList: Array<string>): string => {
  // 创建新的img url list
  const newImgList = imgList.map(src => {
    if (config.suffix) src = changeSuffix(src, config.suffix)

    const fileName = path.basename(src)
    return `${config.imgDir}/${fileName}`
  })

  let newData = data
  const list = data.match(config.mdImgReg) || []
  // 替换其中url文本
  list.forEach((src, index) => {
    // console.log(src)
    if (/.*\]\(http.*/g.test(src)) {
      // 动态reg
      const imgReg = new RegExp(replaceSpecialReg(src), 'gm')
      newData = newData.replace(imgReg, '![$1]('+newImgList[index]+')')
    }
  })
  return newData

}

/**
 * 初始化
 */
export const bin = async (): Promise<void> => {
  // shell参数初始化 并合并config
  shellArgsInit()

  // 读取文件
  const data = await readFile(config.path)
  if (!data) {
    logger.error('o(╥﹏╥)o 读取失败')
    return
  }
  // 更改md文件
  const newData = await run(data, config)

  const fileName = path.basename(config.path)
  const out = fs.createWriteStream(path.resolve(config.dist, fileName))
  // 写入文件
  out.write(newData)

  setTimeout(() => {
    logger.info('success')
  }, 100)
}


type TConfig = Partial<typeof config>
/**
 * @param data
 */
export const run = async (data: string, customConfig: TConfig): Promise<string> => {
  Object.assign(config, customConfig)
  // 过滤 config 中 dist目录和 imgDir目录的特殊字符 替换_
  const dirNameReg = /[:*?"<>|\n\r]/g
  config.dist = config.dist.replace(dirNameReg, '_').replace(/\s/g, '')
  config.imgDir = config.imgDir.replace(dirNameReg, '_').replace(/\s/g, '')
  // 获取文件内容中的图片列表
  const imgList = getImgList(data)
  // 无图片无需处理直接返回
  if (!imgList.length) { return data }
  const imgDirPath = path.resolve(config.dist, config.imgDir)
  // 创建目录 img 目录
  await createDir(imgDirPath)
  const imgListPromise = imgList.map(src => {
    return downloadImg(src, imgDirPath)
  })
  const resList = await Promise.all(imgListPromise)
  // 更改md文件
  const newData = changeMarkdown(data, resList)
  return newData
}
