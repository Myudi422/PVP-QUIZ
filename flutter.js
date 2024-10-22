const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors()); // Enable CORS

// Load quiz questions from file
let quizData;
fs.readFile('./quiz.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading quiz.json:', err);
  } else {
    quizData = JSON.parse(data);
    console.log('Quiz data loaded successfully');
  }
});

// Players and rooms setup
const players = {};
const rooms = {};

// Helper function to find opponent
function findOpponent(socketId) {
  return Object.values(players).find(player => player.id !== socketId);
}

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('message', (telegramId) => {
    console.log(`Player ${telegramId} is looking for a match...`);
  
    // If there's a player waiting, match them
    if (Object.keys(players).length > 0) {
      const opponent = findOpponent(socket.id);
      if (opponent) {
        const matchId = `${socket.id}-${opponent.id}`;
        rooms[matchId] = { players: [socket.id, opponent.id], quiz: quizData, scores: {} };
        
        // Initialize scores
        rooms[matchId].scores[socket.id] = 0;
        rooms[matchId].scores[opponent.id] = 0;
  
        socket.join(matchId);
        io.to(opponent.id).emit('match_found', matchId); // Emit match_found to opponent
        io.to(socket.id).emit('match_found', matchId);   // Emit match_found to current player
  
        console.log('Match found, starting the quiz...');
  
        const startTime = Date.now();
        io.to(matchId).emit('start_quiz', { startTime, questions: quizData });  // Emit quiz data to both players
  
        // Remove from waiting list
        delete players[opponent.id];
      }
    } else {
      // Add player to waiting list
      players[socket.id] = { id: socket.id, telegramId };
    }
  });
  

  // Handle submitted answers
  socket.on('submit_answer', ({ matchId, answer, questionIndex }) => {
    const room = rooms[matchId];
    const correctAnswer = room.quiz.questions[questionIndex].correct_answer;

    if (answer === correctAnswer) {
      room.scores[socket.id] += 1; // Add point if correct
    }

    if (questionIndex + 1 === room.quiz.questions.length) {
      // Quiz ended
      const player1 = room.players[0];
      const player2 = room.players[1];
      const winner = room.scores[player1] > room.scores[player2] ? player1 : player2;

      io.to(matchId).emit('game_over', {
        winner,
        player1Points: room.scores[player1],
        player2Points: room.scores[player2]
      });

      delete rooms[matchId];
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    if (players[socket.id]) delete players[socket.id];
    const matchId = socket.matchId;
    if (matchId && rooms[matchId]) delete rooms[matchId];
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});
