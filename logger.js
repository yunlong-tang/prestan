const log4js = require('log4js')
const log4js_extend = require('log4js-extend')

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    app: { type: 'file', filename: 'logs/app.log' },
    error: { type: 'logLevelFilter', appender: 'app', level: 'error' }
  },
  categories: {
    default: { appenders: ['out', 'error'], level: 'info' }
  }
})

log4js_extend(log4js, {
  path: __dirname,
  format: 'at @name (@file:@line:@column)'
})

module.exports = log4js
