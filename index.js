var http = require('http')
var path = require('path')
var fs = require('fs')
var ws = require('ws')
var express = require('express')
var cors = require('cors')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var handleWebsocketUpgrade = require('express-websocket')
var getClientIp = require('./lib/client-ip')
var JsonRpc2Server = require('./lib/json-rpc2-server')

module.exports = function instantApi (exposedMethods, options) {

  // options
  options = options || {}
  var port = options.port ? options.port : ( process.env.PORT || 3000 )
  var wsKeepAlive = options.wsKeepAlive !== undefined ? options.wsKeepAlive : true

  // check
  if (!exposedMethods) throw new Error('Please provide a filename, directory or array with filenames.')
  if (typeof exposedMethods !== 'object') throw new Error('First argument must be of type string or array.')

  // create RPC server
  var rpcServer = new JsonRpc2Server()
  // expose methods
  Object.keys(exposedMethods).forEach(function (methodName) {
    rpcServer.exposeModule(methodName, exposedMethods[methodName])
  })

  // create express server
  var app = express()
  // enable debugging in non production environment
  if (process.env.NODE_ENV !== 'production') {
    app.set('showStackError', true)
    app.use(morgan('dev'))
  }
  // get client ip
  app.use(getClientIp)
  // configure CORS to allow all origins
  app.use(cors({
    credentials: true,
    origin: function (origin, callback) {
      callback(null, origin)
    }
  }))
  // handle HTTP requests
  app.post('/',
    bodyParser.text({limit: '5000kb', type: '*/*'}),
    function (req, res) {
      rpcServer.handleRequest({
          message: req.body,
          request: req,
          response: res,
          user: req.user
        }, function (response) {
          // JSON RPC methods calls by specification have responses while notifications do not
          // http://www.jsonrpc.org/specification#notification
          response ? res.status(response.error ? 400 : 200).json(response) : res.status(200).end()
        }
      )
    })
  // handle websocket requests
  app.get('/', function (req, res, next) {
    if (!res.websocket) return next()

    res.websocket(function (ws) {
      // avoid timeouts by sending ping notifications. required on certain PaaS platforms like heroku
      // which close connections automatically after certain time (mostly 30s)
      var interval
      if (wsKeepAlive) {
        interval = setInterval(function () {
          ws.send(JSON.stringify({jsonrpc: '2.0', method: 'keepAlive...', params: {}}))
        }, 20 * 1000)
      }
      ws.on('close', function () {
        if (interval) clearInterval(interval)
      })
      // handle messages
      ws.on('message', function (message) {
        rpcServer.handleRequest({
          message: message,
          request: req,
          response: res,
          user: req.user
        }, function (response) {
          if (response) ws.send(JSON.stringify(response))
        })
      })

    })
  })

  // start server
  var httpServer = http.createServer(app)
  httpServer.listen(port, function () {
    // init websocket server
    var websocketServer = new ws.Server({noServer: true})
    httpServer.on('upgrade', handleWebsocketUpgrade(app, websocketServer))
    // ready to go ;)
    console.log('Server listening on http://localhost:' + port)
  })

}