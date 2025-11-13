// index.js
require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken'); // for authentication

const app = express();
const port = process.env.PORT || 3000;

// 🔒 Middleware setup
app.use(cors());
app.use(express.json());
app.use(helmet());

// 🗄️ MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}/?appName=RentWheels`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// 🔑 Verify JWT middleware
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: 'Unauthorized access' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden access' });
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();

    const db = client.db('Cars');
    const carsCollection = db.collection('carCollection');
    const bookingsCollection = db.collection('bookings');
    const usersCollection = db.collection('users');

    console.log('✅ MongoDB Connected Successfully!');

    // ----------------------------
    // 🔹 AUTHENTICATION
    // ----------------------------

    // Generate JWT Token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
      res.send({ token });
    });

    // ----------------------------
    // 🔹 USERS
    // ----------------------------

    // Save user info after signup/login
    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) return res.send({ message: 'User already exists' });
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Get all users (optional)
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // ----------------------------
    // 🔹 CARS CRUD
    // ----------------------------

    // ➕ Add a new car (Private)
    app.post('/cars', verifyJWT, async (req, res) => {
      const car = req.body;
      const result = await carsCollection.insertOne(car);
      res.send(result);
    });

    // 🔍 Get all cars (Public)
    app.get('/cars', async (req, res) => {
      const cars = await carsCollection.find().sort({ _id: -1 }).limit(6).toArray();
      res.send(cars);
    });

    // // 🔍 Get single car details
    // app.get('/cars/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const car = await carsCollection.findOne({ _id: new ObjectId(id) });
    //   res.send(car);
    // });

    // 🧍‍♀️ My Listings (Private)
    app.get('/my-listings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) return res.status(403).send({ message: 'Forbidden access' });
      const result = await carsCollection.find({ providerEmail: email }).toArray();
      res.send(result);
    });

    // ✏️ Update car (Private)
    app.put('/cars/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedCar = req.body;
      const result = await carsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedCar }
      );
      res.send(result);
    });

    // ❌ Delete car (Private)
    app.delete('/cars/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
     // ----------------------------
    // 🔹 BOOKINGS
    // ----------------------------

    // 📦 Book a car (Private)
    app.post('/bookings', verifyJWT, async (req, res) => {
      const booking = req.body;

      // prevent double booking
      const existingBooking = await bookingsCollection.findOne({
        carId: booking.carId,
        status: 'Booked',
      });
      if (existingBooking)
        return res.status(400).send({ message: 'This car is already booked' });

      const bookingResult = await bookingsCollection.insertOne(booking);
      await carsCollection.updateOne(
        { _id: new ObjectId(booking.carId) },
        { $set: { status: 'Booked' } }
      );
      res.send(bookingResult);
    });

    // 🔍 My Bookings (Private)
    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) return res.status(403).send({ message: 'Forbidden access' });
      const result = await bookingsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // ----------------------------
    // 🔹 EXTRA ROUTES
    // ----------------------------

    // 🔍 Search cars by name (public)
    app.get('/search', async (req, res) => {
      const query = req.query.q || '';
      const cars = await carsCollection
        .find({ name: { $regex: query, $options: 'i' } })
        .toArray();
      res.send(cars);
    });



    // Root route
    app.get('/', (req, res) => {
      res.send('🚗 RentWheels Server is Running Perfectly...');
    });
  } catch (err) {
    console.error('❌ Error:', err);
  }
}
   

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 RentWheels server running on port ${port}`);
});
