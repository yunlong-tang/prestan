const fs = require('fs')
const path = require('path')
const async = require('async')
const product = require('./product')
const dataDir = './data'

let dirs = fs.readdirSync(dataDir)
dirs = dirs.filter((dir) => {
  return !dir.startsWith('.') && !dir.endsWith('.zip')
})

async.eachSeries(dirs, (dir, callback) => {
  console.log('start upload', dir)
  let file = path.resolve(dataDir, dir)
  product.parse(file).then(() => {
    console.log('upload product successful', file, '\n')
    callback()
  }).catch(err => {
    console.error('upload product failed', file, err.message, '\n')
    callback()
  })
}, err => {
  console.error('done', err)
})
