const os = require("os");
const fs = require("fs");
const express = require("express");
const app = express();

const options = {
  key: fs.readFileSync("./private.pem"),
  cert: fs.readFileSync("./public.pem"),
};

const server = require("https").createServer(options, app);

// http server를 socket.io server로 upgrade한다
const io = require("socket.io")(server);

app.use(express.static("public"));

// localhost:3000으로 서버에 접속하면 클라이언트로 index.html을 전송한다
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  // message를 전달받고 나를 제외한 나머지 클라이언트들에게 message 전달
  socket.on("message", function (message) {
    console.log(`Client said: ${message}`);
    socket.broadcast.emit("message", message);
  });

  // 생성 또는 가입
  socket.on("create or join", function (room) {
    console.log(`Received request to create or join room: ${room}`);

    // room을 알아낸다음, 그 room에 속한 클라이언트 수를 알아낸다
    const clientsInRoom = io.sockets.adapter.rooms.get(room);

    const numClients = clientsInRoom ? clientsInRoom.size : 0;
    console.log("Room " + room + " now has " + numClients + " client(s)");

    // room안에 속한 클라이언트 수마다 다른 동작을 하겠끔 설정
    if (numClients === 0) {
      socket.join(room);
      console.log("Client ID " + socket.id + " created room " + room);
      socket.emit("created", room, socket.id);
    } else if (numClients === 1) {
      console.log("Client ID " + socket.id + " joined room " + room);
      socket.join(room);
      io.sockets.in(room).emit("join", room);
      // socket.emit("joined", room, socket.id);
      // io.sockets.in(room).emit("ready");
    } else {
      socket.emit("full", room); // max two clients
    }
  });

  // 그니까 음...서버의 공인 ip를 찾는건가?
  socket.on("ipaddr", function () {
    const ifaces = os.networkInterfaces();
    console.log(ifaces);
    for (let dev in ifaces) {
      ifaces[dev].forEach(function (details) {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("bye", function () {
    console.log("received bye");
  });
});

server.listen(18972, "192.168.35.127", function () {
  console.log("Socket IO server listening on port 3000");
});
