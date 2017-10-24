const fs = require('fs')
const path = require('path')
const minify = require('html-minifier').minify
const _ = require('lodash')
const colorNames = _.invert(require('color-names'))
const prestan = require('./api')
const config = require('./config')
const colors = require('./colors.json')
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
  },

  createColor (name) {
    name = _.startCase(name)
    let hex = colorNames[name] || colorNames[_.capitalize(name.replace(/\s/, ''))]

    console.log(_.capitalize(name.replace(/\s/, '')))
    if (!hex) {
      return Promise.reject(new Error(`Cannot create color ${name}`))
    }
    const data = {
      prestashop: {
        product_option_value: {
          id_attribute_group: 3,
          color: hex,
          name: {
            language: {
              _: name,
              $: {
                id: 1
              }
            }
          }
        }
      }
    }
    return prestan.add('product_option_values', data).then(res => {
      const color = res.prestashop.product_option_value
      colors[name.toLowerCase()] = color.id
      this.updateColorsJSON(colors)
      return color
    })
  },

  updateColorsJSON (colors) {
    fs.writeFileSync('./colors.json', JSON.stringify(colors, null, 2))
  }
}
