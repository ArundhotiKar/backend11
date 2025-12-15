// ---------------------------
// Basic Requirements
// ---------------------------
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

// Express App
const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// ---------------------------
// MongoDB Connection
// ---------------------------
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");

    const database = client.db("assigment11DB");
    const userCollections = database.collection("user");


    // ---------------------------
    // Create New User
    // ---------------------------
    app.post("/users", async (req, res) => {
      const userInfo = req.body;

      // Default role if not selected
      userInfo.role = userInfo.role || "User";
      userInfo.createdAt = new Date();


      try {
        const result = await userCollections.insertOne(userInfo);
        res.send({ success: true, message: "User saved successfully", result });
      } catch (err) {
        console.error("Error inserting user:", err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });


    // ---------------------------
    // Add books
    // ---------------------------
    const bookCollections = database.collection("book");
    app.post("/books", async (req, res) => {
      const bookData = req.body;
      //console.log("Book request body:", req.body);
      bookData.createdAt = new Date();
      try {
        const result = await bookCollections.insertOne(bookData);
        res.send({ success: true, message: "Book saved successfully", result });
      } catch (err) {
        console.error("Error inserting Book:", err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });


    // ---------------------------
    // Get Role of Logged-in User
    // ---------------------------
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await userCollections.findOne({ email });
        if (!user) {
          return res.send({ role: null, message: "User not found" });
        }
        res.send({ role: user.role });
      } catch (err) {
        console.error("Error fetching role:", err);
        res.status(500).send({ role: null, message: "Database error" });
      }
    });


    // ---------------------------
    // Get All Users
    // ---------------------------
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollections.find({}).toArray();
        res.json(users);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    });


    // ---------------------------
    // Update User to Librarian or Admin
    // ---------------------------
    app.patch("/users/:id/role", async (req, res) => {
      const { role } = req.body;
      try {
        const updated = await userCollections.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role } }
        );
        res.json({ message: `Role updated to ${role}` });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update role" });
      }
    });


    // ---------------------------
    // Get All Books
    // ---------------------------
    app.get("/books", async (req, res) => {
      try {
        const books = await bookCollections.find({}).toArray();
        //console.log("Fetched books:", books);
        res.send(books);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Database error" });
      }
    });


    // ---------------------------
    // Get Book by ID
    // ---------------------------
    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const book = await bookCollections.findOne({ _id: new ObjectId(id) });
        if (!book) {
          return res.status(404).send({ message: "Book not found" });
        }
        res.send(book);
      } catch (err) {
        console.error("Error fetching book:", err);
        res.status(500).send({ message: "Database error" });
      }
    });


    // Get books by librarian email
    app.get("/my-books", async (req, res) => {
      const email = req.query.email;

      try {
        const books = await bookCollections
          .find({ librarianEmail: email })
          .toArray();

        res.send(books);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch books" });
      }
    });



    // Update book status (publish / unpublish)
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      try {
        const result = await bookCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update status" });
      }
    });


    // ---------------------------
    // Add Order
    // ---------------------------
    const orderCollections = database.collection("order");
    app.post("/orders", async (req, res) => {
      const orderData = req.body;
      console.log("Order request body:", req.body);
      orderData.createdAt = new Date();
      try {
        const result = await orderCollections.insertOne(orderData);
        res.send({ success: true, message: "Order saved successfully", result });
      } catch (err) {
        console.error("Error inserting order:", err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });


    // Get orders by user email
    app.get("/my-orders", async (req, res) => {
      const email = req.query.email;

      try {
        const orders = await orderCollections
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(orders);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch orders" });
      }
    });


    //Cancel Order API
    app.patch("/orders/cancel/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const order = await orderCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!order) {
          return res.status(404).send({ message: "Order not found" });
        }

        if (order.status === "delivered") {
          return res
            .status(400)
            .send({ message: "Delivered order cannot be cancelled" });
        }

        const result = await orderCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "cancelled",
              paymentStatus: "cancelled",
            },
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to cancel order" });
      }
    });



    app.get("/orders/librarian/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const orders = await orderCollections
          .find({ librarianEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(orders);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch orders" });
      }
    });


    app.patch("/orders/status/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status: newStatus } = req.body;

        const order = await orderCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!order) {
          return res.status(404).send({ message: "Order not found" });
        }

        const currentStatus = order.status;

        const valid =
          (currentStatus === "pending" && newStatus === "shipped") ||
          (currentStatus === "shipped" && newStatus === "delivered");

        if (!valid) {
          return res.status(400).send({
            message: "Invalid status transition",
          });
        }

        const result = await orderCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: newStatus } }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update status" });
      }
    });

    app.patch("/books/edit/:id", async (req, res) => {
      try {
        const { _id, ...updatedData } = req.body;

        const updated = await bookCollections.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updatedData }
        );

        res.send({ success: true, message: "Book updated successfully", updated });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Failed to update book" });
      }
    });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } finally {
    // Do not close client to keep server running
    // await client.close();
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
