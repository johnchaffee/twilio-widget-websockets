const client = require("./client");
const app_host_name = process.env.APP_HOST_NAME || "localhost";

// POSTGRES DATABASE QUERIES
const { Pool } = require("pg");
let pool;
if (app_host_name === "localhost") {
  // App is hosted locally, connect to localhost
  pool = new Pool({
    host: "localhost",
    database: "widget",
    port: 5432,
  });
} else {
  // App is hosted on heroku, connect to heroku DATABASE_URL env variable
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

// CREATE MESSAGE
async function createMessage(request, response) {
  console.log("createMessage()");
  console.log(request);
  try {
    const {
      date_created,
      direction,
      twilio_number,
      mobile_number,
      conversation_id,
      body,
      media_url,
    } = request;
    const result = await pool.query(
      "INSERT INTO messages (date_created, direction, twilio_number, mobile_number, conversation_id, body, media_url) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        date_created,
        direction,
        twilio_number,
        mobile_number,
        conversation_id,
        body,
        media_url,
      ]
    );
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
  // Send messasge to websocket clients
  client.updateWebsocketClient(messageObject);
}

// CREATE OR UPDATE CONVERSATION
async function updateConversation(request, response) {
  console.log("updateConversation()");
  console.log(request);
  // Outgoing message or message read event, reset unread_count
  if (request.unread_count === 0) {
    try {
      const { date_updated, conversation_id, unread_count, status } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count, status) VALUES ($1, $2, $3, $4) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = conversations.unread_count + EXCLUDED.unread_count, status = EXCLUDED.status RETURNING unread_count, contact_name",
        [date_updated, conversation_id, unread_count, status]
      );
      console.log(result.rows[0]);
      conversationObject.unread_count = result.rows[0].unread_count;
      conversationObject.contact_name = result.rows[0].contact_name;
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Incoming message, increment unread_count
  else {
    try {
      const { date_updated, conversation_id, unread_count, status } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count, status) VALUES ($1, $2, $3, $4) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = conversations.unread_count + EXCLUDED.unread_count, status = EXCLUDED.status RETURNING unread_count, contact_name",
        [date_updated, conversation_id, unread_count, status]
      );
      console.log(result.rows[0].contact_name);
      conversationObject.unread_count = result.rows[0].unread_count;
      conversationObject.contact_name = result.rows[0].contact_name;
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Send conversation to websocket clients
  client.updateWebsocketClient(conversationObject);
}

// NAME CONVERSATION
async function nameConversation(request, response) {
  console.log("nameConversation()");
  console.log(request);
  try {
    const { contact_name, conversation_id } = request;
    const result = await pool.query(
      "UPDATE conversations SET contact_name = $1 WHERE conversation_id = $2",
      [contact_name, conversation_id]
    );
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
}

// ARCHIVE CONVERSATION
async function archiveConversation(request, response) {
  console.log("archiveConversation()");
  console.log(request);
  try {
    const { status, conversation_id } = request;
    const result = await pool.query(
      "UPDATE conversations SET status = $1 WHERE conversation_id = $2",
      [status, conversation_id]
    );
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
}

// DELETE MESSAGES
async function deleteMessages(request, response) {
  console.log("deleteMessages()");
  // Conversation status set to 'deleted' -> delete all associated messages
  try {
    const { conversation_id } = request;
    const result = await pool.query(
      "DELETE FROM messages WHERE conversation_id = $1",
      [conversation_id]
    );
  } catch (err) {
    console.error(err);
    // res.send("Error " + err);
  }
}

module.exports = {
  createMessage,
  updateConversation,
  nameConversation,
  deleteMessages,
  pool,
};
