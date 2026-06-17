const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8020;

// Setup Gmail Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Shortcut parameter for Gmail architecture mapping
    auth: {
        user: process.env.EMAIL_USER, // Your full gmail address
        pass: process.env.EMAIL_PASS  // The 16-character App Password
    }
});

app.post('/api/notifications/send', async (req, res) => {
    const { type, recipient, message, priority } = req.body;

    if (!recipient || !message || !type) {
        return res.status(400).json({ error: 'Missing fields.' });
    }

    try {
        if (type === 'EMAIL') {
            await transporter.sendMail({
                from: process.env.EMAIL_USER, // Gmail requires this to match the auth user
                to: recipient,
                subject: priority === 'HIGH' ? '🚨 CRITICAL EMERGENCY ALERT' : 'Platform Notification',
                text: message
            });
            console.log(`[Notification Service] Real Gmail sent to ${recipient}`);
        }

        return res.status(200).json({
            status: 'SUCCESS',
            message: `Notification successfully sent via Gmail.`
        });

    } catch (error) {
        console.error('[Notification Service Error]:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Notification Backend running on port ${PORT}`);
});