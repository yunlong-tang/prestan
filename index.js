const fs = require('fs')
const path = require('path')
const async = require('async')
const product = require('./product')
const dataDir = './data3'

const logger = require('./logger').getLogger()

let dirs = fs.readdirSync(dataDir)
dirs = dirs.filter((dir) => {
  return !dir.startsWith('.') && !dir.endsWith('.zip')
})

async.eachSeries(dirs, (dir, callback) => {
  logger.info('start upload', dir)
  let file = path.resolve(dataDir, dir)
  product.parse(file).then(() => {
    logger.info('upload product successful', file)
    callback()
  }).catch(err => {
    logger.error('upload product failed', file, err.message)
    callback()
  })
}, err => {
  console.error('done', err)
})
