const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const request = require('request')
const xlsx2json = require('xlsx2json')
const colornames = require('colornames')

const prestan = require('./api')
const config = require('./config')

function uploadImage(productId, images) {
  console.log('start to upload images')
  const all = images.map(img => {
    // console.log('start to upload image', img)
    return prestan
      .upload(`images/products/${productId}`, {
        image: request(img)
      })
      .then(res => {
        return {
          id: res.prestashop.image.id,
          img: img
        }
      })
      .catch(err => {
        console.error('upload image error:', err)
        throw err
      })
  })
  return Promise.all(all)
}

function createProduct(products, description) {
  const images = []

  products.forEach(product => {
    product.images.forEach(img => {
      if (images.indexOf(img) === -1) {
        images.push(img)
      }
    })
  })
  let data = _.pick(products[0], ['name', 'price', 'weight'])
  data = _.assign(
    {
      available_for_order: 1,
      id_category_default: 2,
      active: 1,
      state: 1,
      description: description
    },
    data
  )

  return prestan
    .add('products', {
      prestashop: {
        product: data
      }
    })
    .then(res => {
      const productId = res.prestashop.product.id
      console.log('upload product success', productId)
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
}

function createCombinations(products) {
  const productId = products[0].id
  const all = products
    .filter(product => {
      // find size id
      let sizeId = config.size[product.size]
      if (sizeId) {
        product.sizeId = sizeId
      } else {
        console.error('cannot find size for:', product)
        return false
      }

      // find similar color id
      let colorName = Object.keys(config.color).find(name => new RegExp(name, 'i').test(product.color))
      let colorId = config.color[colorName] || false
      if (colorId) {
        product.colorId = colorId
      } else {
        console.error('cannot find color for:', product)
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
      const stocks = _.get(product, 'prestashop.product.associations.stock_availables.stock_available')
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

function parse(filePath) {
  let files = fs.readdirSync(filePath)
  let xlsFileName = files.find(item => /xls/.test(item))
  let xlsFilePath = path.resolve(filePath, xlsFileName)
  
  let descriptionFile = path.resolve(filePath, files.find(item => /relate_size_chart\.html/.test(item)))
  let description = fs.readFileSync(descriptionFile, { encoding: 'utf8' })
  description = description.replace(/width=".*?"/, 'width="100%"').replace(/\s+/g, ' ')
  return xlsx2json(xlsFilePath, {
    sheet: 0,
    dataStartingRow: 2,
    mapping: {
      name: 'A',
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
      json = json.filter(item => parseInt(item.quantity) > config.quantityThreshold && item.name)
      json.forEach(item => {
        item.price = item.price.split(' ')[1]
        item.weight = item.weight.split(' ')[0]
        item.images = item.images.replace(/https/g, 'http').split('\n')
      })
      return json
    })
    .then(products => {
      console.log('start to create product')
      return createProduct(products, description)
    })
    .then(products => {
      console.log('start to create combination')
      return createCombinations(products)
    })
    .catch(err => {
      console.log('parse error:', err)
    })
}

module.exports = {
  parse: parse
}