require("dotenv").config();
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const db = require("../database");

let twilio_number = process.env.TWILIO_NUMBER;
const facebook_messenger_id = process.env.FACEBOOK_MESSENGER_ID;
const whatsapp_id = process.env.WHATSAPP_ID;
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
const buf = Buffer.from(twilio_account_sid + ":" + twilio_auth_token);
const encoded = buf.toString("base64");
const basic_auth = "Basic " + encoded;
const limit = process.env.LIMIT;

// When client connects or clicks on a conversation, reset conversation count and fetch messages for selected conversation
// conversations array and messages array will each be sent via socketClient.send();
router.get("/", (req, res) => {
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
      res.status(500).send({ error: "An error occurred" });
    });
  // Mark messages as read when clicking on conversation
  async function resetConversationCount(conversation_id) {
    console.log("resetConversationCount()");
    try {
      console.log("TRY")
      const result = await db.pool.query(
        "UPDATE conversations SET unread_count = $1 WHERE conversation_id = $2",
        [0, conversation_id]
      );
      console.log("END TRY")
    } catch (err) {
      console.log("CATCH")
      console.error(err);
      // res.send("Error " + err);
    }
    console.log("END")
    // Send conversation to websocket clients
    // TODO Uncomment line below once websocket client is in a module
    // updateWebsocketClient(conversationObject);
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

module.exports = router;
