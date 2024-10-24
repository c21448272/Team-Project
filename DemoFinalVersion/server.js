var express = require("express");
var session = require("express-session");
var bcrypt = require('bcrypt');
var bodyParser = require("body-parser");
var { Pool } = require("pg");
var path = require("path");
var app = express();
var saltRounds = 10;
var myPlaintextPassword = 'user_password';
//Will need to change this to your database details for postgres
//Aarons database
 var pool = new Pool({
     user: "postgres",
     host: "localhost",
     database: "postgres",
     password: "samuelO11",
     port: 54321,
   });

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
  }));
  

// Attempt to connect to the database
pool.connect()
  .then(() => {
    console.log('Connected to the database');
    // Start the Express server only if the database connection is successful
    startServer();
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });

// Function to start the Express server
function startServer() {
  // Parse JSON bodies for POST, PUT, and DELETE requests
  app.use(bodyParser.json());

  // Serve the HTML file
  app.get("/", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "main.html"));
  });
  app.get("/transactions", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "transactions.html"));
  });
  app.get("/savings", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "savings.html"));
  });
  app.get("/settings", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "settings.html"));
  });
  app.get("/login", function (req, res) {
    res.sendFile(path.join(__dirname, "login.html"));
  });
  app.get("/signup", function (req, res) {
    res.sendFile(path.join(__dirname, "SignUp.html"));
  });
  app.get("/add_transactions", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "add_transactions.html"));
  });
  app.get("/add_savings", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "add_savings.html"));
  });
  app.get("/view_transaction", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "view_transaction.html"));
  });
  app.get("/edit_transaction", authenticateUser, function (req, res) {
    res.sendFile(path.join(__dirname, "edit_transaction.html"));
  });
  
  function authenticateUser(req, res, next) {
    // If the user is authenticated (user ID is stored in the session), proceed to the next middleware
    if (req.session.userId) {
      return next();
    } else {
      // If not authenticated, redirect to the login page or send an unauthorized response
      res.sendFile(path.join(__dirname, "login.html"));
    }
  }
  
  //route for logout of sessions and users
  app.get("/logout", async (req, res) => {
    try {
		const client = await pool.connect();
		
		//Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                res.status(500).send("Internal Server Error");
            } else {
                res.redirect("/login");
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
  //needs to be edited for user table for app
  app.get("/Users", async function (req, res) {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT * FROM users");
      const Users = result.rows;
      client.release();
      res.send(Users);
    } catch (err) {
      console.error("Error fetching users data:", err);
      res.status(500).send(err);
    }
  });
 
 //edit for later
  // Define a route for fetching user data
app.get("/user", async function (req, res) {
    try {
        if (req.session.userId) {
            const client = await pool.connect();
            const result = await client.query("SELECT email FROM Users WHERE user_id = $1", [req.session.userId]);
            client.release();

            if (result.rows.length === 1) {
                const userEmail = result.rows[0].email;
                // Send the user's email in the response
                res.json({ userId: req.session.userId, userEmail: userEmail });
            } else {
                // Handle the case where the user is not found
                res.status(404).json({ error: "User not found" });
            }
        } else {
            // User is not logged in, send an empty response or an appropriate indicator
            res.json(null);
        }
    } catch (err) {
        console.error("Error fetching user data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

  // Define a route for the /users endpoint in Express
  app.get("/users", async function (req, res) {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT * FROM users");
      const users = result.rows;
      client.release();
      res.send(users);
    } catch (err) {
      console.error("Error fetching users data:", err);
      res.status(500).send(err);
    }
  });



//Adding Savings
app.post("/insert_savings", async function (req, res) {
  try {
	  const user_id = req.session.userId;
      const { goal, start_date, end_date, title } = req.body;
	  
	  const startDate = new Date(start_date);
	  const endDate = new Date(end_date);
	  const weeksToGoal = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7));
	  const weeklySavingAmount = goal / weeksToGoal;
	  
	  
      const client = await pool.connect();
      const result = await client.query(
          "INSERT INTO savings (user_id, goal, start_date, end_date, weekly_saving_amount, weeks_to_goal, title, current_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
          [user_id, goal, startDate, endDate, weeklySavingAmount, weeksToGoal, title, 0]
      );
      client.release();
	  
      const newSavings = result.rows[0];
      res.send(newSavings);
  } catch (err) {
      console.error("Error adding savings:", err);
      res.status(500).send("Internal Server Error");
  }
});

// Handle deposit
app.post("/deposit", async function (req, res) {
    try {
        const { accountId, depositAmount } = req.body;
        const client = await pool.connect();
        const result = await client.query(
            "UPDATE Savings SET current_amount = current_amount + $1 WHERE saving_id = $2 RETURNING *",
            [depositAmount, accountId]
        );
        client.release();
        
        if (result.rows.length === 0) {
            console.error("No matching record found for accountId:", accountId);
            res.status(404).send("No matching record found");
            return;
        }
		
		const userResult = await client.query(
            "UPDATE users SET balance = balance - $1 WHERE user_id = $2 RETURNING *",
            [depositAmount, req.session.userId]
        );
        
        const updatedSavings = result.rows[0];
        console.log("Updated savings:", updatedSavings);
        res.json(updatedSavings);
    } catch (err) {
        console.error("Error depositing amount:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Handle withdraw
app.post("/withdraw", async function (req, res) {
    try {
        const { accountId, withdrawAmount } = req.body;
        const client = await pool.connect();
        const result = await client.query(
            "UPDATE Savings SET current_amount = current_amount - $1 WHERE saving_id = $2 RETURNING *",
            [withdrawAmount, accountId]
        );
        client.release();
        
        if (result.rows.length === 0) {
            console.error("No matching record found for accountId:", accountId);
            res.status(404).send("No matching record found");
            return;
        }
        
		const userResult = await client.query(
            "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING *",
            [depositAmount, req.session.userId]
        );
		
        const updatedSavings = result.rows[0];
        console.log("Updated savings:", updatedSavings);
        res.json(updatedSavings);
    } catch (err) {
        console.error("Error withdrawing amount:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Add a route to handle deleting a savings account
app.delete("/delete_savings/:savingsId", async function (req, res) {
    try {
        const savingsId = req.params.savingsId;
        const client = await pool.connect();
        const result = await client.query(
            "DELETE FROM savings WHERE saving_id = $1",
            [savingsId]
        );
        client.release();

        // Check if any rows were affected to determine if the deletion was successful
        if (result.rowCount === 1) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error("Error deleting savings account:", err);
        res.status(500).send("Internal Server Error");
    }
});



//Adding Transaction
app.post("/insert_transaction", async function (req, res) {
    try {
        const user_id = req.session.userId;
        const { category, transaction_type, name, price, receipt_image, notes, location, transaction_time } = req.body;
		
		console.log("User ID:", req.session.userId); // Log the user_id
        console.log("Transaction Type:", transaction_type); // Log the transaction_type


        // Convert price to decimal
        const priceDecimal = parseFloat(price);

        // Insert transaction into the database
        const client = await pool.connect();
        const result = await client.query(
            "INSERT INTO Transactions (user_id, category_id, transaction_type, name, price, receipt_image, notes, transaction_time, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
            [user_id, category, transaction_type, name, priceDecimal, receipt_image, notes, transaction_time, location]
        );
		
		// Update user's balance based on transaction type
        if (transaction_type === 'income') {
            // Add transaction amount to user's balance
            await client.query(
                "UPDATE users SET balance = balance + $1 WHERE user_id = $2",
                [priceDecimal, user_id]
            );
        } else if (transaction_type === 'spending') {
            // Subtract transaction amount from user's balance
            await client.query(
                "UPDATE users SET balance = balance - $1 WHERE user_id = $2",
                [priceDecimal, user_id]
            );
        }
		
        client.release();
        const newTransaction = result.rows[0];
        res.send(newTransaction);
    } catch (err) {
        console.error("Error adding transaction:", err);
        res.status(500).send("Internal Server Error");
    }
});


//Update Transaction
app.post("/update_transaction", async function (req, res) {
  try {
      const user_id = req.session.userId;
      const { transaction_id, category, transaction_type, name, price, notes, location, transaction_time } = req.body;
  
      console.log("User ID:", req.session.userId); // Log the user_id
      console.log("Transaction Type:", transaction_type); // Log the transaction_type
      console.log("Transaction Time:", transaction_time); // Log the transaction_time

      // Convert price to decimal
      const priceDecimal = parseFloat(price);

      // Insert transaction into the database
      const client = await pool.connect();
      const result = await client.query(`
        UPDATE Transactions
        SET 
          category_id = $1,
          transaction_type = $2,
          name = $3,
          price = $4,
          notes = $5,
          location = $6,
          transaction_time = $7
        WHERE
          transaction_id = $8;`,
          [category, transaction_type, name, priceDecimal, notes, location, transaction_time, transaction_id]
      );
      client.release();

      const newTransaction = result.rows[0];
      res.send(newTransaction);
  } catch (err) {
      console.error("Error adding transaction:", err);
      res.status(500).send("Internal Server Error");
  }
});

// Remove Transaction
app.post("/remove_transaction", async function (req, res) {
  try {
    const user_id = req.session.userId;
    const { transaction_id } = req.body;

    console.log("User ID:", req.session.userId); // Log the user_id
    console.log("Transaction ID:", transaction_id); // Log the transaction_id

    // Delete transaction from the database
    const client = await pool.connect();
    const result = await client.query(`
      DELETE FROM Transactions
      WHERE transaction_id = $1;`,
      [transaction_id]
    );
    location.reload();
    client.release();

    res.send({ success: true, message: "Transaction removed successfully" });
  } catch (err) {
    console.error("Error removing transaction:", err);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/view_spending", async function (req, res) {
  try {
    const user_id = req.session.userId;
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
          t.transaction_id,
          t.name,
          t.price,
          t.transaction_time,
          tc.category_description AS category
      FROM 
          Transactions t
      JOIN 
          TransactionCategory tc ON t.category_id = tc.category_id
      WHERE
          t.transaction_type = 'spending'
          AND t.user_id = $1;
    `, [req.session.userId]); // Pass user_id as parameter

    client.release();
    const transactions = result.rows; // Get all rows
    res.json(transactions); // Send all rows as JSON
  } catch (err) {
    console.error("Error fetching spending:", err);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/balance", async function (req, res) {
  try {
    const user_id = req.session.userId;
    const client = await pool.connect();
    const result = await client.query(`
      SELECT balance FROM users WHERE user_id = $1`, [user_id]
    );
    client.release();
    
    // Extract the balance value from the query result
    const balance = result.rows[0].balance;

    res.json({ balance }); // Send the balance value as JSON object
  } catch (err) {
    console.error("Error fetching balance:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/fetch_transaction", async function (req, res) {
  try {
      const { transaction_id } = req.body;


      const client = await pool.connect();
      const result = await client.query(`
        SELECT transactions.*, transactioncategory.* 
        FROM Transactions 
        JOIN transactioncategory ON transactions.category_id = transactioncategory.category_id 
        WHERE transactions.transaction_id = $1;`
        ,[transaction_id]
      );
      client.release();

      const transaction = result.rows[0];
      res.json(transaction);
  } catch (err) {
      console.error("Error fetching transaction:", err);
      res.status(500).send("Internal Server Error");
  }
});

app.post("/view_income", async function (req, res) {
  try {
    const user_id = req.session.userId;
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
          t.transaction_id,
          t.name,
          t.price,
          t.transaction_time,
          tc.category_description AS category
      FROM 
          Transactions t
      JOIN 
          TransactionCategory tc ON t.category_id = tc.category_id
      WHERE
          t.transaction_type = 'income'
          AND t.user_id = $1;
    `, [user_id]); // Pass user_id as parameter

    client.release();
    const transactions = result.rows; // Get all rows
    res.send(transactions); // Send all rows as an array
  } catch (err) {
    console.error("Error fetching spending:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/view_transaction", async function (req, res) {
  try {
    const { user_id } = req.body;
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
          t.transaction_id,
          t.name,
          t.price,
          tc.category_description AS category
      FROM 
          Transactions t
      JOIN 
          TransactionCategory tc ON t.category_id = tc.category_id
      WHERE
          t.user_id = $1
    `, [req.session.userId]); // Passing user_id as a parameter to prevent SQL injection
    client.release();
    const transactions = result.rows; // Get all rows
    res.send(transactions); // Send all rows that match the user_id
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).send("Internal Server Error");
  }
});


// Endpoint to get transaction categories
app.get("/get_transaction_categories", async function (req, res) {
  try {
      const client = await pool.connect();
      const result = await client.query("SELECT category_id, category_description FROM transactionCategory");
      client.release();
      res.send(result.rows);
  } catch (err) {
      console.error("Error fetching transaction categories:", err);
      res.status(500).send("Internal Server Error");
  }
});


app.get("/view_savings_id", authenticateUser, async function (req, res) {
    try {
        const client = await pool.connect();
        const result = await client.query(
            "SELECT saving_id, title FROM Savings WHERE user_id = $1", [req.session.userId]
        );
        client.release();
        const savingsData = result.rows;
        res.send(savingsData);
    } catch (err) {
        console.error("Error fetching savings data:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/view_savings", async function (req, res) {
    try {
        const client = await pool.connect();
        const result = await client.query(
            "SELECT * FROM Savings WHERE user_id = $1", [req.session.userId]
        );
        client.release();
        const savingsData = result.rows; // Get all rows
        res.send(result.rows); // Send all rows as a JSON array
    } catch (err) {
        console.error("Error fetching savings data:", err);
        res.status(500).send("Internal Server Error");
    }
});


//edit for adding users
  app.post("/Users", async function (req, res) {
    try {
      const { firstname, lastname, dob, email, password } = req.body;
      const client = await pool.connect();
      const result = await client.query(
        "INSERT INTO Users (firstname, lastname, dob, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [firstname, lastname, dob, email, password]
      );
      client.release();
      const newItem = result.rows[0];
      res.send(newItem);
    } catch (err) {
      console.error("Error adding new User:", err);
      res.status(500).send("Internal Server Error");
    }
  });

  
  //Hash a password
  async function hashPassword(plainPassword) {
	  return new Promise((resolve, reject) => {
		  bcrypt.hash(plainPassword, saltRounds, function(err, hash) {
			  if(err){
				  reject(err);
			  } else {
				  resolve(hash);
			  }
		  });
	  });
  }
  
  //Verify password
  async function verifyPassword(plainPassword, hashedPassword){
	  return new Promise((resolve, reject) => {
		  bcrypt.compare(plainPassword, hashedPassword, function(err, result){
			  if(err){
				  reject(err);
			  } else {
				  resolve(result);
			  }
		  });
	  });
  }


//get users current settings
app.get("/get_settings", async function (req, res) {
  try {
      const client = await pool.connect();
      const result = await client.query(
          "SELECT first_name, last_name, email, notifications_enabled, balance, guardian_user_id FROM users WHERE user_id = $1", [req.session.userId]
      );
      client.release();
      const settingsData = result.rows; // Get rows that are in the form
      res.send(result.rows); // Send the rows as a JSON array
  } catch (err) {
      console.error("Error fetching savings data:", err);
      res.status(500).send("Internal Server Error");
  }
});


//updating settings
app.post("/update_settings", async function (req, res) {
  try {
      const {first_name, last_name, email, password, notifications_enabled, balance, guardian_user_id} = req.body;
      const client = await pool.connect();
      let queryParams = [req.session.userId];
      let queryText = "UPDATE users SET ";
      
      let setValues = [];
      if (first_name) {
        setValues.push(`first_name = $${queryParams.length + 1}`);
        queryParams.push(first_name);
      }
      if (last_name) {
        setValues.push(`last_name = $${queryParams.length + 1}`);
        queryParams.push(last_name);
      }
      if (email) {
        setValues.push(`email = $${queryParams.length + 1}`);
        queryParams.push(email);
      }
      if (password) {
        //hash the new password before updating 
        const hashedPassword = await hashPassword(password)
        setValues.push(`password = $${queryParams.length + 1}`);
        queryParams.push(hashedPassword);
      }
      if (notifications_enabled !== undefined) {
        setValues.push(`notifications_enabled = $${queryParams.length + 1}`);
        queryParams.push(notifications_enabled);
      }
      if (balance) {
        setValues.push(`balance = $${queryParams.length + 1}`);
        queryParams.push(balance);
      }
      if (guardian_user_id) {
        setValues.push(`guardian_user_id = $${queryParams.length + 1}`);
        queryParams.push(guardian_user_id);
      }
      
      queryText += setValues.join(", ") + " WHERE user_id = $1 RETURNING *";
      
      const result = await client.query(queryText, queryParams);
      client.release();
      const newSettings = result.rows[0];
      res.send(newSettings);
  } catch (err) {
      console.error("Error updating settings:", err);
      res.status(500).send("Internal Server Error");
  }
});

//edit after database
  //route for user sign up
  app.post("/register", async function (req, res) {
    try {
        const { firstname, lastname, dob, email, password } = req.body;
        const hashedPassword = await hashPassword(password);
        const client = await pool.connect();
        const result = await client.query(
            "INSERT INTO users (first_name, last_name, date_of_birth, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [firstname, lastname, dob, email, hashedPassword]
        );
        client.release();
        const newUser = result.rows[0];
        res.send(newUser);
    } catch (err) {
        console.error("Error registering new user:", err);
        res.status(500).send("Internal Server Error");
    }
});
  
  //route for user login
  app.post("/userlogin", async (req, res)=> {
	  try{
		  const { email, password} = req.body;
		  const client = await pool.connect();
		  const result = await client.query("SELECT * FROM users WHERE email = $1", [email]);
		  client.release();
		  if (result.rows.length === 1) {
			  const user = result.rows[0];
			  const isValidPassword = await verifyPassword(password, user.password);
              req.session.userId = user.user_id;
			if(isValidPassword) {
				res.json({isValidUser: true});

			} else {
				res.json({ isValidUser: false });
			}
		  } 
	  } catch (err) {
			  console.error("Error validating user login:", err);
			  res.status(500).json({ error: "Internal Server Error" });
		  }
	  });

  // Listen on port 8081 for Express
  app.listen(8081, function () {
    console.log("Server is running on port 8081");
  });
}
