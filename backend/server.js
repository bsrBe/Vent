const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./middleware/errorHandler'); // Assuming errorHandler exists

// Load env vars
dotenv.config({ path: './backend/.env' }); // Explicitly point to .env file if needed

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const moodRoutes = require('./routes/moodRoutes');
const searchRoutes = require('./routes/searchRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

// --- Global Middleware ---

// Set security HTTP headers
app.use(helmet());

// Enable CORS - Adjust options as needed for production
app.use(cors({
    origin: 'https://vent-git-main-bsrbes-projects.vercel.app', // Allow specific frontend origin
    credentials: true // Allow cookies/authorization headers
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Add request timestamp (optional)
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// --- Routes ---
const apiVersion = '/api/v1';
app.use(`${apiVersion}/auth`, authRoutes);
app.use(`${apiVersion}/entries`, entryRoutes);
app.use(`${apiVersion}/moods`, moodRoutes);
app.use(`${apiVersion}/search`, searchRoutes);
app.use(`${apiVersion}/users`, userRoutes);
app.use(`${apiVersion}/export`, exportRoutes);

// --- Handle Undefined Routes ---
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// --- Global Error Handling Middleware ---
// Ensure errorHandler.js exists and handles different error types
app.use(globalErrorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5001; // Use a different port than frontend default (3000)

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal (e.g., from Heroku)
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
        console.log('💥 Process terminated!');
    });
});
