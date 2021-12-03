require("dotenv").config();
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

let twilio_number = process.env.TWILIO_NUMBER;
const facebook_messenger_id = process.env.FACEBOOK_MESSENGER_ID;
const whatsapp_id = process.env.WHATSAPP_ID;
const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
const buf = Buffer.from(twilio_account_sid + ":" + twilio_auth_token);
const encoded = buf.toString("base64");
const basic_auth = "Basic " + encoded;

// SEND OUTGOING MESSAGE
// Web client posts '/messagesend' request to this server, which posts request to Twilio API
router.post("/", (req, res, next) => {
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

module.exports = router;