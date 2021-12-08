require("dotenv").config();
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const express = require("express");
const path = require("path");
const ejs = require("ejs");
const app = express();
const db = require("./database");
const client = require("./client");
const port = process.env.PORT || 3000;
let twilio_number = "";
let conversations = [];
let messages = [];
const limit = process.env.LIMIT || 20;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.resolve(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static("public"));

// Import and use routes
const messagesendRouter = require("./routes/messages");
app.use("/messages", messagesendRouter);

const webhooksRouter = require("./routes/webhooks");
app.use("/twilio-event-streams", webhooksRouter);

// When client connects or clicks on a conversation, reset conversation count and fetch messages for selected conversation
// conversations array and messages array will each be sent via client.updateWebsocketClient()
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
  if (mobileNumberQuery.slice(0, 9) === "messenger") {
    twilio_number = process.env.FACEBOOK_MESSENGER_ID;
  } else if (mobileNumberQuery.slice(0, 8) === "whatsapp") {
    twilio_number = process.env.WHATSAPP_ID;
  } else {
    twilio_number = process.env.TWILIO_NUMBER;
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
      res.status(500).send({ error: err });
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
      console.log("resetConversationCount() CATCH");
      console.error(err);
    }
    // Send empty object to websocket clients after resetting the count for selected conversation
    // This will cause the websocket server to run the getConversations() function and update all clients
    client.updateWebsocketClient({});
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

// CREATE CONVERSATION
// Triggered when client clicks + button and creates a new conversation
app.post("/conversations", (req, res, next) => {
  if (req.body.mobile_number.slice(0, 9) === "messenger") {
    twilio_number = process.env.FACEBOOK_MESSENGER_ID;
  } else if (req.body.mobile_number.slice(0, 8) === "whatsapp") {
    twilio_number = process.env.WHATSAPP_ID;
  } else {
    twilio_number = process.env.TWILIO_NUMBER;
  }
  console.log("CREATE CONVERSATION");
  conversationObject = {
    type: "conversationUpdated",
    date_updated: new Date().toISOString(),
    conversation_id: `${twilio_number};${req.body.mobile_number}`,
    unread_count: 0,
    status: "open",
  };
  db.updateConversation(conversationObject);
  res.sendStatus(200);
});

// NAME OR ARCHIVE A CONVERSATION
// Triggered when client edits contact_name or archives a conversation
app.put("/conversations", (req, res, next) => {
  console.log("UPDATE CONVERSATION");
  console.log(req.body);
  twilio_number = process.env.TWILIO_NUMBER;
  console.log(`TWILIO NUMBER BEFORE: ${twilio_number}`);
  if (req.body.mobile_number.slice(0, 9) === "messenger") {
    twilio_number = process.env.FACEBOOK_MESSENGER_ID;
  } else if (req.body.mobile_number.slice(0, 8) === "whatsapp") {
    twilio_number = process.env.WHATSAPP_ID;
  } else {
    twilio_number = process.env.TWILIO_NUMBER;
  }
  console.log(`TWILIO NUMBER AFTER: ${twilio_number}`);
  // Set contact_name
  if (req.body.contact_name != null) {
    conversationObject = {
      type: "conversationContactUpdated",
      conversation_id: `${twilio_number};${req.body.mobile_number}`,
      contact_name: req.body.contact_name,
      status: "open",
    };
    console.log(conversationObject);
    db.nameConversation(conversationObject);
    client.updateWebsocketClient(conversationObject);
  } else if (req.body.status != null) {
    conversationObject = {
      type: "conversationStatusUpdated",
      conversation_id: `${twilio_number};${req.body.mobile_number}`,
      status: req.body.status,
    };
    if (req.body.status === "deleted") {
      // Delete all associated messages
      db.deleteMessages(conversationObject);
    }
    db.archiveConversation(conversationObject);
    client.updateWebsocketClient(conversationObject);
  }
  // db.updateConversation(conversationObject);
  res.sendStatus(200);
});

// ACK CATCHALL WEBHOOK
// Catchall to acknowledge webhooks that don't match the paths above
app.post(/.*/, (req, res, next) => {
  console.log("ACK WEBHOOK");
  // res.sendStatus(200);
  res.send("<Response></Response>");
});

// EXPRESS SERVER
const server = app.listen(port, function () {
  console.log(`Express server listening on port ${port}`);
});

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
  // This is triggered by the client.updateWebsocketClient() function, it sends a single item array
  // containing either a messageCreated or conversationUpdated object to each connected client
  socketClient.on("message", (message) => {
    console.log("socketClient.on(message)");
    console.log(message);
    let messageObject = JSON.parse(message);
    getConversations()
      .then(function () {
        console.log("forEach => client.send()");
        wsServer.clients.forEach((client) => {
          if (
            client.readyState === WebSocket.OPEN &&
            JSON.stringify(message).length > 2
          ) {
            client.send(JSON.stringify([messageObject]));
          }
        });
      })
      .catch(function (err) {
        console.log("getConversations() CATCH");
        console.log(err);
      });
    // GET ALL CONVERSATIONS FROM DB
    async function getConversations() {
      console.log("getConversations():");
      try {
        const result = await db.pool.query(
          "SELECT * FROM conversations WHERE status = 'open' order by date_updated desc limit $1",
          [limit]
        );
        conversations = result.rows;
        conversations.forEach((conversation) => {
          conversation.type = "conversationUpdated";
        });
      } catch (err) {
        console.log("getConversations() CATCH");
        console.error(err);
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
