const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Serve the "static" directory for other static files
app.use('/', express.static(path.join(__dirname, 'www')));

// Serve the "lib" directory for libraries
app.use('/lib', express.static(path.join(__dirname, 'www', 'lib')));

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

app.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
});
