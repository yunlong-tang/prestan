const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const request = require('request')
const xlsx2json = require('xlsx2json')
const async = require('async')

const prestan = require('./api')
const config = require('./config')
const colors = require('./colors.json')
const util = require('./util')
const logger = require('./logger').getLogger()

function extractImages (products) {
  const images = []
  const imagesByColor = {}
  products
    .map(prod => {
      imagesByColor[prod.color] = imagesByColor[prod.color] || []
      if (prod.images.length > imagesByColor[prod.color]) {
        imagesByColor[prod.color] = prod.images
      }
      return prod
    })
    .forEach(prod => {
      // replace old image arrar with new images. so that they can be used when creating combination
      prod.images = imagesByColor[prod.color].slice(0, 5)

      // push to final image array
      let count = 5
      for (let i = 0; i < prod.images.length; i++) {
        let img = prod.images[i]
        if (images.indexOf(img) === -1) {
          if (count > 0) {
            images.push(img)
            count--
          } else {
            console.log('break')
            break
          }
        }
      }
    })
  return images
}

function uploadImage (productId, images) {
  logger.info('start to upload images', images.length)
  const cover = images.shift()
  const temp = []
  return prestan
    .upload(`images/products/${productId}`, {
      image: request(cover)
    })
    .then(res => {
      temp.push({
        id: res.prestashop.image.id,
        img: cover
      })
      const all = images.map(img => {
        return prestan
          .upload(`images/products/${productId}`, {
            image: request(img)
          })
          .then(res => {
            return temp.push({
              id: res.prestashop.image.id,
              img: img
            })
          })
          .catch(err => {
            logger.error('upload image error:', err)
            throw err
          })
      })
      return Promise.all(all).then(() => {
        return temp
      })
    })
}

function validateColorAndSize (products) {
  return new Promise((resolve, reject) => {
    async.eachSeries(products, (product, cb) => {
      // find size id
      let sizeId = config.size[product.size]
      if (sizeId) {
        product.sizeId = sizeId
      } else {
        if (product.size.indexOf('ONE SIZE') !== -1) {
          product.sizeId = config.size['ONE SIZE']
        } else {
          logger.error('cannot find size for:', product)
          return cb(new Error(`Canot find size ${product.size}`))
        }
      }

      // find exact color id
      let colorId = colors[product.color] || false
      if (colorId) {
        product.colorId = colorId
        return cb()
      }
      // find similar color id
      let colorName = Object.keys(colors).find(name => new RegExp(name, 'i').test(product.color))
      colorId = colors[colorName] || false
      if (colorId) {
        product.colorId = colorId
        return cb()
      }
      // find text color id
      let textColor = Object.keys(config.textColor).find(name => new RegExp(name, 'i').test(product.color))
      colorId = config.textColor[textColor] || false
      if (colorId) {
        product.colorId = colorId
        return cb()
      }

      if (!colorId) {
        logger.error(`Cannot find color ${product.color}, try to create it.`)
        util.createColor(product.color).then(res => {
          product.colorId = res.id
          cb()
        }).catch(err => {
          cb(err)
        })
      }
    }, err => {
      if (err) {
        logger.error('validate color error', err)
        return reject(err)
      }
      return resolve(products)
    })
  })
}

function createProduct (products, descriptions, defaultSKU) {
  let data = _.pick(products[0], ['name', 'price', 'weight'])
  logger.info('start create category', products[0].categories)
  let categories = util.createCategories(products[0].categories) || []
  data = _.assign(data, {
    available_for_order: 1,
    id_category_default: _.get(categories, '1.id') || _.get(categories, '0.id') || 2,
    active: 1,
    state: 1,
    show_price: 1,
    reference: defaultSKU,
    associations: {
      categories: {
        category: [{ id: 2 }].concat(categories)
      }
    },
    description: {
      language: {
        _: descriptions.join('<br />'),
        $: {
          id: 1
        }
      }
    },
    name: {
      language: {
        _: data.name,
        $: {
          id: 1
        }
      }
    },
    meta_title: {
      language: {
        _: data.name,
        $: {
          id: 1
        }
      }
    },
    meta_keywords: {
      language: {
        _: data.name,
        $: {
          id: 1
        }
      }
    },
    meta_description: {
      language: {
        _: data.name,
        $: {
          id: 1
        }
      }
    }
  })

  return prestan
    .add('products', {
      prestashop: {
        product: data
      }
    })
    .then(res => {
      const productId = res.prestashop.product.id
      logger.info('create product success', productId)
      const images = extractImages(products)
      return uploadImage(productId, images).then(results => {
        // create image ids in product.
        products.forEach(product => {
          product.id = productId
          product.imageIds = []
          product.images.forEach(img => {
            const obj = results.find(item => item.img === img)
            obj.id && product.imageIds.push({ id: obj.id })
          })
        })

        return products
      })
    })
    .catch(err => {
      logger.error('create product error', err, data)
      throw err
    })
}

function createCombinations (products) {
  const productId = products[0].id
  const all = products
    .filter(product => {
      // find size id
      let sizeId = config.size[product.size.toUpperCase()]
      if (sizeId) {
        product.sizeId = sizeId
      } else {
        if (product.size.toLowerCase().indexOf('one size') !== -1) {
          product.sizeId = config.size['ONE SIZE']
        } else {
          logger.error('cannot find size for:', product)
          return false
        }
      }

      // find exact color id
      let colorId = colors[product.color] || false
      if (colorId) {
        product.colorId = colorId
        return true
      }
      // find similar color id
      let colorName = Object.keys(colors).find(name => new RegExp(name, 'i').test(product.color))
      colorId = colors[colorName] || false
      if (colorId) {
        product.colorId = colorId
        return true
      }
      // find text color id
      let textColor = Object.keys(config.textColor).find(name => new RegExp(name, 'i').test(product.color))
      colorId = config.textColor[textColor] || false
      if (colorId) {
        product.colorId = colorId
        return true
      }

      if (!colorId) {
        logger.error('cannot find color for:', product)
        return false
      }
      return true
    })
    .map((product, index) => {
      let product_option_value = []
      product_option_value.push({ id: product.sizeId })
      product_option_value.push({ id: product.colorId })

      let data = {
        id_product: product.id,
        quantity: product.quantity,
        reference: product.sku,
        minimal_quantity: '1',
        default_on: index === 0 ? '1' : '0', // set first product as default one
        associations: {
          product_option_values: {
            product_option_value: product_option_value
          },
          images: {
            image: product.imageIds
          }
        }
      }
      return prestan
        .add('combinations', {
          prestashop: { combination: data }
        })
        .then(res => {
          product.combinationId = _.get(res, 'prestashop.combination.id')
          return product
        })
    })
  return Promise.all(all).then(results => {
    return prestan.get('products', { id: productId }).then(product => {
      const stocks = _.get(product, 'prestashop.product.associations.stock_availables.stock_available') || []
      const allStocks = stocks.filter(stock => stock.id_product_attribute !== '0').map(stock => {
        const prod = products.find(p => p.combinationId == stock.id_product_attribute)
        const data = {
          prestashop: {
            stock_available: {
              id: stock.id,
              id_product: productId,
              id_product_attribute: stock.id_product_attribute,
              quantity: prod.quantity,
              depends_on_stock: 0,
              out_of_stock: 2,
              id_shop: 1
            }
          }
        }
        return prestan.edit('stock_availables', data, { id: stock.id })
      })
      return Promise.all(allStocks)
    })
  })
}

function parse (filePath) {
  let files = fs.readdirSync(filePath)
  let xlsFileName = files.find(item => /xls/.test(item))
  let xlsFilePath = path.resolve(filePath, xlsFileName)

  let descriptionFileName = files.filter(item => /size_chart\.html/.test(item)) || []
  let descriptions = []
  descriptionFileName.forEach(item => {
    let descriptionFile = path.resolve(filePath, item)
    let temp = fs.readFileSync(descriptionFile, { encoding: 'utf8' })
    temp = temp.replace(/width=".*?"/, 'width="100%"')
    temp = temp.replace(/<meta charset="UTF-8">/gi, '')
    temp = temp.replace(/<style>.*?<\/style>/gi, '')
    descriptions.push(util.minify(temp))
  })
  // get product desc file content
  descriptions.push(util.getDesc(filePath))

  let defaultSKU = xlsFileName.split('.')[0]
  logger.info('default sku is', defaultSKU)
  return xlsx2json(xlsFilePath, {
    sheet: 0,
    dataStartingRow: 2,
    mapping: {
      name: 'A',
      sku: 'B',
      categories: 'D',
      color: 'E',
      size: 'F',
      price: 'G',
      weight: 'T',
      quantity: 'X',
      reference: 'AB',
      images: 'AC'
    }
  })
    .then(json => {
      return prestan
        .get('products', {
          'filter[reference]': defaultSKU
        })
        .then(res => {
          let products = _.get(res, 'prestashop.products.product', [])
          if (products.length === 0) {
            json = json.filter(item => parseInt(item.quantity) > config.quantityThreshold && item.name)
            if (!json.length) {
              throw new Error('No qualified product because stock is not enough')
            }
            json.forEach(item => {
              item.price = item.price.split(' ')[1]
              item.price = util.adjustPrice(item.price)
              item.weight = item.weight.split(' ')[0]
              item.size = item.size.toUpperCase()
              item.color = item.color.toLowerCase()
              item.images = item.images.replace(/https/g, 'http').split('\n')
            })
            return json
          } else {
            throw new Error('product already exist')
          }
        })
    })
    .then(products => {
      logger.info('start to validate product color and size')
      return validateColorAndSize(products)
    })
    .then(products => {
      logger.info('start to create product')
      return createProduct(products, descriptions, defaultSKU)
    })
    .then(products => {
      logger.info('start to create combination')
      return createCombinations(products)
    })
}

module.exports = {
  parse: parse
}
