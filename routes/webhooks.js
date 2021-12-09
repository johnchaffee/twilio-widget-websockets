require("dotenv").config();
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const db = require("../database");
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
const auth_header =
  "Basic " +
  Buffer.from(twilio_account_sid + ":" + twilio_auth_token).toString("base64");

// TWILIO EVENT STREAMS WEBHOOKS
// Listen for incoming and outgoing messages
router.post("/", (req, res, next) => {
  console.log("/twilio-event-streams WEBHOOK");
  // Get first array object in request body
  let requestBody = req.body[0];
  let delay = 1; // delay before fetching media_url

  // Fetch message body
  async function getMessageBody(apiUrl, requestOptions) {
    console.log("getMessageBody()");
    const response = await fetch(apiUrl, requestOptions);
    const result = await response.json();
    return result;
  }

  // Fetch media url
  async function getMediaUrl(apiUrl, requestOptions, delay) {
    console.log("getMediaUrl()");
    // Wait 1 second before fetching media list to avoid race condition
    console.log(`start ${delay} second timer`);
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    console.log(`after ${delay} second timer`);
    const response = await fetch(apiUrl, requestOptions);
    const result = await response.json();
    // if media_list > 0 set messageObject.media_url property
    if (result.media_list.length > 0) {
      const media_url =
        `https://api.twilio.com${result.media_list[0].uri}`.replace(
          ".json",
          ""
        );
      messageObject.media_url = media_url;
    }
    console.log("getMediaUrl() RESULT:");
    console.log(result);
    // console.log("const result = await response.json()");
    // console.log(result);
    return result;
  }

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
      status: "open",
    };
    if (requestBody.data.numMedia > 0) {
      // if nuMedia > 0, fetch the mediaUrl and add  it to the messageObject
      const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}/Media.json`;
      const requestOptions = {
        method: "GET",
        headers: {
          Authorization: auth_header,
        },
      };
      getMediaUrl(apiUrl, requestOptions, delay)
        .then((result) => {
          db.createMessage(messageObject);
          db.updateConversation(conversationObject);
        })
        .catch((error) => {
          console.log("getMediaUrl() CATCH");
          console.log(error.message);
          // error.message;
        });
    } else {
      // There is no medialUrl, send the default messageObject and conversationObject
      db.createMessage(messageObject);
      db.updateConversation(conversationObject);
    }
  }
  // OUTGOING WEBHOOK
  else if (requestBody.type == "com.twilio.messaging.message.sent") {
    console.log("OUTBOUND WEBHOOK");
    let media = 0;
    let sender = requestBody.data.from;
    // If outgoing message, the body does not exist in payload and must be fetched
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}.json`;
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: auth_header,
      },
    };
    getMessageBody(apiUrl, requestOptions)
      .then((result) => {
        // console.log("getMessageBody() THEN -> RESULT");
        console.log(result);
        media = result.num_media;
        console.log(`MEDIA: ${media}`);
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
          status: "open",
        };
      })
      .then(() => {
        if (media > 0) {
            // whatsapp and messenger API access to media_url is fast, don't change 1 second delay
            if (
            sender.slice(0, 9) !== "messenger" &&
            sender.slice(0, 8) !== "whatsapp"
          ) {
            // MMS API access to media_url is delayed, wait 4 seconds before fetching
            delay = 4;
          }
          // if nuMedia > 0, fetch the mediaUrl and add  it to the messageObject
          const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}/Media.json`;
          const requestOptions = {
            method: "GET",
            headers: {
              Authorization: auth_header,
            },
          };
          getMediaUrl(apiUrl, requestOptions, delay)
            .then((result) => {
              db.createMessage(messageObject);
              db.updateConversation(conversationObject);
            })
            .catch((error) => {
              console.log("getMediaUrl() CATCH");
              console.log(error.message);
              // error.message;
            });
        } else {
          db.createMessage(messageObject);
          db.updateConversation(conversationObject);
        }
      })
      .catch((error) => {
        console.log("getMessageBody() CATCH");
        console.log(error.message);
        // error.message;
      });
  }
  res.sendStatus(200);
});

module.exports = router;
