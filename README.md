# Instant API
Like instant soup but API. JSON-RPC2 flavor with Websockets and HTTP.

```javascript
// expose method 'foo' at port 3000
apiWrap({
  foo: 'tasks/do-something.js' 
},{
  port: process.env.PORT || 3000 
}) 
```

```javascript
// my-script.js
module.exports = function (rpc) {
  
  // use parameters
  console.log(rpc.params)
  
  // return result
  rpc.sendResult('bar')
  
  // return param error
  //rpc.sendParamsError('Missing parameter ...')
  
  // return custom error
  //rpc.sendError('Boom')
  
  // use in promise chains
  // rawQuery(query).then(rpc.sendResult).catch(rpc.sendError)
  
}
```

```javascript
// call your method...
var message = {
  method: 'foo',
  params: { what: 'ever' },
  jsonrpc: '2.0',
  id: Math.round(Math.random()*1e20)
}

// ... from a browser using HTTP
fetch('localhost:3000', {
  method: 'POST', body: JSON.stringify( message )
}).then(function(response){
  return response.json()
}).then(function(body){
  console.log(JSON.parse(body.result))
}).catch(console.error)
 
// ... from a browser using Websockets
var ws = new WebSocket('ws://localhost:3000')
ws.onopen = function () {
  ws.send( JSON.stringify(message) )
}
ws.onmessage = function (event) {
  console.log(JSON.parse(event.data))
}

// ... from another server
require('request').post({
  url: 'http://localhost:3000',
  json: message
}, function (error, response, body) {
  if (!error && response.statusCode === 200) {
    console.log(body.result)
  } else {
    console.error(error || body)
  }
})

```

