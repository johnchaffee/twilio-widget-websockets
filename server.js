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
      const result = await pool.query(
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
      const result = await pool.query(
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

// SEND OUTGOING MESSAGE
// Web client posts '/messagesend' request to this server, which posts request to Twilio API
app.post("/messagesend", (req, res, next) => {
  console.log("/messagesend");
  let body = req.body.body;
  let mobile_number = req.body.mobile_number;
  if (mobile_number.slice(0, 9) === "messenger") {
    // If sending to messenger, send from facebook_messenger_id
    twilio_number = facebook_messenger_id;
  } else if (mobile_number.slice(0, 8) === "whatsapp") {
    // If sending to whatsapp, send from whats_app_id
    twilio_number = whatsapp_id;
  } else {
    // else, send from twilio SMS number -- its variable is already set
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
  sendMessage(apiUrl, requestOptions)
    .then((result) => {
      // console.log("sendMessage() THEN -> RESULT");
      // console.log(result);
      res.sendStatus(200);
    })
    .catch((error) => {
      console.log("sendMessage() CATCH");
      console.log(error.message);
      // error.message;
    });

  async function sendMessage(apiUrl, requestOptions) {
    console.log("sendMessage()");
    const response = await fetch(apiUrl, requestOptions);
    const result = await response.json();
    return result;
  }
  // res.sendStatus(200);
});

// TWILIO EVENT STREAMS WEBHOOKS
// Listen for incoming and outgoing messages
app.post("/twilio-event-streams", (req, res, next) => {
  console.log("/twilio-event-streams WEBHOOK");
  // Get first array object in request body
  let requestBody = req.body[0];
  // console.log(JSON.stringify(requestBody, undefined, 2));
  // INCOMING WEBHOOK
  if (requestBody.type == "com.twilio.messaging.inbound-message.received") {
    console.log("INBOUND WEBHOOK");
    // If incoming message, the body already exists in payload
    // Set default messageObject and conversationObject properties, unread_count: 1
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
    if (requestBody.data.numMedia > 0) {
      // if nuMedia > 0, fetch the mediaUrl and add  it to the messageObject
      const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}/Media.json`;
      const requestOptions = {
        method: "GET",
        headers: {
          Authorization: basic_auth,
        },
      };
      getMediaUrl(apiUrl, requestOptions)
        .then((result) => {
          // console.log("getMediaUrl() THEN -> RESULT");
          // console.log(result);
          // Set messageObject mediaUrl property
          const media_url =
            `https://api.twilio.com${result.media_list[0].uri}`.replace(
              ".json",
              ""
            );
          messageObject.media_url = media_url;
          createMessage(messageObject);
          updateConversation(conversationObject);
        })
        .catch((error) => {
          console.log("getMediaUrl() CATCH");
          console.log(error.message);
          // error.message;
        });

      // Fetch message body
      async function getMediaUrl(apiUrl, requestOptions) {
        console.log("getMediaUrl()");
        const response = await fetch(apiUrl, requestOptions);
        const result = await response.json();
        return result;
      }
    } else {
      // There is no medialUrl, send the default messageObject and conversationObject
      createMessage(messageObject);
      updateConversation(conversationObject);
    }
  }
  // OUTGOING WEBHOOK
  else if (requestBody.type == "com.twilio.messaging.message.sent") {
    console.log("OUTBOUND WEBHOOK");
    // If outgoing message, the body does not exist in payload and must be fetched
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}.json`;
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: basic_auth,
      },
    };
    getMessageBody(apiUrl, requestOptions)
      .then((result) => {
        // console.log("getMessageBody() THEN -> RESULT");
        // console.log(result);
        // Set messageObject and conversationObject properties, reset unread_count: 0
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
        createMessage(messageObject);
        updateConversation(conversationObject);
      })
      .catch((error) => {
        console.log("getMessageBody() CATCH");
        console.log(error.message);
        // error.message;
      });

    // Fetch message body
    async function getMessageBody(apiUrl, requestOptions) {
      console.log("getMessageBody()");
      const response = await fetch(apiUrl, requestOptions);
      const result = await response.json();
      return result;
    }
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

// CREATE MESSAGE
async function createMessage(request, response) {
  console.log("createMessage()");
  console.log(request);
  try {
    const {
      date_created,
      direction,
      twilio_number,
      mobile_number,
      conversation_id,
      body,
      media_url,
    } = request;
    const result = await pool.query(
      "INSERT INTO messages (date_created, direction, twilio_number, mobile_number, conversation_id, body, media_url) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        date_created,
        direction,
        twilio_number,
        mobile_number,
        conversation_id,
        body,
        media_url,
      ]
    );
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
  // Send messasge to websocket clients
  updateWebsocketClient(messageObject);
}

// UPDATE CONVERSATION
async function updateConversation(request, response) {
  console.log("updateConversation()");
  // Outgoing message or message read event, reset unread_count
  if (request.unread_count === 0) {
    try {
      const { date_updated, conversation_id, unread_count } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = EXCLUDED.unread_count",
        [date_updated, conversation_id, unread_count]
      );
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
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Send conversation to websocket clients
  updateWebsocketClient(conversationObject);
}

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
        const result = await pool.query(
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
