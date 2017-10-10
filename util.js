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
        return price * config.prices[item]
      }
    }
  },
  createCategories (str) {
    console.log('start create category', str)
    let temp = str.split('>>')
    let results = []
    categoryConfig.forEach(item => {
      let tester = new RegExp(item.name, 'i')
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
  }
}
