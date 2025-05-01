const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms={};

//start game will be trigerred when the room has 2 or more player ready to play------------------------------------------

  const startGame=(roomId)=>{
     const playerRoom = rooms[roomId];
     if(!playerRoom) return;

     const drawer = playerRoom.players[playerRoom.currentPlayerIndex];
     const word = getRandomWord();
     playerRoom.word = word;  // Save the word to the room's data
     io.to(drawer.id).emit("wordToDraw" , word); 
     io.to(roomId).emit("turnStarted",{drawerName : drawer.name , wordLength : word.length});
     
     startRoundTimer(roomId);

     playerRoom.turnTimer = setTimeout(()=>{endTurn(roomId);},30000);
  };


//start the round timer everytime the new player starts the game

  const startRoundTimer=(roomId)=>{
    let timeLeft = 300;
    rooms[roomId].timer = setInterval(()=>{
      if(timeLeft>0){
        timeLeft--;
        io.to(roomId).emit("timerUpdate",timeLeft);
      }
      else{
        clearInterval(rooms[roomId].timer);
        rooms[roomId].timer = null;
      }
    },100);  // the timer updates after every 1 second
  };


//end the turn and shift it to the next player----------------------------------------------

  const endTurn=(roomId)=>{
      const playerRoom = rooms[roomId];
      if(!playerRoom) return;

      clearTimeout(playerRoom.turnTimer);
      clearInterval(playerRoom.timer);
      playerRoom.currentPlayerIndex = (playerRoom.currentPlayerIndex + 1)% playerRoom.players.length;
      startGame(roomId);
  };

// getting the random word and giving it to the player-----------------------------------------------------

  const getRandomWord=()=>{
    const words = ["Kangaroo", "Wand", "Surfboard", "UFO", "Pirate",
                   "Volcano", "Watermelon", "Dinosaur", "Tornado", "Time",
                   "Spaceship", "Maze", "Werewolf", "Vampire", "Factory", "Superhero",
                   "Haunted", "Genie","Treasure", "Alien",  "Astronaut","Bicycle", 
                   "Guitar", "Airplane", "Spider", "Rocket",  "Fire", 
                   "Tent", "Elephant", "Sandwich", "Lighthouse",
                   "Bat", "Scissors", "Telephone", "Bridge", "Snowman",
                   "Soccer", "Waterfall", "Treasure", "Castle", "Train",
                   "Pyramid", "Submarine", "Octopus", "Dragon", "Cave",
                   "Windmill", "Turtle", "Chessboard", "Snail", "Telescope",
                   'apple', 'car', 'house', 'dog', 'tree', 'banana', 'computer', 'elephant',
                   "Reflection", "Dream", "Giant",
                   "Fairy","Samurai", "Shadow",
                   "Carnival", "Shooting",  "Puzzle",
                   "Cube",  "Magic",  "Scientist",
                   "Laboratory","Dimension", "Castle",
                   "Treasure", "Battle", "Universe", "Galaxy"];
    
    const randomIndex = Math.floor(Math.random()*words.length);
    return (words[randomIndex]);
  };

// const avatars = [
//     "https://api.dicebear.com/7.x/pixel-art/svg?seed=",
//     "https://api.dicebear.com/7.x/adventurer/svg?seed=",
//     "https://api.dicebear.com/7.x/identicon/svg?seed="
// ];


// making the connection socket -------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log('New client connected:', socket.id);
  let currentUser = null;
  let currentRoom =null;


// joining the room socket with the id -------------------------------------------------------------------------

  socket.on("joinroom", ({ roomId, name }) => {
    
    // const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)] + name;
    // const avatarUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${name}&size=60&radius=50`;
    // Randomly select a background color
    // const backgroundColors = ["b6e3f4", "c0aede", "d1d4f9", "red", "blue"];
    // const randomBgColor = backgroundColors[Math.floor(Math.random() * backgroundColors.length)];

    // Use Lorelei avatar API with background color and gradient type
    const avatarUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${name}&size=70&radius=50&backgroundColor=5de0e6,004aad,94b9ff&backgroundType=gradientLinear`;
    // const avatarUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${name}&size=70&radius=50&backgroundColor=4B164C,780C28,4635B1&backgroundType=gradientLinear`;

    currentRoom=roomId;
    currentUser={id : socket.id ,name,score:0 ,avatar: avatarUrl};
    socket.join(roomId);
    console.log(`${name} joined room ${roomId}`);
    if(!rooms[roomId]){
      rooms[roomId]={players:[],currentPlayerIndex :0 ,turnTimer: null, timer: null};
    }
    rooms[roomId].players.push(currentUser);
    io.to(roomId).emit("updatePlayerList" , rooms[roomId].players);

    if(rooms[roomId].players.length >=2 && rooms[roomId].players.length ===2){
      startGame(roomId);
    }
  });



// drawing on the canvas socket -------------------------------------------------------------------------

  socket.on("drawing", (data) => {
    const { roomId, startX, startY, endX, endY, width, height,stroke } = data;
    const receivedTime = Date.now();
    // Emit drawing data along with the canvas width/height
    socket.to(roomId).emit("drawing", { startX, startY, endX, endY, width, height,stroke ,receivedTime  });
  });


// clearing the canvas socket -------------------------------------------------------------------------

   socket.on("clearCanvas", (roomId) => {
    socket.to(roomId).emit("clearCanvas");
  });


// undo redo socket updating the canvas setup -------------------------------------------------------------------------

    socket.on('updateStacks', ({ roomId, undo, redo }) => {
    socket.to(roomId).emit('updateStacks', { undo, redo });
  });
   

// chating socket -------------------------------------------------------------------------

     // socket.on("chatMessage",(data)=>{
     //    const {roomId,sender,text}= data;
     //    socket.to(roomId).emit("chatMessage",{sender,text});
     // });

// guessing chat socket---------------------------------------------------------------------------------
     socket.on("guessSubmit",({roomId,guess,playerName,time,drawerName})=>{
        const playerRoom = rooms[roomId];
        if(!playerRoom || !playerRoom.word ) return;
        const guessingPlayer = playerRoom.players.find(player=>player.name===playerName);
        if(guess.toLowerCase() === playerRoom.word.toLowerCase()){
          // io.to(roomId).emit("correctGuess" , {playerName});
          io.to(roomId).emit("chatMessage", { sender: `${playerName}`, text: `Has guessed the correct word! 🎉`, isCorrect: true});
          io.to(roomId).emit("chatMessage", { sender: "Word", text: `${playerRoom.word}` });
          //find the player who has made the correct guess and the score will be increased
          // const guessingPlayer = playerRoom.players.find(player=>player.name===playerName);
          const drawingPlayer = playerRoom.players.find(player=>player.name===drawerName);
          if(guessingPlayer){
            guessingPlayer.score += Math.max(50 - ((30-time) * 2), 10);   // add dynamic points to the correct guesser
            drawingPlayer.score += Math.max(40 - ((30-time) * 2), 10);   // add dynamic points to the correct guesser
            if(guessingPlayer.score >=500 ){
              io.to(roomId).emit("gameOver",{winner:guessingPlayer.name , score:guessingPlayer.score});
              delete rooms[roomId];
              return;
            }
            else if(drawingPlayer.score >=500){
              io.to(roomId).emit("gameOver",{winner:drawingPlayer.name , score:drawingPlayer.score});
              delete rooms[roomId];
              return;
            }
          }

          // emit the updated score to everyone in the room 
           io.to(roomId).emit("updatePlayerList",playerRoom.players);
           endTurn(roomId); // pass the control to next player without waiting for the timer to end
        }
        else
        {
          // socket.emit("wrongGuess");
          guessingPlayer.score -= Math.min(guessingPlayer.score , 10);   // deduct 10 points or the minimum point  to the wrong guess
          io.to(roomId).emit("chatMessage", { sender: playerName, text: guess , isCorrect: false });
          io.to(roomId).emit("updatePlayerList",playerRoom.players);     // emit the updated score to everyone in the room 
        }
     });

//disconnect socket function-------------------------------------------------------------------------------------
     
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentRoom && currentUser && rooms[currentRoom]) {
      rooms[currentRoom].players=rooms[currentRoom].players.filter((player)=>player.id !== socket.id);

      if(rooms[currentRoom].players.length===0){
        delete rooms[currentRoom];
        console.log(`room : ${currentRoom} has been deleted`);
       }
       else
       {
        io.to(currentRoom).emit("updatePlayerList",rooms[currentRoom].players);
       }
      // statement
    }

  });
});


// server running function----------------------------------------------

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});



