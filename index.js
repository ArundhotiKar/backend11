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

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized access" });

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.decodedEmail = decodedToken.email; // logged-in user email
    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid token" });
  }
};


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
    const wishlistCollections = database.collection("wishlist");
    //const reviewCollections = database.collection("review");
    const ratingCollections = database.collection("ratings");


    // ---------------------------
    // Create New User
    // ---------------------------
    app.post("/users",  async (req, res) => {
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
    // Add to Wishlist
    // ---------------------------
    app.post("/wishlist", verifyFBToken, async (req, res) => {
      const wishlistData = req.body;
      wishlistData.createdAt = new Date();
      try {
        const result = await wishlistCollections.insertOne(wishlistData);
        res.send({ success: true, message: "Book added to wishlist successfully", result });
      } catch (err) {
        console.error("Error inserting wishlist item:", err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });

    // ---------------------------
    // Get wishlist item by userEmail
    // ---------------------------
    app.get("/wishlist", verifyFBToken, async (req, res) => {
      const { userEmail } = req.query; // শুধু userEmail লাগবে

      if (!userEmail) {
        return res.status(400).send({ success: false, message: "userEmail required" });
      }

      try {
        const wishlistItems = await wishlistCollections
          .find({ userEmail })
          .toArray();

        res.send(wishlistItems); // সব wishlist items for this user
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });

    // ---------------------------
    // Get wishlist item by user & bookId
    // ---------------------------

    app.get("/wishlist/id", async (req, res) => {
      const { userEmail, bookId } = req.query;

      if (!userEmail) {
        return res.status(400).send({ success: false, message: "userEmail required" });
      }

      const query = { userEmail };
      if (bookId) query.bookId = bookId; // optional filter for specific book

      try {
        const wishlistItems = await wishlistCollections.find(query).toArray();
        res.send(wishlistItems);
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Database error" });
      }
    });



    // ---------------------------
    // Delete from wishlist
    // ---------------------------
    app.delete("/wishlist/:bookId", async (req, res) => {
      const { bookId } = req.params;
      const { userEmail } = req.query;

      try {
        const result = await wishlistCollections.deleteOne({ bookId, userEmail });

        if (result.deletedCount === 0) {
          return res.status(404).send({ success: false, message: "Item not found in wishlist" });
        }

        res.send({ success: true, message: "Removed from wishlist" });
      } catch (err) {
        console.error("Error deleting wishlist item:", err);
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
    // GET /users/profile/:email
    // ---------------------------
    app.get("/users/profile/:email", async (req, res) => {
      try {
        const user = await userCollections.findOne({
          email: req.params.email,
        });
        res.send(user);
      } catch (err) {
        res.status(500).send({ message: "Failed to load profile" });
      }
    });


    // ---------------------------
    // PATCH /users/profile/:email
    // ---------------------------
    app.patch("/users/profile/:email", async (req, res) => {
      const { name, imageURL } = req.body;

      try {
        const result = await userCollections.updateOne(
          { email: req.params.email },
          {
            $set: {
              name,
              imageURL,
            },
          }
        );

        res.send({ message: "Profile updated", result });
      } catch (err) {
        res.status(500).send({ message: "Profile update failed" });
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


    // ---------------------------
    // DELETE Book and related orders
    // ---------------------------
    app.delete("/books/:id", async (req, res) => {
      const bookId = req.params.id;

      try {
        // Delete the book
        const bookResult = await bookCollections.deleteOne({ _id: new ObjectId(bookId) });

        if (bookResult.deletedCount === 0) {
          return res.status(404).send({ success: false, message: "Book not found" });
        }

        // Delete all orders related to this book
        const orderResult = await orderCollections.deleteMany({ bookId });

        res.send({
          success: true,
          message: "Book and related orders deleted successfully",
          deletedOrders: orderResult.deletedCount
        });
      } catch (err) {
        console.error("Error deleting book and orders:", err);
        res.status(500).send({ success: false, message: "Delete failed" });
      }
    });


    // ---------------------------
    // Add a Review
    // ---------------------------
    app.post("/ratings", async (req, res) => {
      const { bookId, userEmail, rating } = req.body;

      if (!bookId || !userEmail || !rating) {
        return res.status(400).send({ message: "Missing fields" });
      }

      try {
        const existing = await ratingCollections.findOne({ bookId, userEmail });

        if (existing) {
          // Update existing rating instead of blocking
          const updated = await ratingCollections.updateOne(
            { bookId, userEmail },
            { $set: { rating: Number(rating), createdAt: new Date() } }
          );
          return res.send({ success: true, message: "Rating updated", updated });
        }

        // Insert new rating if none exists
        const result = await ratingCollections.insertOne({
          bookId,
          userEmail,
          rating: Number(rating),
          createdAt: new Date(),
        });

        res.send({ success: true, message: "Rating submitted", result });
      } catch (err) {
        res.status(500).send({ message: "Failed to submit rating" });
      }
    });

    // ---------------------------
    // Get Reviews by Book ID
    // ---------------------------
    app.get("/ratings/:bookId", async (req, res) => {
      const { bookId } = req.params;

      try {
        const ratings = await ratingCollections.find({ bookId }).toArray();

        if (ratings.length === 0) {
          return res.send({ averageRating: null, ratings: [] });
        }

        // Ensure numeric addition
        const total = ratings.reduce((sum, r) => sum + Number(r.rating), 0);
        const averageRating = (total / ratings.length).toFixed(1);

        res.send({
          averageRating,
          ratings,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch ratings" });
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