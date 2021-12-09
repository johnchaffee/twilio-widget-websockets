#!/bin/sh

# Send text message once service is deployed
curl -X POST \
"https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages" \
-u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
-d "From=$TWILIO_NUMBER" \
-d "To=$MY_MOBILE_NUMBER" \
-d "Body=Twilio Conversation Widget app successfully deployed! To complete the setup process, you must configure your Twilio phone number to POST Event Stream Webhooks to https://$APP_HOST_NAME.herokuapp.com/event-streams."
