const axios = require('axios');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg'); // PostgreSQL database integration

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the "public" folder

// PostgreSQL Database Connection
// PostgreSQL Database Connection
const pool = new Pool({
    user: process.env.DB_USER,       // Render database username
    host: process.env.DB_HOST,       // Render database host
    database: process.env.DB_NAME,   // Render database name
    password: process.env.DB_PASSWORD, // Render database password
    port: process.env.DB_PORT,       // Render database port
    ssl: {
        rejectUnauthorized: false,   // Required for Render's PostgreSQL
    },
});

// Test database connection
pool.connect((err) => {
    if (err) {
        console.error('Error connecting to PostgreSQL database:', err);
    } else {
        console.log('Connected to PostgreSQL database!');
    }
});

// Session setup
app.use(
    session({
        secret: 'your-secret-key', // Change this to a secure, random value
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);

// Serve login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // List of valid users and passwords
    const validUsers = [
        { username: 'seyed', password: 'seyed' },
        { username: 'aldrin', password: 'aldrin' },
        { username: 'admin', password: 'admin' },
        { username: 'triage1', password: '1234' },
        { username: 'triage2', password: '1234' },
    ];

    // Check if the provided credentials match any valid user
    const user = validUsers.find(
        (u) => u.username === username && u.password === password
    );

    if (user) {
        req.session.isAuthenticated = true; // Mark user as authenticated
        req.session.username = username; // Store the username for reference
        return res.status(200).json({ message: 'Login successful!' });
    } else {
        return res.status(401).json({ message: 'Invalid username or password.' });
    }
});

// Middleware to protect routes
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next(); // User is authenticated, proceed to the next middleware/route
    } else {
        res.redirect('/'); // Redirect to login if not authenticated
    }
};

app.get('/submissions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM patients ORDER BY submitted_at DESC');
        const recentSubmissions = result.rows.map((submission) => {
            if (submission.dob) {
                submission.dob = new Date(submission.dob).toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }
            return {
                ...submission,
                canDelete: ['seyed', 'aldrin'].includes(req.session.username), // seyed and aldrin can delete
            };
        });
        res.status(200).json(recentSubmissions);
    } catch (err) {
        console.error('Error fetching patients:', err);
        res.status(500).json({ message: 'Failed to fetch patients.' });
    }
});

const translateText = async (text, targetLanguage = 'en') => {
    const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com/translate';
    const subscriptionKey = process.env.AZURE_TRANSLATOR_KEY;
    const region = process.env.AZURE_REGION;

    if (!subscriptionKey || !region) {
        throw new Error('Azure Translator API key or region is missing.');
    }

    try {
        const response = await axios.post(
            `${endpoint}?api-version=3.0&to=${targetLanguage}`,
            [{ Text: text }],
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': subscriptionKey,
                    'Ocp-Apim-Subscription-Region': region,
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.data[0].translations[0].text; // Translated text
    } catch (error) {
        console.error('Error during translation:', error.response?.data || error.message);
        throw new Error('Translation failed.');
    }
};
        return response.data[0].translations[0].text; // Translated text
    } catch (error) {
        console.error('Error during translation:', error.response?.data || error.message);
        throw new Error('Translation failed.');
    }
};
// Endpoint to fetch full form data for a specific patient
app.get('/submission/:id', requireAuth, async (req, res) => {
    const patientId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM patients WHERE code = $1', [patientId]);
        if (result.rows.length > 0) {
            const patient = result.rows[0];
            // Format the dob field
            if (patient.dob) {
                patient.dob = new Date(patient.dob).toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }
            res.status(200).json(patient);
        } else {
            res.status(404).json({ message: 'Patient not found.' });
        }
    } catch (err) {
        console.error('Error fetching patient:', err);
        res.status(500).json({ message: 'Failed to fetch patient.' });
    }
});

// Endpoint to handle form submissions
app.post('/submit', async (req, res) => {
    const {
        code,
        name,
        dob,
        painScore,
        complaints,
        complaintNotes,
        notes,
        allergies,
        allergyExplanation,
        medicine,
        medicineExplanation,
        chronicCondition,
        chronicConditionExplanation,
        surgery,
        surgeryExplanation,
        travelHistory,
        travelHistoryExplanation,
    } = req.body;

    try {
        // Translate necessary fields to English
        const translatedName = await translateText(name || '', 'en');
        const translatedComplaints = complaints
            ? await Promise.all(complaints.map((c) => translateText(c, 'en')))
            : [];
        const translatedComplaintNotes = await translateText(complaintNotes || '', 'en');
        const translatedNotes = await translateText(notes || '', 'en');
        const translatedAllergyExplanation = await translateText(allergyExplanation || '', 'en');
        const translatedMedicineExplanation = await translateText(medicineExplanation || '', 'en');
        const translatedChronicConditionExplanation = await translateText(
            chronicConditionExplanation || '',
            'en'
        );
        const translatedSurgeryExplanation = await translateText(surgeryExplanation || '', 'en');
        const translatedTravelHistoryExplanation = await translateText(
            travelHistoryExplanation || '',
            'en'
        );

        // Insert into the database
        const query = `
            INSERT INTO patients (code, name, dob, pain_score, complaints, complaint_notes, notes,
                allergies, allergy_explanation, medicine, medicine_explanation, chronic_condition,
                chronic_condition_explanation, surgery, surgery_explanation, travel_history, travel_history_explanation)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `;

        await pool.query(query, [
            code || `MPHT-${Date.now().toString(36).toUpperCase()}`,
            translatedName,
            dob,
            painScore,
            JSON.stringify(translatedComplaints),
            translatedComplaintNotes,
            translatedNotes,
            allergies,
            translatedAllergyExplanation,
            medicine,
            translatedMedicineExplanation,
            chronicCondition,
            translatedChronicConditionExplanation,
            surgery,
            translatedSurgeryExplanation,
            travelHistory,
            translatedTravelHistoryExplanation,
        ]);

        res.status(200).json({ message: 'Patient submitted successfully!' });
    } catch (err) {
        console.error('Error inserting patient:', err);
        res.status(500).json({ message: 'Failed to submit patient.' });
    }
});

// Serve patients page (protected)
app.get('/patients', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patients.html'));
});

// Endpoint to delete a patient (protected)
app.delete('/delete-patient/:id', requireAuth, async (req, res) => {
    const patientId = req.params.id;

    // Only allow "seyed" to delete
    if (!['seyed', 'aldrin'].includes(req.session.username)) {
    return res.status(403).json({ message: 'Unauthorized access.' });
}

    try {
        const result = await pool.query('DELETE FROM patients WHERE code = $1', [patientId]);
        if (result.rowCount > 0) {
            console.log(`Patient with ID ${patientId} removed.`);
            res.status(200).json({ message: 'Patient removed successfully.' });
        } else {
            res.status(404).json({ message: 'Patient not found.' });
        }
    } catch (err) {
        console.error('Error removing patient:', err);
        res.status(500).json({ message: 'Failed to remove patient.' });
    }
});

// Endpoint to get logged-in username
app.get('/get-user', (req, res) => {
    if (req.session.isAuthenticated) {
        res.status(200).json({ username: req.session.username });
    } else {
        res.status(401).json({ message: 'Not authenticated.' });
    }
});

// Handle logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed.' });
        }
        res.redirect('/'); // Redirect to login page after logout
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

