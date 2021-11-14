require("dotenv").config();
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const http = require("http");
const express = require("express");
// const path = require("path");
const fetch = require("node-fetch");
const app = express();
const port = process.env.PORT || 3000;
const app_host_name = process.env.APP_HOST_NAME || "localhost";
// const mobile = process.env.MOBILE_NUMBER;
const twilio_number = process.env.TWILIO_NUMBER;
const facebook_messenger_id = process.env.FACEBOOK_MESSENGER_ID;
const whatsapp_id = process.env.WHATSAPP_ID;
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
// const basic_auth = process.env.BASIC_AUTH;
const buf = Buffer.from(twilio_account_sid + ":" + twilio_auth_token);
const encoded = buf.toString("base64");
const basic_auth = "Basic " + encoded;
let epoch = Date.now();
let the_date = new Date(epoch).toISOString();
let myObj = {};
let messageObjects = [];
let messages = [];
let landline = "";
const limit = 50;

// TODO - refactor twilioGetMessages() to use Conversations API
// On startup fetch messages from twilioGetMessages()
landline = twilio_number;
console.log("LANDLINE: " + landline);
// twilioGetMessages();

const server = http.createServer(app);
server.listen(port);
console.log(`listening on port ${port}`);

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

  // ON MESSAGE
  // on new message, append message to array, then send message to all clients
  socketClient.on("message", (message) => {
    console.log("ON MESSAGE");
    console.log(message);
    messages.push(message);
    console.log("ON MESSAGE MESSAGES:");
    console.log(messages);
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify([message]));
      }
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

// OUTGOING MESSAGE
// Chat client sends /messagesend request to this server
// This server then posts request to Twilio API
// Then sends message to Websocket server
app.post("/messagesend", (req, res, next) => {
  let body = req.body.body;
  let mobile = req.body.mobile;
  // If sending to messenger, send from facebook_messenger_id
  if (mobile.slice(0, 9) === "messenger") {
    landline = facebook_messenger_id;
  } else if (mobile.slice(0, 8) === "whatsapp") {
    landline = whatsapp_id;
  } else {
    landline = twilio_number;
  }
  epoch = Date.now();
  the_date = new Date(epoch).toISOString();
  myObj = {
    dateCreated: the_date,
    direction: "outbound",
    landline: landline,
    mobile: mobile,
    body: body,
  };
  // Send message to Twilio API
  // TODO Change twilioSend to use Conversations message create API
  twilioSend(body, mobile);
  // Send message to Websocket server
  try {
    wsClient.send(JSON.stringify(myObj));
  } catch (err) {
    console.log("MESSAGE SEND CATCH:");
    console.log(err);
  }
  res.sendStatus(200);
});

// INCOMING MESSAGE VIA TWILIO EVENT STREAMS
// Listen for incoming messages from mobile
// Push message to websocket client
app.post("/twilio-event-streams", (req, res, next) => {
  console.log("TWILIO EVENT STREAMS WEBHOOK");
  // Get first array object in request body
  let requestBody = req.body[0];
  console.log(JSON.stringify(requestBody, undefined, 2));
  // Check to see if it is an incoming webhook
  if (requestBody.type == "com.twilio.messaging.inbound-message.received") {
    // console.log(req.body);
    epoch = Date.now();
    the_date = new Date(epoch).toISOString();
    let mobile = requestBody.data.from;
    let body = requestBody.data.body;
    myObj = {
      dateCreated: the_date,
      direction: "inbound",
      landline: landline,
      mobile: mobile,
      body: body,
    };
    // console.log(JSON.stringify(myObj));
    // on webhook event, send message to websocket server
    try {
      wsClient.send(JSON.stringify(myObj));
    } catch (err) {
      console.log("TWILIO WEBHOOK CATCH");
      console.log(err);
    }
  }
  // Reply with empty TWIML response no matter what
  res.send("<Response></Response>");
  // res.sendStatus(200);
});

// ACK CATCHALL WEBHOOK
// Catchall to acknowledge webhooks that don't match the paths above
app.post(/.*/, (req, res, next) => {
  console.log("ACK WEBHOOK");
  // res.sendStatus(200);
  res.send("<Response></Response>");
});

// TWILIO MESSAGE SEND API
function twilioSend(body, mobile) {
  const apiUrl =
    "https://api.twilio.com/2010-04-01/Accounts/" +
    twilio_account_sid +
    "/Messages.json";
  // url encode body params
  const bodyParams = new URLSearchParams({
    From: landline,
    To: mobile,
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
}
// END TWILIO MESSAGE SEND API

// TWILIO GET MESSAGES API
function twilioGetMessages() {
  const apiUrl =
    "https://api.twilio.com/2010-04-01/Accounts/" +
    twilio_account_sid +
    "/Messages.json?PageSize=" +
    limit;
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
      console.log("GET MESSAGES SUCCESS");
      // console.log("result: " + JSON.stringify(result, undefined, 2));
      messageObjects = result.messages.reverse();
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
      // console.log("MESSAGE OBJECTS:");
      // console.log(messageObjects);
      messageObjects.forEach((message) => {
        let direction = "outbound";
        let landline = message.from;
        let mobile = message.to;
        if (message.direction == "inbound") {
          direction = "inbound";
          landline = message.to;
          mobile = message.from;
        }
        the_date = new Date(message.date_created).toISOString();
        messages.push(
          JSON.stringify({
            dateCreated: the_date,
            direction: direction,
            landline: landline,
            mobile: mobile,
            body: message.body,
          })
        );
      });
      console.log("FETCHED MESSAGES");
      console.log(messages);
    });
}
// END TWILIO GET MESSAGES API
