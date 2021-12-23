#!/bin/sh

# Create Postgres database tables and sample records

psql $DATABASE_URL << EOF

-- Create messages table
CREATE TABLE messages (
  ID SERIAL PRIMARY KEY,
  date_created VARCHAR(30),
  direction VARCHAR(10),
  twilio_number VARCHAR(40),
  mobile_number VARCHAR(40),
  conversation_id VARCHAR,
  body text,
  media_url VARCHAR
);

-- Create conversations table
CREATE TABLE conversations (
  ID SERIAL PRIMARY KEY,
  date_updated VARCHAR(30),
  conversation_id VARCHAR UNIQUE,
  contact_name VARCHAR,
  unread_count SMALLINT,
  status VARCHAR(10)
);

EOF

# Create Twilio Incoming Webhook for phone number

PHONE_METADATA=`curl "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?Beta=false&PhoneNumber=$TWILIO_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN`

PHONE_SID=`echo $PHONE_METADATA | grep -o "sid\": \"PN\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w" | cut -c8-`

curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$PHONE_SID.json" \
--data-urlencode "SmsUrl=https://$APP_HOST_NAME.herokuapp.com/twilio-webhook" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN


# # Create Twilio Event Streams webhooks endpoint

# SINKCONFIGURATION=$(cat << EOF
# {
#     "batch_events": false,
#     "destination": "https://$APP_HOST_NAME.herokuapp.com/twilio-event-streams",
#     "method": "post"
# }
# EOF
# )

# SID=`curl -X POST https://events.twilio.com/v1/Sinks \
# --data-urlencode "Description=$APP_HOST_NAME Webhooks" \
# --data-urlencode "SinkConfiguration=$SINKCONFIGURATION" \
# --data-urlencode "SinkType=webhook" \
# -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN`

# # Extract the SinkSid

# SINK_SID=`echo $SID | grep -o "sid\": \"\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w" | cut -c8-`

# # Create the subscriptions

# curl -X POST https://events.twilio.com/v1/Subscriptions \
# --data-urlencode "Description=\"Subscribe to 'sent' and 'received' messaging events\"" \
# --data-urlencode "Types={\"type\": \"com.twilio.messaging.message.sent\", \"schema_version\": 1}" \
# --data-urlencode "Types={\"type\": \"com.twilio.messaging.inbound-message.received\", \"schema_version\": 1}" \
# --data-urlencode "SinkSid=$SINK_SID" \
# -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN


