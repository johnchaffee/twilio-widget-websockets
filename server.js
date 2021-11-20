require("dotenv").config();
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const express = require("express");
const path = require("path");
const ejs = require("ejs");
const fetch = require("node-fetch");
const app = express();
// const db = require("./queries");
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
let epoch = Date.now();
let conversationObject = {};
let conversationObjects = [];
let conversations = [];
let messageObject = {};
let messageObjects = [];
let messages = [];
const limit = 20;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.resolve(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static("public"));

app.get("/", (req, res) => {
  // Build query string
  console.log("REQ.QUERY");
  console.log(req.query);
  let queryObjSize = JSON.stringify(req.query).length;
  console.log(queryObjSize);
  console.log("REQ.QUERY.MOBILE");
  console.log(req.query.mobile);
  let mobileNumberQuery = '';
  if (queryObjSize > 2) {
    mobileNumberQuery = req.query.mobile;
  }
  // TODO Add better error checking for existence of mobile query param

  conversations = [];
  messages = [];
  console.log("BEFORE getConversations!!!");
  console.log(conversations);
  getConversations()
    .then(function () {
      console.log("AFTER getConversations!!!");
      console.log(conversations);
    })
    .then(function () {
      messages = [];
      console.log("BEFORE getMessages!!!");
      console.log(messages);
      getMessages(mobileNumberQuery).then(function () {
        console.log("AFTER getMessages!!!");
        console.log(messages);
        console.log("RENDER");
        // res.render("index", { conversations, messages });
        res.render("index");
      });
    })
    .catch(function (err) {
      res.status(500).send({ error: "we done homie" });
    });
});

// SEND OUTGOING MESSAGE
// Web client sends '/messagesend' request to this server, which posts request to Twilio API
app.post("/messagesend", (req, res, next) => {
  let body = req.body.body;
  let mobile_number = req.body.mobile_number;
  // If sending to messenger, send from facebook_messenger_id
  if (mobile_number.slice(0, 9) === "messenger") {
    twilio_number = facebook_messenger_id;
  } else if (mobile_number.slice(0, 8) === "whatsapp") {
    twilio_number = whatsapp_id;
  } else {
    // this variable is already set
    // twilio_number = twilio_number;
  }
  // Send message via Twilio API
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`;
  // url encode body params
  const bodyParams = new URLSearchParams({
    From: twilio_number,
    To: mobile_number,
    Body: body,
  });
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basic_auth,
    },
    body: bodyParams,
  };
  fetch(apiUrl, requestOptions)
    // .then((response) => response.text())
    .then((response) => response.json())
    .then((result) => {
      console.log("SEND MESSAGE SUCCESS");
      console.log("Message sent");
      // console.log("result: " + JSON.stringify(result, undefined, 2));
    })
    .catch((error) => {
      console.log("TWILIO MESSAGE SEND CATCH:");
      console.log(
        ".catch JSON.stringify(error, undefined, 2): \n" +
          JSON.stringify(error, undefined, 2)
      );
      console.log("error", error);
    })
    .finally(() => {
      console.log("FINALLY");
    });
  res.sendStatus(200);
});

// TWILIO EVENT STREAMS WEBHOOKS
// Listen for incoming and outgoing messages
app.post("/twilio-event-streams", (req, res, next) => {
  console.log("TWILIO EVENT STREAMS WEBHOOK");
  // Get first array object in request body
  let requestBody = req.body[0];
  console.log("BODY TYPE: " + requestBody.type);
  console.log(JSON.stringify(requestBody, undefined, 2));
  // INCOMING WEBHOOK
  if (requestBody.type == "com.twilio.messaging.inbound-message.received") {
    messageObject = {
      type: "messageCreated",
      date_created: requestBody.data.timestamp,
      direction: "inbound",
      twilio_number: requestBody.data.to,
      mobile_number: requestBody.data.from,
      conversation_id: `${requestBody.data.to};${requestBody.data.from}`,
      body: requestBody.data.body,
    };
    conversationObject = {
      type: "conversationUpdated",
      date_updated: requestBody.data.timestamp,
      conversation_id: `${requestBody.data.to};${requestBody.data.from}`,
      unread_count: 1,
    };
    // Send incoming messasge to websocket clients
    updateWebsocketClient(messageObject);
    // Send conversation to websocket clients
    updateWebsocketClient(conversationObject);
    // Create or update conversation in db
    updateConversation(conversationObject);
    // Create message in db
    createMessage(messageObject);
  }
  // OUTGOING WEBHOOK
  else if (requestBody.type == "com.twilio.messaging.message.sent") {
    console.log("BEFORE MESSAGE BODY");
    // fetch message body
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}.json`;
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: basic_auth,
      },
    };
    fetch(apiUrl, requestOptions)
      // .then((response) => response.text())
      .then((response) => response.json())
      .then((result) => {
        console.log("GET MESSAGE BODY SUCCESS");
        console.log("result: " + JSON.stringify(result, undefined, 2));
        messageObject = {
          type: "messageCreated",
          date_created: new Date(result.date_created).toISOString(),
          direction: "outbound",
          twilio_number: result.from,
          mobile_number: result.to,
          conversation_id: `${result.from};${result.to}`,
          body: result.body,
        };
        conversationObject = {
          type: "conversationUpdated",
          date_updated: new Date(result.date_created).toISOString(),
          conversation_id: `${result.from};${result.to}`,
          unread_count: 0,
        };
        // Send outgoing message to websocket clients
        updateWebsocketClient(messageObject);
        // Send conversation list to websocket clients
        updateWebsocketClient(conversationObject);
        // Create or update conversation in db
        updateConversation(conversationObject);
        // Create messasge in db
        createMessage(messageObject);
      })
      .catch((error) => {
        console.log("TWILIO GET MESSAGES CATCH:");
        console.log(
          ".catch JSON.stringify(error, undefined, 2): \n" +
            JSON.stringify(error, undefined, 2)
        );
        console.log("error", error);
      })
      .finally(() => {
        console.log("FINALLY");
      });
  }
  res.sendStatus(200);
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

// POSTGRES DATABASE QUERIES
const Pool = require("pg").Pool;
const pool = new Pool({
  // user: 'me',
  // password: 'password',
  host: "localhost",
  database: "widget",
  port: 5432,
});

// GET ALL CONVERSATIONS FROM DB
// On startup, fetch all conversations from postgres db
// getConversations();
async function getConversations() {
  try {
    const result = await pool.query(
      "SELECT * FROM conversations order by date_updated desc limit $1",
      [limit]
    );
    conversationObjects = result.rows;
    console.log("getConversations CONVERSATION OBJECTS:");
    console.log(conversationObjects);
    conversations = [];
    conversationObjects.forEach((conversation) => {
      conversations.push({
        type: "conversationUpdated",
        date_updated: conversation.date_updated,
        conversation_id: conversation.conversation_id,
        contact_name: conversation.contact_name,
        unread_count: conversation.unread_count,
      });
    });
    console.log("getConversations CONVERSATIONS:");
    console.log(conversations);
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
}

// GET ALL MESSAGES FROM DB
// On startup, fetch all messages from postgres db
// getMessages();
async function getMessages(mobileNumberQuery) {
  try {
    const result = await pool.query(
      "SELECT * FROM messages WHERE mobile_number = $1 order by date_created desc limit $2",
      [mobileNumberQuery, limit]
    );
    
    messageObjects = result.rows.reverse();
    console.log("getMessages MESSAGE OBJECTS:");
    console.log(messageObjects);
    messageObjects.forEach((message) => {
      messages.push({
        type: "messageCreated",
        date_created: message.date_created,
        direction: message.direction,
        twilio_number: message.twilio_number,
        mobile_number: message.mobile_number,
        conversation_id: message.conversation_id,
        body: message.body,
      });
    });
    console.log("getMessages MESSAGES:");
    console.log(messages);
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
}

// CREATE MESSAGE
async function createMessage(request, response) {
  try {
    const {
      date_created,
      direction,
      twilio_number,
      mobile_number,
      conversation_id,
      body,
    } = request;
    const result = await pool.query(
      "INSERT INTO messages (date_created, direction, twilio_number, mobile_number, conversation_id, body) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        date_created,
        direction,
        twilio_number,
        mobile_number,
        conversation_id,
        body,
      ]
    );
    console.log("Message created");
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
}

// UPDATE CONVERSATION
async function updateConversation(request, response) {
  // Outgoing message or message read event, reset unread_count
  if (request.unread_count === 0) {
    try {
      const { date_updated, conversation_id, unread_count } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = EXCLUDED.unread_count",
        [date_updated, conversation_id, unread_count]
      );
      console.log("Conversation updated");
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Incoming message, increment unread_count
  else {
    try {
      const { date_updated, conversation_id, unread_count } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = conversations.unread_count + EXCLUDED.unread_count",
        [date_updated, conversation_id, unread_count]
      );
      console.log("Conversation updated");
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
}

// UPDATE WEBSOCKET CLIENT
function updateWebsocketClient(theObject) {
  console.log("UPDATE WEBSOCKET CLIENT");
  try {
    wsClient.send(JSON.stringify(theObject));
  } catch (err) {
    console.log("UPDATE WEBSOCKET CLIENT CATCH");
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
console.log("WSCLIENT TARGET SERVER: " + wsClient.url);

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
// On new connection, send array of stored messages
wsServer.on("connection", (socketClient) => {
  console.log("ON CONNECTION");
  console.log("Number of clients: ", wsServer.clients.size);
  socketClient.isAlive = true;
  socketClient.on("pong", heartbeat);
  socketClient.send(JSON.stringify(messages));
  socketClient.send(JSON.stringify(conversations));

  // ON MESSAGE
  // on new message, append message to array, then send message to all clients
  socketClient.on("message", (message) => {
    console.log("ON MESSAGE");
    console.log(message);
    let messageObject = JSON.parse(message);
    console.log("MESSAGE OBJECT");
    let thisArray = [];
    console.log(messageObject);
    messages.push(messageObject);
    let lastMessageArray = [messages[messages.length - 1]];
    // TODO - manipulat the existing conversations array which is in memory and pass the whole thing in
    console.log("ON MESSAGE CONVERSATION OBJECT");
    console.log(conversationObject);
    console.log("CONVERSATIONS BEFORE");
    console.log(conversations);
    getConversations()
      .then(function () {
        console.log("AFTER getConversations!!!");
        console.log(conversations);
        if (messageObject.type == "messageCreated") {
          thisArray = lastMessageArray;
        } else {
          thisArray = conversations;
        }
        wsServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            console.log("SEND wsServer.clients.forEach((client)");
            client.send(JSON.stringify(thisArray));
          }
        });
      })
      .catch(function (err) {
        res.status(500).send({ error: "we done homie" });
      });
  });

  // ON CLOSE
  // Log when connection is closed
  socketClient.on("close", (socketClient) => {
    console.log("ON CLOSE");
    // clearInterval(interval);
    console.log("Number of clients: ", wsServer.clients.size);
  });
});
