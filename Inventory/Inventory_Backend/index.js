// server.js (Inventory Microservice)
require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb'); 
const cors = require('cors');
const dns = require("dns"); 

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db, inventoryCollection;

const ALLOWED_ITEM_TYPES = ['food', 'drink', 'medicine', 'toiletries', 'tools', 'clothing'];

async function startServer() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB Atlas!");
        
        db = client.db('inventory_db');
        inventoryCollection = db.collection('Resources');

        // ==========================================
        // ADMIN ENDPOINTS (Middleware Removed - Protection Handled by Gateway)
        // ==========================================

        // 🟢 CREATE
        app.post('/api/v1/admin/inventory', async (req, res) => {
            try {
                const { itemId, itemName, quantity, location, itemType } = req.body;

                if (!itemId || !itemName || quantity === undefined || !location || !itemType) {
                    return res.status(400).json({ error: "Missing required fields." });
                }

                const normalizedType = itemType.toLowerCase().trim();
                if (!ALLOWED_ITEM_TYPES.includes(normalizedType)) {
                    return res.status(400).json({ error: `Invalid itemType. Must be one of: ${ALLOWED_ITEM_TYPES.join(', ')}` });
                }

                const newSupply = {
                    _id: itemId.trim().toUpperCase(), 
                    itemName: itemName.trim(),
                    quantity: Number(quantity),
                    itemType: normalizedType,       
                    location: location.trim(),
                    lastUpdated: new Date()
                };

                const result = await inventoryCollection.insertOne(newSupply);
                res.status(201).json({ message: "Supply added successfully", id: result.insertedId });
            } catch (error) {
                if (error.code === 11000) {
                    return res.status(400).json({ error: `An item with custom ID '${req.body.itemId}' already exists.` });
                }
                res.status(500).json({ error: "Failed to add supply" });
            }
        });

        // 🔵 READ ALL ADMIN
        app.get('/api/v1/admin/inventory', async (req, res) => {
            try {
                const supplies = await inventoryCollection.find({}).toArray();
                res.status(200).json(supplies);
            } catch (error) {
                res.status(500).json({ error: "Failed to fetch supplies" });
            }
        });

        // 🟠 UPDATE
        app.put('/api/v1/admin/inventory/:id', async (req, res) => {
            try {
                const id = req.params.id.trim().toUpperCase(); 
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

                const result = await inventoryCollection.updateOne({ _id: id }, { $set: updatedSupply });
                if (result.matchedCount === 0) return res.status(404).json({ error: "Supply item not found" });
                res.status(200).json({ message: "Supply updated successfully" });
            } catch (error) {
                res.status(500).json({ error: "Failed to update supply" });
            }
        });

        // 🔴 DELETE
        app.delete('/api/v1/admin/inventory/:id', async (req, res) => {
            try {
                const id = req.params.id.trim().toUpperCase();
                const result = await inventoryCollection.deleteOne({ _id: id }); 
                if (result.deletedCount === 0) return res.status(404).json({ error: "Supply not found" });
                res.status(200).json({ message: "Supply deleted successfully" });
            } catch (error) {
                res.status(500).json({ error: "Failed to delete supply" });
            }
        });

        // ==========================================
        // USER PORTAL ENDPOINTS (Public Domain Routing)
        // ==========================================

        // 🔍 SEARCH FOR SUPPLIES
        app.get('/api/v1/public/inventory/search', async (req, res) => {
            try {
                const searchKeyword = req.query.keyword || ""; 
                const filterType = req.query.itemType || "";
                const query = {};

                if (searchKeyword) {
                    query.itemName = { $regex: searchKeyword, $options: 'i' };
                }
                if (filterType) {
                    query.itemType = filterType.toLowerCase().trim();
                }

                const supplies = await inventoryCollection.find(query).toArray();
                const formattedResults = supplies.map(item => ({
                    itemId: item._id, 
                    itemName: item.itemName,
                    itemType: item.itemType,
                    centerId: { name: item.location }, 
                    availableStock: item.quantity
                }));

                res.status(200).json(formattedResults);
            } catch (error) {
                res.status(500).json({ error: "Failed to search inventory" });
            }
        });

        // 📝 REQUEST SUPPLIES
        app.post('/api/v1/public/inventory/request', async (req, res) => {
            try {
                const { itemId, centerName, quantityNeeded } = req.body;
                const deductQty = Number(quantityNeeded);

                if (!itemId || !centerName || isNaN(deductQty) || deductQty <= 0) {
                    return res.status(400).json({ error: "Invalid request payload attributes." });
                }

                const targetId = itemId.trim().toUpperCase();
                const result = await inventoryCollection.updateOne(
                    { _id: targetId, location: centerName.trim(), quantity: { $gte: deductQty } },
                    { $inc: { quantity: -deductQty }, $set: { lastUpdated: new Date() } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ error: "Request rejected. Insufficient stock." });
                }

                res.status(200).json({ message: "Request approved! Inventory updated safely." });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        const PORT = process.env.PORT || 7020;
        app.listen(PORT,'0.0.0.0', () => {
            console.log(`🚀 Inventory Microservice backend running on port ${PORT}`);
        });

    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
});

startServer();