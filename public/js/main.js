let isInitiator = false; // room이 생성되었다
let isChannelReady = false; // 1:1 매핑이 되었다
let isStarted = false; // 시작되었다
let pc;
let localStream;
let remoteStream;

const pcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

//////////////////////////////////////////////////
const room = "foo";
const socket = io.connect("https://192.168.35.127:18972");

if (room) {
  socket.emit("create or join", room); // 생성 혹은 가입 요청을 보냄
  console.log("Attempted to create or  join room", room);
}

// room에 한명도 없이 새로 생성된 경우
socket.on("created", function (room) {
  console.log("Created room " + room);
  isInitiator = true;
});

// room이 꽉찼다면
socket.on("full", function (room) {
  console.log("Room " + room + " is full");
});

// 다른 사용자와 1:1 매칭이 된 경우
socket.on("join", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isChannelReady = true;
});

// socket.on("joined", function (room) {
//   console.log("joined: " + room);
//   isChannelReady = true;
// });

//////////////////////////////////////////////////
function sendMessage(message) {
  console.log("Client sending message: ", message);
  socket.emit("message", message);
  // 서버에 메시지를 보내면 해당 방에 다른 사람한테 그 메시지가 전달 되겠지?
}

// This client receives a message
socket.on("message", function (message) {
  console.log("Client received message:", message);
  if (message === "got user media") {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    console.log(new RTCSessionDescription(message));
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === "answer" && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === "candidate" && isStarted) {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc.addIceCandidate(candidate);
  } else if (message === "bye" && isStarted) {
    handleRemoteHangup();
  }
});

//////////////////////////////////////////////////
const localVideo = document.querySelector("#localVideo"); // 현재 내 화면
const remoteVideo = document.querySelector("#remoteVideo"); // 다른 사람 화면

navigator.mediaDevices
  .getUserMedia({
    audio: false,
    video: true,
  })
  .then(gotStream)
  .catch(function (e) {
    alert("getUserMedia() error: " + e.name);
  });

function gotStream(stream) {
  console.log("Adding local stream.");
  localStream = stream;
  localVideo.srcObject = stream; // 내 화면을 보여주는거 같음
  sendMessage("got user media");
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  console.log(">>>>>>> maybeStart() ", isStarted, localStream, isChannelReady);
  // 처음 시작하는거고, 로컬영상이 잘 나오고, 1:1매핑이 된 경우
  if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
    console.log(">>>>>> creating peer connection");
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log("isInitiator", isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

// 연결 객체 생성하는거 아닌가?
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log("Created RTCPeerConnnection");
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    return;
  }
}

// 연결 후보 찾기?
function handleIceCandidate(event) {
  console.log("icecandidate event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
}

// 다른 사람 스트림(영상) 연결?
function handleRemoteStreamAdded(event) {
  console.log("Remote stream added.");
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

// 다른 사람 스트림(영상) 연결 해제
function handleRemoteStreamRemoved(event) {
  console.log("Remote stream removed. Event: ", event);
}

/////////////////////////////////////////////////
// 피어에게 제안 보내기?
function doCall() {
  console.log("Sending offer to peer");
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

// 피어 제안에 답변하기
function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log("setLocalAndSendMessage sending message", sessionDescription);
  sendMessage(sessionDescription);
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

function onCreateSessionDescriptionError(error) {
  trace("Failed to create session description: " + error.toString());
}

//////////////////////////////////////////////////
function handleRemoteHangup() {
  console.log("Session terminated.");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
