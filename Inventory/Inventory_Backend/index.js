// server.js (Inventory Microservice)
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); 
const cors = require('cors');
const dns = require("dns"); 

// Force DNS resolution for certain deployment environments
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db, inventoryCollection;

const ALLOWED_ITEM_TYPES = ['food', 'drink', 'medicine', 'toiletries', 'tools', 'clothing'];

// 🟢 FIXED: Maps directly to the Docker environment injection key or container domain fallback
const GIS_URL = process.env.GIS_SERVICE_URL || 'http://gis-service-app:7030';
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
                source: 'INVENTORY_SERVICE'
            })
        });
        console.log(`[BROKER] Published alert successfully: "${message}"`);
    } catch (error) {
        console.error(`[BROKER ERROR] Could not contact message broker:`, error.message);
    }
}

async function startServer() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB Atlas!");
        
        db = client.db('inventory_db');
        inventoryCollection = db.collection('Resources');

        // ==========================================
        // ADMIN ENDPOINTS (Database Management)
        // ==========================================

        app.post('/api/v1/admin/inventory', async (req, res) => {
            try {
                const { itemId, itemName, quantity, location, latitude, longitude, itemType } = req.body;

                if (!itemId || !itemName || quantity === undefined || !location || !itemType || latitude === undefined || longitude === undefined) {
                    return res.status(400).json({ error: "Missing required fields. Please ensure latitude and longitude are included." });
                }

                const normalizedType = itemType.toLowerCase().trim();
                if (!ALLOWED_ITEM_TYPES.includes(normalizedType)) {
                    return res.status(400).json({ error: `Invalid itemType. Must be one of: ${ALLOWED_ITEM_TYPES.join(', ')}` });
                }

                const newSupply = {
                    itemId: itemId.trim().toUpperCase(), 
                    itemName: itemName.trim(),
                    quantity: Number(quantity),
                    itemType: normalizedType,       
                    location: location.trim(),
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    lastUpdated: new Date()
                };

                const result = await inventoryCollection.insertOne(newSupply);
                res.status(201).json({ message: "Supply added successfully", id: result.insertedId });
            } catch (error) {
                res.status(500).json({ error: "Failed to add supply" });
            }
        });

        app.get('/api/v1/admin/inventory', async (req, res) => {
            try {
                const supplies = await inventoryCollection.find({}).toArray();
                res.status(200).json(supplies);
            } catch (error) {
                res.status(500).json({ error: "Failed to fetch supplies" });
            }
        });

        app.put('/api/v1/admin/inventory/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const normalizedType = req.body.itemType?.toLowerCase().trim();

                if (normalizedType && !ALLOWED_ITEM_TYPES.includes(normalizedType)) {
                    return res.status(400).json({ error: `Invalid itemType.` });
                }

                const updatedSupply = {
                    itemName: req.body.itemName,
                    quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : undefined,
                    itemType: normalizedType,
                    location: req.body.location,
                    lastUpdated: new Date()
                };

                Object.keys(updatedSupply).forEach(key => updatedSupply[key] === undefined && delete updatedSupply[key]);

                const result = await inventoryCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedSupply });
                if (result.matchedCount === 0) return res.status(404).json({ error: "Supply item not found" });
                res.status(200).json({ message: "Supply updated successfully" });
            } catch (error) {
                res.status(500).json({ error: "Failed to update supply" });
            }
        });

        app.delete('/api/v1/admin/inventory/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await inventoryCollection.deleteOne({ _id: new ObjectId(id) }); 
                if (result.deletedCount === 0) return res.status(404).json({ error: "Supply not found" });
                res.status(200).json({ message: "Supply deleted successfully" });
            } catch (error) {
                res.status(500).json({ error: "Failed to delete supply" });
            }
        });

        // ==========================================
        // PUBLIC ENDPOINTS (Handled as Orchestrator)
        // ==========================================

        app.get('/api/v1/public/inventory/search', async (req, res) => {
            try {
                const { keyword, itemType, lat, lon } = req.query;
                const query = {};

                if (keyword) query.itemName = { $regex: keyword, $options: 'i' };
                if (itemType) query.itemType = itemType.toLowerCase().trim();

                const supplies = await inventoryCollection.find(query).toArray();
                const formattedResults = supplies.map(item => ({
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemType: item.itemType,
                    centerName: item.location,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    availableQuantity: item.quantity
                }));

                if (!lat || !lon) {
                    return res.status(200).json({ nearbyCenters: formattedResults });
                }

                const gisPayload = {
                    userLocation: { latitude: Number(lat), longitude: Number(lon) },
                    centers: formattedResults
                };

                console.log(`[ORCHESTRATOR] Forwarding cross-service spatial calculation to: ${GIS_URL}`);
                const gisResponse = await fetch(`${GIS_URL}/api/v1/gis/filter-nearby`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(gisPayload)
                });

                if (!gisResponse.ok) throw new Error(`GIS service responded with status ${gisResponse.status}`);
                const gisData = await gisResponse.json();

                res.status(200).json(gisData);

            } catch (error) {
                console.error("Search Orchestration Error:", error);
                res.status(500).json({ error: "Failed to search and filter inventory." });
            }
        });

        // 📝 REQUEST SUPPLIES (Frontend Modal Submission)
        app.post('/api/v1/public/inventory/request', async (req, res) => {
            try {
                const { itemId, centerName, quantityNeeded } = req.body;
                const deductQty = Number(quantityNeeded);

                if (!itemId || !centerName || isNaN(deductQty) || deductQty <= 0) {
                    return res.status(400).json({ error: "Invalid request payload attributes." });
                }

                const targetId = itemId.trim().toUpperCase();
                const result = await inventoryCollection.updateOne(
                    { itemId: targetId, location: centerName.trim(), quantity: { $gte: deductQty } },
                    { $inc: { quantity: -deductQty }, $set: { lastUpdated: new Date() } }
                );

                if (result.modifiedCount === 0) {
                    publishSystemAlert(`CRITICAL: Request denied at ${centerName}. Insufficient stock for Item ${targetId}.`, 'HIGH');
                    return res.status(400).json({ error: "Request rejected. Insufficient stock." });
                }

                publishSystemAlert(`Resource allocation approved: ${deductQty} units of Item ${targetId} drawn from ${centerName}.`, 'INFO');
                res.status(200).json({ message: "Request approved! Inventory updated safely." });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        const PORT = process.env.PORT || 7020;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Inventory Orchestrator backend running on port ${PORT}`);
        });

    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    await client.close();
    console.log("MongoDB connection closed.");
    process.exit(0);
});

startServer();