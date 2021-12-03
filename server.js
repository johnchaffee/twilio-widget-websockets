require("dotenv").config();
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const express = require("express");
const path = require("path");
const ejs = require("ejs");
const fetch = require("node-fetch");
const app = express();
const db = require("./database");
const port = process.env.PORT || 3000;
const app_host_name = process.env.APP_HOST_NAME || "localhost";
let twilio_number = process.env.TWILIO_NUMBER;
const facebook_messenger_id = process.env.FACEBOOK_MESSENGER_ID;
const whatsapp_id = process.env.WHATSAPP_ID;
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
const buf = Buffer.from(twilio_account_sid + ":" + twilio_auth_token);
const encoded = buf.toString("base64");
const basic_auth = "Basic " + encoded;
// let epoch = Date.now();
let conversationObject = {};
let conversations = [];
let messageObject = {};
let messages = [];
const limit = 4;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.resolve(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static("public"));

// Import and use ./routes/messagesend module
const messagesendRouter = require("./routes/messagesend");
app.use("/messagesend", messagesendRouter);

// Import and use ./routes/webhooks module
const webhooksRouter = require("./routes/webhooks");
app.use("/twilio-event-streams", webhooksRouter);

// When client connects or clicks on a conversation, reset conversation count and fetch messages for selected conversation
// conversations array and messages array will each be sent via socketClient.send();
app.get("/", (req, res) => {
  console.log("REQ.QUERY:");
  console.log(req.query);
  let queryObjSize = JSON.stringify(req.query).length;
  console.log("REQ.QUERY.MOBILE");
  console.log(req.query.mobile);
  let mobileNumberQuery = "";
  // Check if query param object is greater than empty object {} length of 2
  if (queryObjSize > 2) {
    mobileNumberQuery = req.query.mobile;
  }
  conversations = [];
  messages = [];
  resetConversationCount(`${twilio_number};${mobileNumberQuery}`)
    .then(function () {
      messages = [];
      // Get array of messages for this mobile number
      getMessages(mobileNumberQuery).then(function () {
        console.log("RENDER INDEX");
        res.render("index");
        // res.render("index", { conversations, messages });
      });
    })
    .catch(function (err) {
      res.status(500).send({ error: "we done homie" });
    });
  // Mark messages as read when clicking on conversation
  async function resetConversationCount(conversation_id) {
    console.log("resetConversationCount()");
    try {
      const result = await db.pool.query(
        "UPDATE conversations SET unread_count = $1 WHERE conversation_id = $2",
        [0, conversation_id]
      );
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
    // Send conversation to websocket clients
    updateWebsocketClient(conversationObject);
  }
  // Fetch all messages for selected conversation
  async function getMessages(mobileNumberQuery) {
    console.log("getMessages():");
    try {
      const result = await db.pool.query(
        "SELECT * FROM messages WHERE mobile_number = $1 order by date_created desc limit $2",
        [mobileNumberQuery, limit]
      );

      messages = result.rows.reverse();
      messages.forEach((message) => {
        message.type = "messageCreated";
      });
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  }
});

// ACK CATCHALL WEBHOOK
// Catchall to acknowledge webhooks that don't match the paths above
app.post(/.*/, (req, res, next) => {
  console.log("ACK WEBHOOK");
  res.sendStatus(200);
  // res.send("<Response></Response>");
});

// EXPRESS SERVER
const server = app.listen(port, function () {
  console.log(`Express server listening on port ${port}`);
});

// UPDATE WEBSOCKET CLIENT
function updateWebsocketClient(theObject) {
  console.log("updateWebsocketClient()");
  try {
    wsClient.send(JSON.stringify(theObject));
  } catch (err) {
    console.log("updateWebsocketClient() CATCH");
    console.log(err);
  }
}

// WEBSOCKET CLIENT
// The Websocket Client runs in the browser
// Set path to browser client running in dev or prod
let wsClient;
if (process.env.NODE_ENV === "development") {
  wsClient = new WebSocket(`ws://${app_host_name}:${port}`);
} else {
  wsClient = new WebSocket(`ws://${app_host_name}.herokuapp.com`);
}
console.log("WSCLIENT SERVER: " + wsClient.url);

// WEBSOCKET SERVER
// The Websocket server is running on this node server
const wsServer = new WebSocketServer({ server: server });

function noop() {}

function heartbeat() {
  this.isAlive = true;
}

// SERVER PING
// Ping client every 45 seconds to keep connection alive
const interval = setInterval(function ping() {
  console.log("SERVER PING");
  wsServer.clients.forEach(function each(socketClient) {
    if (socketClient.isAlive === false) return socketClient.terminate();

    socketClient.isAlive = false;
    socketClient.ping(noop);
  });
}, 45000);

// ON CONNECTION
// On new client connection, send array of stored messages and conversations
wsServer.on("connection", (socketClient) => {
  console.log("ON CONNECTION");
  console.log("Number of clients: ", wsServer.clients.size);
  socketClient.isAlive = true;
  socketClient.on("pong", heartbeat);
  socketClient.send(JSON.stringify(messages));
  socketClient.send(JSON.stringify(conversations));

  // ON MESSAGE
  // on new message, send messageObject as array or conversations array
  socketClient.on("message", (message) => {
    console.log("socketClient.on(message)");
    console.log(message);
    let messageObject = JSON.parse(message);
    let thisArray = [];
    getConversations()
      .then(function () {
        if (messageObject.type == "messageCreated") {
          // If message is messageCreated, push single messsageObject as an array
          thisArray = [messageObject];
        } else {
          // If message is conversationUpdated, push entire conversations array
          thisArray = conversations;
        }
        console.log("forEach => client.send()");
        wsServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(thisArray));
          }
        });
      })
      .catch(function (err) {
        res.status(500).send({ error: "Error getting conversations" });
      });
    // GET ALL CONVERSATIONS FROM DB
    async function getConversations() {
      console.log("getConversations():");
      try {
        const result = await db.pool.query(
          "SELECT * FROM conversations order by date_updated desc limit $1",
          [limit]
        );
        conversations = result.rows;
        conversations.forEach((conversation) => {
          conversation.type = "conversationUpdated";
        });
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    }
  });

  // ON CLOSE
  // Log when connection is closed
  socketClient.on("close", (socketClient) => {
    console.log("ON CLOSE");
    // clearInterval(interval);
    console.log("Number of clients: ", wsServer.clients.size);
  });
});
