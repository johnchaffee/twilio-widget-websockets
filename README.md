# Twilio Widget

## How it works

This application creates a chat interface for a Twilio text-enabled number to send and receive messages to/from a mobile phone. It uses the Twilio Programmable Messaging API to send messages, Event Streams Webhooks for incoming/outgoing messages, and Websockets to communicate with the chat client in the web browser.

You can run locally or deploy to heroku.

## Features

- Chat client built in vanilla html/javascript based on this [Codepen sample UI](https://codepen.io/sajadhsm/pen/odaBdd)
- Chat client connects to [Websocket](https://npm.im/ws) server to receive messages
- Chat client sends text messages via Twilio Programmable Messaging API
- Chat client also supports Facebook Messenger and WhatsApp messages via Twilio Channels API
- Node http server receives Twilio Event Streams Webhooks for incoming and outgoing text messages
- Node http server forwards Webhook messages to Websocket server
- Node Websocket server broadcasts messages to chat client(s)
- One click deploy button for [Heroku](https://heroku.com)

## Set up

### Requirements

- [Node.js](https://nodejs.org/)
- [Twilio account](https://twilio.com)

### Local development

After the above requirements have been met:

1.  Clone this repository and `cd` into it

    ```bash
    git clone git@github.com:johnchaffee/twilio-conversations-widget.git
    cd twilio-conversations-widget
    ```

2.  Install dependencies

    ```bash
    npm install
    ```

3.  Create a `.env` file in your root directory and enter the environment variables below.

    ```
    PORT=3000
    NODE_ENV=development
    APP_HOST_NAME=localhost
    TWILIO_NUMBER=<Your Twilio Phone Number>
    TWILIO_ACCOUNT_SID=<Your Twilio Account SID>
    TWILIO_AUTH_TOKEN=<Your Twilio Auth Token>
    ```

4.  Run the application

    ```bash
    npm start
    ```

    Your application is now accessible at [http://localhost:3000](http://localhost:3000/)

5.  Make the application visible to the outside world.

    Your application needs to be accessible at a public internet address for Webhooks to be able to connect with it. You can do that in different ways, [deploying the app to heroku](#cloud-deployment) or using [ngrok](https://ngrok.com/) to create a tunnel to your local server.

    If you have ngrok installed, you can open a tunnel to your local server by running the following command:

    ```
    ngrok http 3000
    ```

    Now your application should be available at a url like:

    ```
    https://<unique_id>.ngrok.io/
    ```

6.  Create [Event Streams](https://www.twilio.com/docs/events) webhook for incoming messages. You'll need to point it to the ngrok and/or heroku url above.

```
twilio api:events:v1:sinks:create --description "twilio-messaging.herokuapp.com webhooks" \
--sink-configuration '{"destination":"https://twilio-widget.herokuapp.com/twilio-event-streams","method":"POST","batch_events":false}' \
--sink-type webhook
```

```
twilio api:events:v1:subscriptions:create \
  --description "Subscribe to 'sent' and 'received' messaging events" \
  --sink-sid <EVENT STREAM SID> \
  --types '{"type":"com.twilio.messaging.message.sent","schema_version":1}' \
  --types '{"type":"com.twilio.messaging.inbound-message.received","schema_version":1}'
```

That's it! Now you can start sending and receiving messages text messages in the chat client.

## Data Model

### messages table

```
 id | conversation_id           | twilio_number | mobile_number |       date_created       | direction | body
----+---------------------------+---------------+---------------+--------------------------+------------------------------
 53 | +18555080989;+12063996576 | +18555080989  | +12063996576  | 2021-11-16T23:27:23.000Z | outbound  | hey, how's it going?
 54 | +18555080989;+12063996576 | +18555080989  | +12063996576  | 2021-11-16T23:27:34.000Z | inbound   | pretty good. how are you?
 55 | +18555080989;+12063996576 | +18555080989  | +12063996576  | 2021-11-16T23:27:40.000Z | outbound  | I'm fine. Thanks for asking.
```

```json
[
  {
    "conversation_id": "+18555080989;+12063996576",
    "dateCreated": "2021-11-14T22:34:13.204Z",
    "direction": "outbound",
    "twilio_number": "+18555080989",
    "mobile_number": "+12063996576",
    "body": "hey, how's it going?"
  }
]
```

### conversations table

```
 id |conversation_id            |           date_updated           |     name     | unread_count
----+---------------------------+--------------------------+--------------+-------------
 53 | +18555080989;+12063996576 | 2021-11-16T23:27:23.000Z | John Chaffee | 2
 54 | +18555080989;+12063693826 | 2021-11-16T23:27:23.000Z | Lani Gray    | 0
 55 | +18555080989;+12065551212 | 2021-11-16T23:27:23.000Z | Bob Smith    | 1
```

```json
[
  {
    "conversation_id": "+18555080989;+12063996576",
    "date_updated": "2021-11-16T23:27:23.000Z",
    "name": "John Chaffee",
    "unread_count": 2
  }
]
```

## Configure Postgres database on localhost

```sql

-- launch postgres
psql postgres

-- List databases
postgres-# \l

                                         List of databases
          Name           |  Owner   | Encoding |   Collate   |    Ctype    |   Access privileges
-------------------------+----------+----------+-------------+-------------+-----------------------
 api                     | me       | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 bookie_development      | jchaffee | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 node_getting_started    | jchaffee | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 postgres                | jchaffee | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 textblaster_development | jchaffee | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 widget                  | jchaffee | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
(6 rows)

-- Create widget database
CREATE DATABASE widget;

-- Connect to widget database
\c widget;

-- Create messages table
CREATE TABLE messages (
  ID SERIAL PRIMARY KEY,
  date_created VARCHAR(30),
  direction VARCHAR(10),
  twilio_number VARCHAR(40),
  mobile_number VARCHAR(40),
  conversation_id VARCHAR,
  body text
);

-- Create message
INSERT INTO messages (date_created, direction, twilio_number, mobile_number, body)
  VALUES ('2021-11-14T22:34:13.204Z', 'outbound', '+18555080989', '+12063996576', 'Outgoing message'), ('2021-11-14T22:34:17.934Z', 'inbound', '+18555080989', '+12063996576', 'Reply from mobile');

-- Fetch all messages
SELECT * FROM messages order by date_created desc;

 id  |       date_created       | direction | twilio_number | mobile_number |  body  |    conversation_id
-----+--------------------------+-----------+---------------+---------------+--------+--------------------------
 203 | 2021-11-18T22:10:47.000Z | outbound  | +18555080989  | +12068163598  | hello  | +18555080989;+12068163598
 205 | 2021-11-18T22:14:00.000Z | outbound  | +18555080989  | +12068163598  | five   | +18555080989;+12068163598
 207 | 2021-11-18T22:18:14.000Z | outbound  | +18555080989  | +12068163598  | seven  | +18555080989;+12068163598


-- Create conversations table
CREATE TABLE conversations (
  ID SERIAL PRIMARY KEY,
  date_updated VARCHAR(30),
  conversation_id VARCHAR UNIQUE,
  contact_name VARCHAR,
  unread_count SMALLINT
);

-- Create conversation
INSERT INTO conversations (date_updated, conversation_id, contact_name, unread_count)
  VALUES ('2021-11-14T22:34:13.204Z', '+18555080989;+12063996576', 'John Chaffee', 2), ('2021-11-14T22:35:13.204Z', '+18555080989;+12063693826', 'Lani Chaffee', 0), ('2021-11-14T22:33:13.204Z', '+18555080989;+12065551212', 'Bob Smith', 1);

-- Fetch all conversations
SELECT * FROM conversations order by date_updated desc;

 id |     date_updated         |      conversation_id      | contact_name | unread_count
----+--------------------------+---------------------------+--------------+--------------
  2 | 2021-11-14T22:35:13.204Z | +18555080989;+12063693826 | Lani Chaffee |            0
  1 | 2021-11-14T22:34:13.204Z | +18555080989;+12063996576 | John Chaffee |            2
  3 | 2021-11-14T22:33:13.204Z | +18555080989;+12065551212 | Bob Smith    |            1


-- Sample queries

INSERT INTO conversations (conversation_id, date_updated, unread_count)
VALUES ('+18555080989;+12068881235','2021-11-14T22:34:15.204Z', 1)
ON CONFLICT (conversation_id)
DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = conversations.unread_count + 1;

ALTER TABLE messages ADD COLUMN conversation_id VARCHAR;

ALTER TABLE messages ADD COLUMN media_url VARCHAR;

ALTER TABLE conversations ADD UNIQUE (conversation_id);

ALTER TABLE conversations RENAME COLUMN updated_at TO date_updated;

ALTER TABLE messages RENAME COLUMN mobile TO mobile_number;
```

## Configure Postgres database on heroku

```sql
// TBD
```

## Cloud deployment

As an alternative to running the app locally, you can deploy it to heroku by clicking the button below.

<a href="https://heroku.com/deploy?template=https://github.com/johnchaffee/twilio-chat-websockets">
  <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy">
</a>

Note: When deploying to heroku, you will be prompted to enter several environment variables as described below.

- `APP_HOST_NAME` - The subdomain for your app on heroku. For example, enter `my-cool-app` to create an app hosted at `https://my-cool-app.herokuapp.com`.
- `MOBILE` - A default mobile phone number to send messages to in E.164 format (e.g. `+12065551212`).
- `TWILIO_NUMBER` - Your Twilio phone number to send messages from in E.164 format (e.g. `+12065551212`).
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

<!-- ### Requirements

- [Node.js](https://nodejs.org/)
- A Twilio account - [sign up](https://www.twilio.com/try-twilio)

### Twilio Account Settings

This application should give you a ready-made starting point for writing your
own conversations application. Before we begin, we need to collect
all the config values we need to run the application:

| Config&nbsp;Value | Description                                                                                                                                                  |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account&nbsp;Sid  | Your primary Twilio account identifier - find this [in the Console](https://www.twilio.com/console).                                                         |
| Auth&nbsp;Token   | Used to authenticate - [just like the above, you'll find this here](https://www.twilio.com/console).                                                         |
| Phone&nbsp;number | A Twilio phone number in [E.164 format](https://en.wikipedia.org/wiki/E.164) - you can [get one here](https://www.twilio.com/console/phone-numbers/incoming) |

### Local development

After the above requirements have been met:

1. Clone this repository and `cd` into it

   ```bash
   git clone git@github.com:twilio-labs/sample-conversations-masked-numbers.git
   cd sample-conversations-masked-numbers
   ```

1. Install dependencies

   ```bash
   npm install
   ```

1. Set your environment variables

   ```bash
   npm run setup
   ```

   See [Twilio Account Settings](#twilio-account-settings) to locate the necessary environment variables.

1. Run the application

   ```bash
   npm start
   ```

   Alternatively, you can use this command to start the server in development mode. It will reload whenever you change any files.

   ```bash
   npm run dev
   ```

   Your application is now accessible at [http://localhost:3000](http://localhost:3000/)

1. Make the application visible from the outside world.

   Your application needs to be accessible in a public internet address for Twilio to be able to connect with it. You can do that in different ways, [deploying the app to a public provider](#cloud-deployment) or using [ngrok](https://ngrok.com/) to create a tunnel to your local server.

   If you have ngrok installed to open a tunnel to you local server run the following command

   ```
   ngrok http 3000
   ```

   Now your application should be available in a url like:

   ```
   https://<unique_id>.ngrok.io/
   ```

That's it! Now you can start adding phone numbers to the conversation.

### Tests

You can run the tests locally by typing:

```bash
npm test
```

### Cloud deployment

Additionally to trying out this application locally, you can deploy it to a variety of host services. Here is a small selection of them.

Please be aware that some of these might charge you for the usage or might make the source code for this application visible to the public. When in doubt research the respective hosting service first.

| Service                           |                                                                                                                                                                                                                                        |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Heroku](https://www.heroku.com/) | [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/twilio-labs/sample-conversations-masked-numbers/tree/master)                                                            |
| [Glitch](https://glitch.com)      | [![Remix on Glitch](https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg)](https://glitch.com/edit/#!/remix/clone-from-repo?REPO_URL=https://github.com/twilio-labs/sample-conversations-masked-numbers.git) |

## Resources

- [Twilio Conversation Quickstart](https://www.twilio.com/docs/conversations/quickstart)
- [Create a conversation with the API](https://www.twilio.com/docs/conversations/api/conversation-resource)
- [Add participants to a conversation with the API](https://www.twilio.com/docs/conversations/api/conversation-participant-resource)

## Contributing

This application is open source and welcomes contributions. All contributions are subject to our [Code of Conduct](https://github.com/twilio-labs/.github/blob/master/CODE_OF_CONDUCT.md).

[Visit the project on GitHub](https://github.com/twilio-labs/sample-template-nodejs)

## License

[MIT](http://www.opensource.org/licenses/mit-license.html)

## Disclaimer

No warranty expressed or implied. Software is as is.

[twilio]: https://www.twilio.com -->
