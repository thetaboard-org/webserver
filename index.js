const express = require('express');
const http = require('http');
const path = require('path');
const expressStaticGzip = require("express-static-gzip");

const app = express();
const router = express.Router();
http.createServer(app);

app.use('/', expressStaticGzip('public'));
// Server port
const HTTP_PORT = process.env.PORT || 8000;
// Start server
app.listen(HTTP_PORT, () => {
    console.log("Server running on port %PORT%".replace("%PORT%", HTTP_PORT))
});

// env variables
const is_public = "PUBLIC" in process.env && process.env.PUBLIC;

// isPublic
app.get("/is-public", async (req, res, next) => {
    try {
        res.json({success: true, is_public: is_public});
    } catch (error) {
        res.status(400).json(error.response.body);
    }
});

// Explorer Info
app.use('/explorer', require('./router/explorer').router);
app.use('/guardian', require('./router/guardian').router);

// Default response for any other request
app.use(function (req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});


