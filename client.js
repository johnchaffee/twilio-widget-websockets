require("dotenv").config()
const WebSocket = require("ws")
const port = process.env.PORT || 3000
const app_host_name = process.env.APP_HOST_NAME || "localhost"

// UPDATE WEBSOCKET CLIENT
function updateWebsocketClient(theObject) {
  console.log("updateWebsocketClient()")
  try {
    wsClient.send(JSON.stringify(theObject))
  } catch (err) {
    console.log("updateWebsocketClient() CATCH")
    console.log(err)
  }
}

// WEBSOCKET CLIENT
// The Websocket Client runs in the browser
// Set path to browser client running in dev or prod
let wsClient
if (process.env.NODE_ENV === "development") {
  wsClient = new WebSocket(`ws://${app_host_name}:${port}`)
} else {
  wsClient = new WebSocket(`ws://${app_host_name}.herokuapp.com`)
}
console.log("WSCLIENT SERVER: " + wsClient.url)

module.exports = {
  updateWebsocketClient,
}
