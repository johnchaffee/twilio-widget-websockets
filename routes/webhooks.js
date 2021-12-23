require("dotenv").config()
const express = require("express")
const router = express.Router()
const axios = require("axios").default
const db = require("../database")
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN
const auth_header =
  "Basic " +
  Buffer.from(twilio_account_sid + ":" + twilio_auth_token).toString("base64")

// TWILIO EVENT STREAMS WEBHOOKS
// Listen for incoming and outgoing messages
router.post("/", (req, res, next) => {
  console.log("/twilio-event-streams WEBHOOK")
  let media = 0
  let delay = 5 // delay before fetching media_url
  // Get first array object in request body
  let requestBody = req.body[0]
  let sender = requestBody.data.from
  if (sender.slice(0, 9) == "messenger" || sender.slice(0, 8) == "whatsapp") {
    delay = 1
  }

  // Fetch body
  async function getBody() {
    const getBodyConfig = {
      url: `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}.json`,
      method: "get",
      headers: {
        Authorization: auth_header,
      },
    }
    console.log("getBodyConfig()")
    const response = await axios(getBodyConfig)
    console.log("RESPONSE.DATA")
    console.log(response.data)
    media = response.data.num_media
    console.log(`MEDIA: ${media}`)
    // Set messageObject and conversationObject properties, reset unread_count: 0
    messageObject = {
      type: "messageCreated",
      date_created: new Date(response.data.date_created).toISOString(),
      direction: "outbound",
      twilio_number: response.data.from,
      mobile_number: response.data.to,
      conversation_id: `${response.data.from};${response.data.to}`,
      body: response.data.body,
    }
    conversationObject = {
      type: "conversationUpdated",
      date_updated: new Date(response.data.date_created).toISOString(),
      conversation_id: `${response.data.from};${response.data.to}`,
      unread_count: 0,
      status: "open",
    }
  }
  
  // Fetch media url
  async function getMediaUrl() {
    const getMediaConfig = {
      url: `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.data.messageSid}/Media.json`,
      method: "get",
      headers: {
        Authorization: auth_header,
      },
    }
    console.log("getMediaUrl()")
    // Wait x seconds before fetching media list to avoid race condition
    console.log(`start ${delay} second timer`)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    console.log(`after ${delay} second timer`)
    const response = await axios(getMediaConfig)
    console.log("RESPONSE: ", response)
    // if media_list > 0 set messageObject.media_url property
    let media_url = ""
    if (response.data.media_list.length > 0) {
      media_url =
        `https://api.twilio.com${response.data.media_list[0].uri}`.replace(
          ".json",
          ""
        )
      messageObject.media_url = media_url
    }
    console.log("getMediaUrl(): ", media_url)
  }

  // INCOMING WEBHOOK
  if (requestBody.type == "com.twilio.messaging.inbound-message.received") {
    console.log("INBOUND WEBHOOK")
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
    }
    conversationObject = {
      type: "conversationUpdated",
      date_updated: requestBody.data.timestamp,
      conversation_id: `${requestBody.data.to};${requestBody.data.from}`,
      unread_count: 1,
      status: "open",
    }
    if (requestBody.data.numMedia > 0) {
      console.log("NUM MEDIA > 0")
      // if nuMedia > 0, fetch the mediaUrl and add it to the messageObject
      getMediaUrl()
        .then(() => {
          db.createMessage(messageObject)
          db.updateConversation(conversationObject)
        })
        .catch((error) => {
          console.log("getMediaUrl() CATCH")
          console.log(error.message)
          // error.message;
        })
    } else {
      // There is no medialUrl, send the default messageObject and conversationObject
      db.createMessage(messageObject)
      db.updateConversation(conversationObject)
    }
  }
  // OUTGOING WEBHOOK
  else if (requestBody.type == "com.twilio.messaging.message.sent") {
    console.log("OUTBOUND WEBHOOK")
    getBody()
      .then(() => {
        if (media > 0) {
          // if nuMedia > 0, fetch the mediaUrl and add  it to the messageObject
          getMediaUrl()
            .then(() => {
              db.createMessage(messageObject)
              db.updateConversation(conversationObject)
            })
            .catch((error) => {
              console.log("getMediaUrl() CATCH")
              console.log(error.message)
              // error.message;
            })
        } else {
          db.createMessage(messageObject)
          db.updateConversation(conversationObject)
        }
      })
      .catch((error) => {
        console.log("getMessageBody() CATCH")
        console.log(error.message)
        // error.message;
      })
  }
  res.sendStatus(200)
})

module.exports = router
