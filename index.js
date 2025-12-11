// ---------------------------
// Basic Requirements
// ---------------------------
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

// Express App
const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());


// ---------------------------
// MongoDB Connection (Mongoose)
// ---------------------------
const uri = process.env.MONGO_URL;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    //database creation
    const database = client.db('assigment11DB');
    const userCollections = database.collection('user');


    //Our created API

    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "buyer";
      userInfo.createdAt = new Date();

      const result = await userCollections.insertOne(userInfo);
      res.send(result);
    })


    //Get Role of Logged-in User
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollections.findOne({ email });

      if (!user) {
        return res.send({ role: null, message: "user not found" });
      }

      res.send({ role: user.role });
    });




    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


// ---------------------------
// Basic Test Route
// ---------------------------
app.get("/", (req, res) => {
  res.send("Server is running...");
});


// ---------------------------
// Start Server
// ---------------------------
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
