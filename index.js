const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); 
const fs = require('fs');

// Inisialisasi Express
const app = express();

// Aktifkan CORS
app.use(cors()); 

const server = http.createServer(app);

// Aktifkan CORS di Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Izinkan semua domain
    methods: ['GET', 'POST'], // Metode HTTP yang diizinkan
    credentials: true // Izinkan kredensial
  }
});

// Muat data kuis dari file JSON
const quizData = JSON.parse(fs.readFileSync('quiz.json', 'utf-8'));

let rooms = {};

// Saat user terhubung
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ username }) => {
    const roomId = `room-${Math.floor(Math.random() * 10000)}`;
    rooms[roomId] = {
      players: [{ id: socket.id, username, score: 0 }],
      quizIndex: 0, // Pastikan quizIndex diinisialisasi dengan benar
      answers: {},
      questionTimeout: null
    };
    socket.join(roomId);
    io.to(socket.id).emit('roomCreated', { roomId });
    console.log(`Room ${roomId} created by ${username}`);
  });
  

  socket.on('joinRoom', ({ username }) => {
    let roomId = null;

    for (let id in rooms) {
      if (rooms[id].players.length < 2) {
        roomId = id;
        break;
      }
    }

    if (roomId) {
      rooms[roomId].players.push({ id: socket.id, username, score: 0 });
      socket.join(roomId);
      io.to(socket.id).emit('roomJoined', { roomId });
      console.log(`${username} joined ${roomId}`);

      if (rooms[roomId].players.length === 2) {
        startQuiz(roomId);
      }
    } else {
      io.to(socket.id).emit('roomFull', { message: 'Room is full or not available' });
    }
  });

  const startQuiz = (roomId) => {
    const room = rooms[roomId];
    const question = quizData[room.quizIndex];

    io.in(roomId).emit('newQuestion', {
      question: question.question,
      image_url: question.image_url,
      options: question.options
    });

    room.questionTimeout = setTimeout(() => {
      evaluateAnswers(roomId);
    }, 15000); 
  };

  const evaluateAnswers = (roomId) => {
    const room = rooms[roomId];
    
    // Cek apakah room ada dan memiliki properti quizIndex
    if (!room || typeof room.quizIndex === 'undefined') {
      console.error(`Room with ID ${roomId} not found or quizIndex is undefined.`);
      return;
    }
  
    const question = quizData[room.quizIndex];
  
    room.players.forEach(player => {
      const answer = room.answers[player.id];
      if (answer === question.correct_answer) {
        player.score += 1;
      }
    });
  
    io.in(roomId).emit('answerResult', {
      correct_answer: question.correct_answer,
      players: room.players.map(p => ({ username: p.username, score: p.score }))
    });
  
    room.answers = {};
    room.quizIndex++;
  
    if (room.quizIndex < quizData.length) {
      setTimeout(() => startQuiz(roomId), 5000);
    } else {
      io.in(roomId).emit('gameOver', {
        players: room.players.map(p => ({ username: p.username, score: p.score }))
      });
    }
  };
  

  socket.on('submitAnswer', ({ roomId, answer }) => {
    const room = rooms[roomId];
    if (room) {
      room.answers[socket.id] = answer;

      if (Object.keys(room.answers).length === room.players.length) {
        clearTimeout(room.questionTimeout);
        evaluateAnswers(roomId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  
    for (let roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(player => player.id === socket.id);
  
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
  
        if (room.players.length === 0) {
          // Hapus timer jika room dihapus
          if (room.questionTimeout) clearTimeout(room.questionTimeout);
          delete rooms[roomId];
        } else {
          io.in(roomId).emit('gameOver', { message: 'Your opponent has disconnected. Game over.' });
        }
  
        break;
      }
    }
  });
  
});


// Jalankan server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
