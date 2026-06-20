// index.js (Communication Microservice)
require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dns = require('dns');

// Force Node.js to bypass local ISP blocks inside Docker
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db, messagesCol;

const BROKER_URL = 'http://notification-app:8020/api/notifications/publish';

/**
 * Helper function to safely dispatch messages to the central Message Broker
 */
async function publishSystemAlert(message, priority = 'INFO') {
    try {
        await fetch(BROKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                priority,
                source: 'COMMUNICATION_SERVICE'
            })
        });
        console.log(`[BROKER] Broadcast alert successfully synchronized: "${message}"`);
    } catch (error) {
        console.error(`[BROKER ERROR] Could not reach notification message broker:`, error.message);
    }
}

async function startServer() {
    try {
        await client.connect();
        db = client.db('disaster_relief_db');
        messagesCol = db.collection('Communications');
        console.log("📦 Connected successfully to MongoDB (Communication Database Cluster)");

        // 1. Send & Log Message
        app.post('/api/v1/communication/send', async(req, res) => {
            const { senderId, receiverId, incidentId, message, senderRole } = req.body;

            if (!senderId || !message || !incidentId) {
                return res.status(400).json({ error: "Missing required communication payload." });
            }

            const newMsg = {
                incidentId,
                senderId,
                receiverId: receiverId || 'BROADCAST',
                senderRole: senderRole || 'NGO',
                message,
                timestamp: new Date()
            };

            await messagesCol.insertOne(newMsg);

            // 🔥 PUBLISH OPERATIONAL COMMS DISPATCH TO THE MESSAGE BROKER
            // Determines priority status dynamically depending on sender authorization levels
            const priorityLevel = (senderRole === 'Government') ? 'HIGH' : 'INFO';
            publishSystemAlert(`Broadcast Outpost Update [${incidentId}] (${newMsg.senderRole}): ${message}`, priorityLevel);

            res.status(201).json({ status: "Message sent and logged for audit." });
        });

        // 2. Fetch Audit History
        app.get('/api/v1/communication/history/:incidentId', async(req, res) => {
            try {
                const history = await messagesCol
                    .find({ incidentId: req.params.incidentId })
                    .sort({ timestamp: 1 })
                    .toArray();

                res.status(200).json(history);
            } catch (error) {
                res.status(500).json({ error: "Failed to load chat history lines." });
            }
        });

        // Pulls port assignment configuration from environment
        const PORT = process.env.PORT || 6020;
        app.listen(PORT, () => console.log(`🚀 Communication Microservice running on port ${PORT}`));
    } catch (error) {
        console.error("❌ Database connection failed:", error);
    }
}
startServer();