const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs'); // Use bcryptjs consistent with User model
const connectDB = require('./config/db');
const MoodType = require('./models/MoodType');
const User = require('./models/User');
const Mood = require('./models/Mood'); // Import other models if needed for seeding
const JournalEntry = require('./models/Entry');
const RefreshToken = require('./models/RefreshToken');

// Load env vars
dotenv.config({ path: './backend/.env' });

// Connect to DB
connectDB();

// --- Data to Seed ---

const moodTypes = [
  {
    name: 'happy',
    emoji: '😊',
    colorCode: '#4ade80',
    description: 'Feeling joyful and content',
  },
  {
    name: 'calm',
    emoji: '😌',
    colorCode: '#60a5fa',
    description: 'Feeling peaceful and relaxed',
  },
  {
    name: 'sad',
    emoji: '😔',
    colorCode: '#818cf8',
    description: 'Feeling down or unhappy',
  },
  {
    name: 'angry',
    emoji: '😠',
    colorCode: '#f87171',
    description: 'Feeling frustrated or irritated',
  },
  {
    name: 'anxious',
    emoji: '😰',
    colorCode: '#facc15',
    description: 'Feeling worried or nervous',
  },
  {
    name: 'neutral',
    emoji: '😐',
    colorCode: '#9ca3af',
    description: 'Feeling neither positive nor negative',
  },
];

const demoUser = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'Password123!', // Plain text password for seeding, will be hashed by pre-save hook
};


// --- Seeding Functions ---

// Import data into DB
const importData = async () => {
  try {
    // Clear existing data (optional, be careful in production!)
    console.log('Clearing existing data...');
    await MoodType.deleteMany();
    await User.deleteMany();
    await Mood.deleteMany();
    await JournalEntry.deleteMany();
    await RefreshToken.deleteMany();
    console.log('Existing data cleared.');

    // Seed Mood Types
    console.log('Seeding Mood Types...');
    await MoodType.insertMany(moodTypes);
    console.log('Mood Types seeded.');

    // Seed Demo User (password will be hashed by pre-save hook)
    console.log('Seeding Demo User...');
    await User.create(demoUser);
    console.log('Demo User seeded.');

    // Add more seeding logic here if needed (e.g., sample entries for the demo user)

    console.log('Data Imported Successfully!');
    process.exit();
  } catch (err) {
    console.error('Error importing data:', err);
    process.exit(1);
  }
};

// Delete all data from DB
const deleteData = async () => {
  try {
    console.log('Deleting all data...');
    await MoodType.deleteMany();
    await User.deleteMany();
    await Mood.deleteMany();
    await JournalEntry.deleteMany();
    await RefreshToken.deleteMany();
    console.log('Data Destroyed Successfully!');
    process.exit();
  } catch (err) {
    console.error('Error deleting data:', err);
    process.exit(1);
  }
};

// --- Script Execution ---

// Check command line arguments to decide whether to import or delete
if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
} else {
  console.log('Please provide an argument: --import or --delete');
  process.exit(1);
}
