const wsc = require("./server");
const Pool = require("pg").Pool;
const pool = new Pool({
  // user: 'me',
  // password: 'password',
  host: "localhost",
  database: "widget",
  port: 5432,
});

// // synchronous getMessages
// const getMessages = (request, response) => {
//   console.log("START getMessages");
//   pool.query(
//     "SELECT * FROM messages order by datesent asc",
//     (error, results) => {
//       if (error) {
//         throw error;
//       }
//       console.log(results.rows);
//       response.status(200).json(results.rows);
//     }
//   );
//   console.log("END getMessages");
// };

// // Promise.then getMessages
// const getMessages = (request, response) => {
//   console.log("START getMessages");
//   pool
//     .query("SELECT * FROM messages order by datesent asc")
//     .then((results) => {
//       console.log(results.rows);
//       response.status(200).json(results.rows);
//       console.log("END getMessages");
//     })
//     .catch((err) => console.error("Error executing query", err.stack))
//     .finally(() => {
//       console.log("FINALLY getMessages");
//     });
// };

// async/await getMessages
const getMessages = async function (request, response) {
  try {
    const result = await pool.query("SELECT * FROM messages order by datesent asc");
    response.status(200).json(result.rows);
    console.log(`rowCount: ${result.rowCount}`)
    console.log(result.rows)
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
};

// // async getUsers -> promise .then
// const getUsers = (request, response) => {
//   console.log("START getUsers");
//   pool
//     .query("SELECT * FROM users ORDER BY id ASC")
//     .then((results) => {
//       console.log(results.rows);
//       response.status(200).json(results.rows);
//       console.log("END getUsers");
//     })
//     .catch((err) => console.error("Error executing query", err.stack))
//     .finally(() => {
//       console.log("FINALLY getUsers");
//     });
// };

// synchronous getUsers
function getUsers(request, response) {
  console.log("BEGIN getUsers");
  pool.query("SELECT * FROM users ORDER BY id ASC", (error, results) => {
    if (error) {
      throw error;
    }
    console.log(results.rows);
    // data
    // results.rows
    response.status(200).json(results.rows);
  });
  console.log("END getUsers");
}

const getUserById = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query("SELECT * FROM users WHERE id = $1", [id], (error, results) => {
    if (error) {
      throw error;
    }
    response.status(200).json(results.rows);
  });
};

const createUser = (request, response) => {
  const { name, email } = request.body;

  pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
    [name, email],
    (error, results) => {
      if (error) {
        throw error;
      }
      console.log(results);
      console.log(results.rows);
      console.log(results.rows[0].id);
      response.status(201).send(`User added with ID: ${results.rows[0].id}`);
    }
  );
};

const updateUser = (request, response) => {
  const id = parseInt(request.params.id);
  const { name, email } = request.body;

  pool.query(
    "UPDATE users SET name = $1, email = $2 WHERE id = $3",
    [name, email, id],
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).send(`User modified with ID: ${id}`);
    }
  );
};

const deleteUser = (request, response) => {
  const id = parseInt(request.params.id);

  pool.query("DELETE FROM users WHERE id = $1", [id], (error, results) => {
    if (error) {
      throw error;
    }
    response.status(200).send(`User deleted with ID: ${id}`);
  });
};

module.exports = {
  getMessages,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
