require("dotenv").config();
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const http = require("http");
const express = require("express");
// const path = require("path");
const fetch = require("node-fetch");
const app = express();
const db = require("./queries");
const port = process.env.PORT || 3000;
const app_host_name = process.env.APP_HOST_NAME || "localhost";
let twilio_number = process.env.TWILIO_NUMBER;
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
const limit = 50;

const Pool = require("pg").Pool;
const pool = new Pool({
  // user: 'me',
  // password: 'password',
  host: "localhost",
  database: "widget",
  port: 5432,
});

console.log("twilio_number: " + twilio_number);

// Fetch all messages from postgres db
getMessages();

// Test fetching messages from pg db
// app.get("/messages", db.getMessages);

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
app.post("/messagesend", (req, res, next) => {
  let body = req.body.body;
  let mobile = req.body.mobile;
  // If sending to messenger, send from facebook_messenger_id
  if (mobile.slice(0, 9) === "messenger") {
    twilio_number = facebook_messenger_id;
  } else if (mobile.slice(0, 8) === "whatsapp") {
    twilio_number = whatsapp_id;
  } else {
    // this variable is already set
    // twilio_number = twilio_number;
  }
  epoch = Date.now();
  the_date = new Date(epoch).toISOString();
  myObj = {
    date: the_date,
    direction: "outbound",
    twilio_number: twilio_number,
    mobile: mobile,
    body: body,
  };
  // Send message to Twilio API
  twilioSend(body, mobile);
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
  // epoch = Date.now();
  // the_date = new Date(epoch).toISOString();
  // Check to see if it is a 'received' webhook
  if (requestBody.type == "com.twilio.messaging.inbound-message.received") {
    body = requestBody.data.body;
    myObj = {
      date: requestBody.data.timestamp,
      direction: "inbound",
      twilio_number: twilio_number,
      mobile: requestBody.data.from,
      body: requestBody.data.body,
    };
    // Send incoming messasge to websocket clients
    updateWebsocketClient(myObj);
  }
  // Else check to see if it is a 'sent' webhook
  else if (requestBody.type == "com.twilio.messaging.message.sent") {
    console.log("BEFORE MESSAGE BODY");
    // fetch message body, then it will update websocket clients
    twilioGetMessageBody(requestBody.data.messageSid);
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

// UPDATE WEBSOCKET CLIENT
function updateWebsocketClient(myObj) {
  try {
    wsClient.send(JSON.stringify(myObj));
  } catch (err) {
    console.log("UPDATE WEBSOCKET CLIENT CATCH");
    console.log(err);
  }
}

// TWILIO MESSAGE SEND API
function twilioSend(body, mobile) {
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`;
  // url encode body params
  const bodyParams = new URLSearchParams({
    From: twilio_number,
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

// TWILIO GET MESSAGE API
function twilioGetMessageBody(messageSid) {
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${messageSid}.json`;
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
      the_date = new Date(result.date_sent).toISOString();
      myObj = {
        date: the_date,
        direction: "outbound",
        twilio_number: twilio_number,
        mobile: result.to,
        body: result.body,
      };
      // Send outgoing messasge to websocket clients
      updateWebsocketClient(myObj);
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
// END TWILIO GET MESSAGE API

// GET MESSAGES ASYNC/AWAIT
async function getMessages() {
  try {
    const result = await pool.query("SELECT * FROM messages order by date asc");
    messageObjects = result.rows;
    console.log("MESSAGE OBJECTS:");
    console.log(messageObjects);
    messageObjects.forEach((message) => {
      let date = message.date;
      messages.push(
        JSON.stringify({
          date: date,
          direction: message.direction,
          twilio_number: message.twilio_number,
          mobile: message.mobile,
          body: message.body,
        })
      );
    });
    console.log("MESSAGES:");
    console.log(messages);
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
};
// END GET MESSAGES ASYNC/AWAIT

// // GET MESSAGES .THEN
// function getMessages() {
//   let messageObjects = [];
//   console.log("INIT MESSAGE OBJECTS:");
//   console.log(messageObjects);
//   console.log("START getMessages");
//   pool
//     .query("SELECT * FROM messages order by date asc")
//     .then((results) => {
//       messageObjects = results.rows;
//       console.log("GET MESSAGE OBJECTS:");
//       console.log(messageObjects);
//       // results.rows;
//     })
//     .catch((err) => console.error("Error executing query", err.stack))
//     .finally(() => {
//       console.log("FINALLY MESSAGE OBJECTS");
//       messageObjects.forEach((message) => {
//         let date = message.date;
//         messages.push(
//           JSON.stringify({
//             date: date,
//             direction: message.direction,
//             twilio_number: message.twilio_number,
//             mobile: message.mobile,
//             body: message.body,
//           })
//         );
//       });
//       console.log(messages);
//     });
// }
// // END GET MESSAGES .THEN

// // TWILIO GET MESSAGES API
// function twilioGetMessages() {
//   const apiUrl =
//     "https://api.twilio.com/2010-04-01/Accounts/" +
//     twilio_account_sid +
//     "/Messages.json?PageSize=" +
//     limit;
//   const requestOptions = {
//     method: "GET",
//     headers: {
//       Authorization: basic_auth,
//     },
//   };
//   fetch(apiUrl, requestOptions)
//     // .then((response) => response.text())
//     .then((response) => response.json())
//     .then((result) => {
//       console.log("GET MESSAGES SUCCESS");
//       // console.log("result: " + JSON.stringify(result, undefined, 2));
//       messageObjects = result.messages.reverse();
//     })
//     .catch((error) => {
//       console.log("TWILIO GET MESSAGES CATCH:");
//       console.log(
//         ".catch JSON.stringify(error, undefined, 2): \n" +
//           JSON.stringify(error, undefined, 2)
//       );
//       console.log("error", error);
//     })
//     .finally(() => {
//       console.log("FINALLY");
//       // console.log("MESSAGE OBJECTS:");
//       // console.log(messageObjects);
//       messageObjects.forEach((message) => {
//         let direction = "outbound";
//         let twilio_number = message.from;
//         let mobile = message.to;
//         if (message.direction == "inbound") {
//           direction = "inbound";
//           twilio_number = message.to;
//           mobile = message.from;
//         }
//         the_date = new Date(message.date_created).toISOString();
//         messages.push(
//           JSON.stringify({
//             date: the_date,
//             direction: direction,
//             twilio_number: twilio_number,
//             mobile: mobile,
//             body: message.body,
//           })
//         );
//       });
//       console.log("FETCHED MESSAGES");
//       console.log(messages);
//     });
// }
// // END TWILIO GET MESSAGES API
