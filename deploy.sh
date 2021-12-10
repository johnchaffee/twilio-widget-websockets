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

-- Create sample messages
INSERT INTO messages (date_created, direction, twilio_number, mobile_number, conversation_id, body, media_url)
  VALUES ('2021-11-18T22:15:00.000Z', 'inbound', '+18555080989', '+12065551212', '+18555080989;+12065551212', 'How do you draw an owl?', null), ('2021-11-18T22:16:14.000Z', 'outbound', '+18555080989', '+12065551212', '+18555080989;+12065551212', 'Like this!', 'https://demo.twilio.com/owl.png');

-- Create conversations table
CREATE TABLE conversations (
  ID SERIAL PRIMARY KEY,
  date_updated VARCHAR(30),
  conversation_id VARCHAR UNIQUE,
  contact_name VARCHAR,
  unread_count SMALLINT,
  status VARCHAR(10)
);

-- Create sample conversation
INSERT INTO conversations (date_updated, conversation_id, contact_name, unread_count, status)
  VALUES ('2021-11-14T22:34:13.204Z', '+18555080989;+12065551212', 'Joe Smith', 2, 'open');

EOF

# Create Twilio Event Streams webhooks endpoint

SINKCONFIGURATION=$(cat << EOF
{
    "batch_events": false,
    "destination": "https://$APP_HOST_NAME.herokuapp.com/twilio-event-streams",
    "method": "post"
}
EOF
)

SID=`curl -X POST https://events.twilio.com/v1/Sinks \
--data-urlencode "Description=$APP_HOST_NAME Webhooks" \
--data-urlencode "SinkConfiguration=$SINKCONFIGURATION" \
--data-urlencode "SinkType=webhook" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN`

# Extract the SinkSid

SINK_SID=`echo $SID | grep -o "sid\": \"\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w\w" | cut -c8-`

# Create the subscriptions

curl -X POST https://events.twilio.com/v1/Subscriptions \
--data-urlencode "Description=\"Subscribe to 'sent' and 'received' messaging events\"" \
--data-urlencode "Types={\"type\": \"com.twilio.messaging.message.sent\", \"schema_version\": 1}" \
--data-urlencode "Types={\"type\": \"com.twilio.messaging.inbound-message.received\", \"schema_version\": 1}" \
--data-urlencode "SinkSid=$SINK_SID" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN