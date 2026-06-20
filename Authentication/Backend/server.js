require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dns = require('dns');

// Force Node.js to bypass local ISP blocks inside Docker
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const port = process.env.PORT || 3020;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://s74824_db_user:Ky6VdH5cVvay6wXa@cluster0.phluhfs.mongodb.net/?appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('🔐 Auth Service connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

const BROKER_URL = 'http://notification-app:8020/api/notifications/publish';

/**
 * Helper function to safely dispatch security logs to the central Message Broker
 */
async function publishSystemAlert(message, priority = 'INFO') {
    try {
        await fetch(BROKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                priority,
                source: 'AUTH_SERVICE'
            })
        });
        console.log(`[BROKER] Security audit event forwarded: "${message}"`);
    } catch (error) {
        // Fallback catch so auth doesn't crash if the broker is momentarily resetting
        console.error(`[BROKER ERROR] Could not reach notification broker:`, error.message);
    }
}

// --- USER SCHEMA ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Victim' }, 
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- API ENDPOINTS ---

// 1. REGISTER Endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'Victim'
        });

        await newUser.save();

        // 🔥 PUBLISH AUDIT LOG EVENT TO BROKER
        publishSystemAlert(`Security Audit: New platform account provisioned for ${name} (${newUser.role})`, 'INFO');

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. LOGIN Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            // 🔥 SECURITY EVENT: Trigger a high priority alert for invalid accounts trying to get in
            publishSystemAlert(`SECURITY WARNING: Failed authorization attempt on non-existent account [${email}]`, 'HIGH');
            return res.status(400).json({ error: 'Invalid email or password' }); 
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // 🔥 SECURITY EVENT: Bad password attempt on a real account
            publishSystemAlert(`SECURITY WARNING: Unauthorized access block. Invalid password for user [${email}]`, 'HIGH');
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'super_secret_disaster_relief_key', 
            { expiresIn: '2h' }
        );

        res.json({ 
            message: 'Login successful',
            token: token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Authentication Service running on port ${port}`);
});