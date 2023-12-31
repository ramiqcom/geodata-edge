// Import packages
import express from 'express';
import ee from '@google/earthengine';
import dotenv from 'dotenv';
import cors from 'cors';

// Import routes
import image from './route/image.js';

// Prepare the app
const app = express();
const PORT = 3000;

// Run dotenv
dotenv.config();

// Key
const key = JSON.parse(process.env.EE_KEY);

// Express package
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));
app.use(cors());

// Run authentication
app.use((req, res, next) => {
  console.time('authentication')
  ee.data.authenticateViaPrivateKey(key, () => {
    ee.initialize(null, null, () => {
      console.timeEnd('authentication')
      next()
    });
  });
})

// Make the app listen to the port
app.listen(PORT, () => {
  console.log(`API listening on PORT ${PORT} `)
});

// Main route
app.get('/', (req, res) => {
  res.send('Welcome to Geo-Edge');
});

// Image route
app.post('/image', (req, res) => {
	image(req.body, res);
});