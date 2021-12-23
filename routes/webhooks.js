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

// TWILIO WEBHOOK
router.post("/", (req, res, next) => {
  console.log("/TWILIO-WEBHOOK")
  console.log("REQ BODY")
  console.log(req.body)
  let requestBody = req.body

  // INCOMING WEBHOOK
  if (requestBody.SmsStatus == "received") {
    console.log("INBOUND WEBHOOK")
    // If incoming message, the body and media url already exist in payload
    // Set messageObject and conversationObject properties, unread_count: 1
    messageObject = {
      type: "messageCreated",
      date_created: new Date().toISOString(),
      direction: "inbound",
      twilio_number: requestBody.To,
      mobile_number: requestBody.From,
      conversation_id: `${requestBody.To};${requestBody.From}`,
      body: requestBody.Body,
    }
    conversationObject = {
      type: "conversationUpdated",
      date_updated: new Date().toISOString(),
      conversation_id: `${requestBody.To};${requestBody.From}`,
      unread_count: 1,
      status: "open",
    }
    if (parseInt(requestBody.NumMedia) > 0) {
      console.log("NUM MEDIA > 0")
      messageObject.media_url = requestBody.MediaUrl0
    }
    db.createMessage(messageObject)
    db.updateConversation(conversationObject)
  }
  // OUTGOING WEBHOOK
  // If outgoing message, must fecth body and media_url
  else if (requestBody.SmsStatus == "sent") {
    console.log("OUTBOUND WEBHOOK")

    let media = 0
    let delay = 5 // delay before fetching media_url
    if (
      requestBody.From.slice(0, 9) == "messenger" ||
      requestBody.From.slice(0, 8) == "whatsapp"
    ) {
      delay = 1
    }

    // Fetch body
    async function getBody() {
      const getBodyConfig = {
        url: `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.MessageSid}.json`,
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
        url: `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages/${requestBody.MessageSid}/Media.json`,
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
      console.log("RESPONSE.DATA: ", response.data)
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

    getBody()
      .then(() => {
        // if nuMedia > 0, fetch the mediaUrl and add  it to the messageObject
        if (media > 0) {
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
  // res.sendStatus(200)
  res.send("<Response></Response>")
})

module.exports = router
