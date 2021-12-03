// POSTGRES DATABASE QUERIES
const Pool = require("pg").Pool;
const pool = new Pool({
  // user: 'me',
  // password: 'password',
  host: "localhost",
  database: "widget",
  port: 5432,
});

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
  updateWebsocketClient(messageObject);
}

// UPDATE CONVERSATION
async function updateConversation(request, response) {
  console.log("updateConversation()");
  // Outgoing message or message read event, reset unread_count
  if (request.unread_count === 0) {
    try {
      const { date_updated, conversation_id, unread_count } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = EXCLUDED.unread_count",
        [date_updated, conversation_id, unread_count]
      );
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Incoming message, increment unread_count
  else {
    try {
      const { date_updated, conversation_id, unread_count } = request;
      const result = await pool.query(
        "INSERT INTO conversations (date_updated, conversation_id, unread_count) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET date_updated = EXCLUDED.date_updated, unread_count = conversations.unread_count + EXCLUDED.unread_count",
        [date_updated, conversation_id, unread_count]
      );
    } catch (err) {
      console.error(err);
      // res.send("Error " + err);
    }
  }
  // Send conversation to websocket clients
  updateWebsocketClient(conversationObject);
}

module.exports = {
  createMessage,
  updateConversation,
  pool,
};

// module.exports.createMessage = createMessage;
// module.exports.updateConversation = updateConversation;
