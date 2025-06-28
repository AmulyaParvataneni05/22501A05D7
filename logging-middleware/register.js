const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const PORT = '20.244.56.144';

app.use(express.json());

const userFilePath = './user.json';


function generateClientCredentials() {
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');
    return { clientId, clientSecret };
}

app.post('/evaluation-service/register', (req, res) => {
    const { email, name, mobileNo, githubUsername, rollNo, accessCode } = req.body;
    const { clientId, clientSecret } = generateClientCredentials();
    const userData = { email, name, mobileNo, githubUsername, rollNo, accessCode, clientId, clientSecret };
    fs.readFile(userFilePath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        const users = err ? [] : JSON.parse(data);
        users.push(userData);
        fs.writeFile(userFilePath, JSON.stringify(users, null, 2), 'utf8', (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to save user data' });
            }
            res.status(200).json({ email, name, rollNo, accessCode, clientId, clientSecret });
        });
    });
});
app.post('/evaluation-service/auth', (req, res) => {
    const { email, name, rollNo, accessCode, clientId, clientSecret } = req.body;
    fs.readFile(userFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        const users = JSON.parse(data);
        const user = users.find(user => user.email === email && user.rollNo === rollNo && user.accessCode === accessCode && user.clientId === clientId && user.clientSecret === clientSecret);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const accessToken = crypto.randomBytes(32).toString('hex');
        const expiresIn = 3600;
        res.status(200).json({
            token_type: 'Bearer',
            access_token: accessToken,
            expires_in: expiresIn
        });
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
