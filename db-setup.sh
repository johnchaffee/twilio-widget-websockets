#!/bin/sh

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
  VALUES ('2021-11-18T22:18:14.000Z', 'outbound', '+18555080989', '+12065551212', '+18555080989;+12065551212', 'Outgoing message', 'https://demo.twilio.com/owl.png'), ('2021-11-18T22:14:00.000Z', 'inbound', '+18555080989', '+12065551212', '+18555080989;+12065551212', 'Reply from mobile', '');

-- Create conversations table
CREATE TABLE conversations (
  ID SERIAL PRIMARY KEY,
  date_updated VARCHAR(30),
  conversation_id VARCHAR UNIQUE,
  contact_name VARCHAR,
  unread_count SMALLINT,
  status VARCHAR(10),
);

-- Create sample conversation
INSERT INTO conversations (date_updated, conversation_id, contact_name, unread_count, status)
  VALUES ('2021-11-14T22:34:13.204Z', '+18555080989;+12065551212', 'Joe Smith', 2, 'open');

EOF
