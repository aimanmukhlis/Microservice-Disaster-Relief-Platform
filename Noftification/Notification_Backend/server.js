const express = require('express');
const { MongoClient } = require('mongodb'); 
require('dotenv').config();
const dns = require("dns"); 

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8020;

let db, notificationsCollection;

// Connect to MongoDB
const client = new MongoClient(process.env.MONGO_URI);
async function connectDB() {
    try {
        await client.connect();
        db = client.db('notification_db');
        notificationsCollection = db.collection('notifications');
        console.log('✅ Connected to MongoDB Native Driver!');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
    }
}
connectDB();

// Fetch history for the UI Bell Icon
app.get('/api/notifications/history', async (req, res) => {
    try {
        const history = await notificationsCollection
            .find({})
            .sort({ timestamp: -1 }) // Newest first
            .limit(50)
            .toArray(); 
            
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history.' });
    }
});

// Save to DB (No Email)
app.post('/api/notifications/send', async (req, res) => {
    const { message, priority } = req.body;

    // Notice we removed 'recipient' and 'type' because it's strictly system-wide now!
    if (!message || !priority) {
        return res.status(400).json({ error: 'Missing fields.' });
    }

    try {
        // Insert directly into the database
        await notificationsCollection.insertOne({
            title: priority === 'HIGH' ? 'Critical Alert' : 'Supply Request',
            message: message,
            priority: priority,
            timestamp: new Date() 
        });

        console.log(`[Notification Service] In-app alert saved: ${message}`);

        return res.status(200).json({
            status: 'SUCCESS',
            message: `In-app notification saved to database.`
        });

    } catch (error) {
        console.error('[Notification Service Error]:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Notification Backend running on port ${PORT}`);
});