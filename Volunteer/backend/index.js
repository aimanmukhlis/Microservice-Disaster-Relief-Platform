// index.js (Volunteer Microservice)
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const dns = require('dns');

// Force Node.js to bypass local ISP blocks inside Docker
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db, volunteersCol, tasksCol;

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
                source: 'VOLUNTEER_SERVICE'
            })
        });
        console.log(`[BROKER] Volunteer event alert forwarded to queue: "${message}"`);
    } catch (error) {
        console.error(`[BROKER ERROR] Could not contact message broker:`, error.message);
    }
}

async function startServer() {
    try {
        await client.connect();
        db = client.db('disaster_relief_db');
        volunteersCol = db.collection('Volunteers');
        tasksCol = db.collection('Tasks');
        console.log("📦 Connected successfully to MongoDB (Volunteer Database Cluster)");

        // 1. Register Volunteer
        app.post('/api/v1/volunteers/register', async(req, res) => {
            const { name, skills, location, contact } = req.body;
            if (!name || !skills || !location) return res.status(400).json({ error: "Missing required fields." });

            const newVolunteer = {
                name,
                skills: Array.isArray(skills) 
                    ? skills.map(s => s.toLowerCase().trim()) 
                    : skills.split(',').map(s => s.toLowerCase().trim()),
                location: location.toLowerCase().trim(),
                contact,
                status: 'available',
                joinedAt: new Date()
            };

            const result = await volunteersCol.insertOne(newVolunteer);

            // 🔥 PUBLISH NEW REGISTRATION TO THE MESSAGE BROKER
            publishSystemAlert(`New responder resource logged: ${name} registered availability at [${newVolunteer.location}]`, 'INFO');

            res.status(201).json({ message: "Volunteer registered", id: result.insertedId });
        });

        // 2. Match Volunteers to Incident
        app.get('/api/v1/volunteers/match', async(req, res) => {
            const { location, requiredSkill } = req.query;

            const query = { status: 'available' };
            if (location) query.location = location.toLowerCase().trim();
            if (requiredSkill) query.skills = requiredSkill.toLowerCase().trim();

            const matches = await volunteersCol.find(query).toArray();
            res.status(200).json(matches);
        });

        // 3. Update Task Status (Accept/Reject)
        app.put('/api/v1/volunteers/task/:taskId/status', async(req, res) => {
            const { status, volunteerId } = req.body;

            if (!['accepted', 'rejected'].includes(status)) {
                return res.status(400).json({ error: "Invalid status." });
            }

            const result = await tasksCol.updateOne({ _id: new ObjectId(req.params.taskId) }, { $set: { status, volunteerId, updatedAt: new Date() } });

            if (status === 'accepted') {
                await volunteersCol.updateOne({ _id: new ObjectId(volunteerId) }, { $set: { status: 'deployed' } });
                
                // 🔥 PUBLISH DEPLOYMENT HIGH-PRIORITY ACCEPTANCE TO THE MESSAGE BROKER
                publishSystemAlert(`CRITICAL: Task assignment activated! Volunteer ID ${volunteerId} has accepted deployment for Task ${req.params.taskId}.`, 'HIGH');
            } else {
                // 🔥 PUBLISH TASK REJECTION TRACKER EVENT
                publishSystemAlert(`Task assignment declined: Task ${req.params.taskId} was rejected and goes back to open queue pools.`, 'INFO');
            }

            res.status(200).json({ message: `Task ${status} successfully.` });
        });

        const PORT = process.env.PORT || 9020;
        app.listen(PORT, () => console.log(`🚀 Volunteer Microservice running on port ${PORT}`));
    } catch (error) {
        console.error("Database connection failed:", error);
    }
}
startServer();