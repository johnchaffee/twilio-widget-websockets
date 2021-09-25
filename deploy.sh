#!/bin/sh

if [[ $PLATFORM = "TWILIO" ]]
then
  echo "TWILIO"
  # Send text message once service is deployed
  curl --location --request POST "https://$APP_HOST_NAME.herokuapp.com/messagesend" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "body=Twilio Chat app successfully deployed! To complete the setup process, you must configure your Twilio phone number to POST a Webhook when a message comes in to https://$APP_HOST_NAME.herokuapp.com/twilio."
elif [[ $PLATFORM = "ZIPWHIP" ]]
then 
  echo "ZIPWHIP"
  # Register a receive webhook
  curl --location --request POST "https://api.zipwhip.com/webhook/add" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "session=$ZIPWHIP_SESSION" \
  --data-urlencode "type=message" \
  --data-urlencode "event=receive" \
  --data-urlencode "url=https://$APP_HOST_NAME.herokuapp.com/receive"

  # Send confirmation message that service was deployed
  curl --location --request POST "https://api.zipwhip.com/message/send" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "session=$ZIPWHIP_SESSION" \
  --data-urlencode "contacts=$MOBILE" \
  --data-urlencode "body=Webhooks successfully configured for https://$APP_HOST_NAME.herokuapp.com"
else
  echo "$PLATFORM does not match TWILIO or ZIPWHIP"
fi
