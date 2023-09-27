// Import packages
import express from 'express';
import dotenv from 'dotenv';

// Run dotenv
dotenv.config();

// Prepare the app
const app = express();
const PORT = 3000;

// Make the app listen to the port
app.listen(PORT, () => {
  console.log(`API listening on PORT ${PORT} `)
});

// Main rout
app.get('/', (req, res) => {
  res.send('Welcome to Geo-Edge')
});