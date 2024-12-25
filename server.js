const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the "public" folder

// Session setup
app.use(
    session({
        secret: 'your-secret-key', // Change this to a secure, random value
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);

let submissions = []; // In-memory storage for form submissions

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

// Endpoint to fetch all submissions from the last 24 hours
app.get('/submissions', requireAuth, (req, res) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    const recentSubmissions = submissions.map((submission) => ({
        ...submission,
        canDelete: req.session.username === 'seyed', // Only seyed can delete
    }));

    console.log("Sending submissions with canDelete:", recentSubmissions);
    res.status(200).json(recentSubmissions);
});

// Endpoint to fetch full form data for a specific patient
app.get('/submission/:id', requireAuth, (req, res) => {
    const patientId = req.params.id;
    const submission = submissions.find((patient) => patient.code === patientId);

    if (submission) {
        res.status(200).json(submission);
    } else {
        res.status(404).json({ message: 'Patient not found.' });
    }
});

// Endpoint to handle form submissions
app.post('/submit', (req, res) => {
    const formData = {
        code: req.body.code || `MPHT-${Date.now().toString(36).toUpperCase()}`,
        name: req.body.name,
        dob: req.body.dob,
        painScore: req.body.painScore,
        complaints: req.body.complaints || [],
        complaintNotes: req.body.complaintNotes || '',
        notes: req.body.notes || '',
        allergies: req.body.allergies || 'No',
        allergyExplanation: req.body.allergyExplanation || '',
        medicine: req.body.medicine || 'No',
        medicineExplanation: req.body.medicineExplanation || '',
        chronicCondition: req.body.chronicCondition || 'No',
        chronicConditionExplanation: req.body.chronicConditionExplanation || '',
        surgery: req.body.surgery || 'No',
        surgeryExplanation: req.body.surgeryExplanation || '',
        travelHistory: req.body.travelHistory || 'No',
        travelHistoryExplanation: req.body.travelHistoryExplanation || '',
        submittedAt: new Date(),
    };

    console.log('Received submission:', formData);

    submissions.push(formData);
    res.status(200).json({ message: 'Form submitted successfully!' });
});

// Serve patients page (protected)
app.get('/patients', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patients.html'));
});

// Endpoint to delete a patient (protected)
app.delete('/delete-patient/:id', requireAuth, (req, res) => {
    const patientId = req.params.id;

    // Only allow "seyed" to delete
    if (req.session.username !== 'seyed') {
        return res.status(403).json({ message: 'Unauthorized access.' });
    }

    const index = submissions.findIndex((patient) => patient.code === patientId);
    if (index !== -1) {
        submissions.splice(index, 1);
        console.log(`Patient with ID ${patientId} removed.`);
        res.status(200).json({ message: 'Patient removed successfully.' });
    } else {
        res.status(404).json({ message: 'Patient not found.' });
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
