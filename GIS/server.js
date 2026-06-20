// gis-server.js
const express = require('express');
const geolib = require('geolib');
const cors = require('cors');
const dns = require("dns"); 

// Force DNS resolution for certain deployment environments
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();
app.use(cors());
app.use(express.json());

// Set the required radius (50km = 50,000 meters)
const RADIUS_IN_METERS = 50000; 

// ==========================================
// 📍 GIS ENDPOINT: Filter Nearby Centers
// ==========================================
app.post('/api/v1/gis/filter-nearby', (req, res) => {
    try {
        const { userLocation, centers } = req.body;

        // 1. Validate the incoming data
        if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
            return res.status(400).json({ error: "Missing or invalid userLocation." });
        }
        if (!centers || !Array.isArray(centers)) {
            return res.status(400).json({ error: "Missing centers array." });
        }

        // 2. Perform Spatial Math on the list of centers
        const nearbyCenters = centers.filter(center => {
            // If a center is missing coordinates in the DB, skip it
            if (!center.latitude || !center.longitude) return false;

            // Calculate the exact straight-line distance over the curvature of the earth
            const distance = geolib.getDistance(
                { latitude: userLocation.latitude, longitude: userLocation.longitude },
                { latitude: center.latitude, longitude: center.longitude }
            );

            // Optional: Attach the calculated distance to the object
            // This allows the frontend to show "Center A (12 km away)"
            center.distanceFromUserMeters = distance;

            // Return true ONLY if the distance is 50,000 meters or less
            return distance <= RADIUS_IN_METERS;
        });

        // 3. Sort the remaining centers from closest to furthest (Great UX feature!)
        nearbyCenters.sort((a, b) => a.distanceFromUserMeters - b.distanceFromUserMeters);

        // 4. Send the result back to the Resource Service
        res.status(200).json({
            originalCount: centers.length,
            nearbyCount: nearbyCenters.length,
            radiusUsedMeters: RADIUS_IN_METERS,
            nearbyCenters: nearbyCenters
        });

    } catch (error) {
        console.error("GIS Calculation Error:", error);
        res.status(500).json({ error: "Internal GIS Server Error" });
    }
});

// Run this service on port 7030 (so it doesn't clash with your Inventory on 7020)
const PORT = process.env.PORT || 7030;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌍 GIS Spatial Microservice running on port ${PORT}`);
});