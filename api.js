var Prestan = require('prestan')

var executeRequest = Prestan.prototype.executeRequest
Prestan.prototype.executeRequest = function (method, url, options = {}) {
  if (options.form) {
    options.body = options.form
    if (!options.headers) {
      options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    } else {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    delete options.form
  }
  return executeRequest.apply(this, arguments)
}

Prestan.prototype.upload = function (resource, data = {}, options = {}) {
  let url = this.resource(resource)
  if (!data || typeof data !== 'object') {
    throw new Error('No data specified to send, should be an object')
  }
  let query = this.stringify(options)
  if (query.length) {
    url += `?${query}`
  }
  return this.executeRequest('post', url, { formData: data }).then(response => this.parse(response))
}
var prestan = new Prestan('https://www.clothesgate.com', 'QVSXCGWWD754Z9WIGA3H2R3V7W1YYVHJ')

module.exports = prestan
