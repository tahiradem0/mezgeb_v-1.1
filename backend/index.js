require('dotenv').config();
const app = require('./src/app');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mezgeb';

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
    socket.on('joinGroup', (groupId) => {
        socket.join(groupId);
    });
});

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });
