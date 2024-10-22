const socket = io('http://localhost:3000');

let currentRoomId = null;
let username = null;
let timerInterval; // Untuk interval timer
let timeLeft = 15; // Misalkan waktu 30 detik untuk setiap pertanyaan

// Saat user mengirim pesan
document.getElementById('createRoom').addEventListener('click', () => {
    username = document.getElementById('username').value;
    if (username) {
        socket.emit('createRoom', { username });
    }
});

document.getElementById('joinRoom').addEventListener('click', () => {
    username = document.getElementById('username').value;
    if (username) {
        socket.emit('joinRoom', { username });
    }
});

socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('usernameInput').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
});

socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('usernameInput').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
});

// Tampilkan pertanyaan baru
socket.on('newQuestion', (data) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'block';

  document.getElementById('questionImage').src = data.image_url;
  document.getElementById('questionText').textContent = data.question;

  // Update options dynamically
  const buttons = document.querySelectorAll('.answerBtn');
  buttons.forEach((button, index) => {
      button.textContent = data.options[index];
      button.disabled = false; // Aktifkan kembali tombol
      button.classList.remove('bg-green-500'); // Reset highlight dari tombol sebelumnya

      // Kirim jawaban saat tombol diklik
      button.onclick = () => {
          socket.emit('submitAnswer', { roomId: currentRoomId, answer: data.options[index] });
          highlightSelectedButton(button); // Menandai tombol yang dipilih
          // Nonaktifkan tombol setelah memilih jawaban
          buttons.forEach(btn => btn.disabled = true);
      };
  });

  // Reset dan mulai timer
  resetTimer();
});


function highlightSelectedButton(button) {
  button.classList.add('bg-green-500'); // Ubah warna tombol yang dipilih
}


// Reset dan mulai timer
function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = 15; // Reset waktu
    document.getElementById('timer').textContent = `Time left: ${timeLeft} seconds`;

    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = `Time left: ${timeLeft} seconds`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Kirim jawaban otomatis atau lakukan aksi lain saat waktu habis
            alert('Time is up!');
            document.querySelectorAll('.answerBtn').forEach(btn => btn.disabled = true);
        }
    }, 1000);
}

// Tampilkan hasil jawaban
socket.on('answerResult', (data) => {
    alert(`Correct answer: ${data.correct_answer}`);
    
    data.players.forEach((player) => {
        document.getElementById(`player${player.username}Score`).textContent = `${player.username}: ${player.score}`;
    });
});

// Tampilkan game over
socket.on('gameOver', (data) => {
    alert('Game over!');
    console.log(data.players);
});

// Fungsi untuk menandai tombol yang dipilih
function highlightSelectedButton(button) {
  button.classList.add('bg-green-500'); // Ubah warna tombol yang dipilih
  button.classList.remove('bg-blue-400'); // Hapus warna sebelumnya
}

// Tampilkan hasil jawaban
socket.on('answerResult', (data) => {
  alert(`Correct answer: ${data.correct_answer}`);
  
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = ''; // Kosongkan leaderboard sebelum mengupdate

  data.players.forEach((player) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${player.username}: ${player.score}`;
      listItem.id = `player${player.username}Score`;
      leaderboard.appendChild(listItem);
  });
});
