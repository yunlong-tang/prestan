const fs = require('fs')
const path = require('path')
const minify = require('html-minifier').minify
const config = require('./config')
const categoryConfig = require('./category.js')

module.exports = {
  adjustPrice (price) {
    price = parseInt(price)
    const conditions = Object.keys(config.prices)
    for (var i = 0; i < conditions.length; i++) {
      const item = conditions[i]
      const temp = `${price} ${item}`
      if (eval(temp)) {
        let adjustedPrice = price * config.prices[item]
        return adjustedPrice.toFixed(2)
      }
    }
  },
  createCategories (str) {
    let temp = str.trim().split('>>')
    let results = []
    categoryConfig.forEach(item => {
      let tester = new RegExp('^' + item.name, 'i')
      if (tester.test(temp[0])) {
        results.push({ id: item.id })
        item.sub.forEach(subItem => {
          let tester = new RegExp(subItem.name, 'i')
          if (tester.test(temp[1])) {
            results.push({ id: subItem.id })
            if (subItem.sub && subItem.sub.length) {
              subItem.sub.forEach(subItem => {
                let tester = new RegExp(subItem.name, 'i')
                if (tester.test(temp[2])) {
                  results.push({ id: subItem.id })
                }
              })
            }
          }
        })
      }
    })
    return results
  },

  minify (str) {
    return minify(str, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeEmptyAttributes: true,
      removeAttributeQuotes: true
    })
  },

  getDesc (dirPath) {
    let results = fs.readdirSync(dirPath)
    for (let i = 0; i < results.length; i++) {
      let item = results[i]
      let tempPath = path.join(dirPath, item)
      let stat = fs.statSync(tempPath)
      if (stat.isDirectory()) {
        let files = fs.readdirSync(tempPath)
        let descFile = files.find(f => /_desc\.html/.test(f))
        if (descFile) {
          let desc = fs.readFileSync(path.join(tempPath, descFile), { encoding: 'utf8' })
          desc = this.minify(desc)
          return desc
        }
      }
    }
    return ''
  }
}
