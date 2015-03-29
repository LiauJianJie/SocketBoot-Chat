var app = require('express')();
var _ = require('lodash');
var http = require('http').Server(app);
// var MongoStore = require('mong.socket.io');
var io = require('socket.io')(http);
// var app = express.createServer();
// io = io.listen(app);

// app.listen(8000);

var manager = {
  users: [] // users: array of user{socketId,nickname}
};

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

// io.configure(function() {
//     var store = new MongoStore({url: process.env.MONGOLAB_URI || 'mongodb://localhost:27017/socketboot_chat'});
//     store.on('error', console.error);
//     io.set('store', store);
// });

// NEW CONNECTION
io.on('connection', function(socket){
  console.log(socket.id + ' connected ');
  manager.clientConnect(socket);

  // DISCONNECT
  socket.on('disconnect', function(){
    console.log(socket.id + ' disconnected ');
    manager.clientDisconnect(socket);
  });

  // NICKNAME REQUEST
  socket.on('nickname-request', function(nickname){
    console.log(socket.id + ' requested nickname ' + nickname);
    manager.clientRequestNickname(socket, nickname);
  });

  // NICKNAME SET AND JOINED
  socket.on('joined', function(){
    console.log(socket.id + ' joined');
    manager.clientJoined(socket);
  });

  // MESSAGE SEND FROM CLIENT
  socket.on('message-send', function(content){
    console.log(socket.id + ': ' + content);
    manager.messageSend(socket, content);
  });

});

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:' + (process.env.PORT || 3000));
});

/* MANAGER FUNCTION DEFINITIONS */

/* CLIENT (RECEIPIENT) MESSAGES
 * nickname-request: nicknameAllowed, nickname
 * message-received: senderNickname, content
 * ??? message-response: messageSent, failureReason
 * status: type, nickname
 */

manager.clientConnect = function(socket){
  manager.users.push({
    socketId: socket.id,
    nickname: null
  });
};

manager.clientDisconnect = function(socket){
  io.emit('status',{
    type: 'disconnect',
    nickname: manager._nicknameForSocket(socket)
  });
  _.remove(manager.users, {socketId: socket.id});
};

manager.clientRequestNickname = function(socket,nickname){
  if (manager._indexForNickname(nickname) == -1)
  {
    manager.nicknameRegister(socket,nickname);
  }
  else
  {
    manager.denyNickname(socket,nickname);
  }
};

manager.nicknameRegister = function(socket,nickname){
  var _index = manager._indexForSocket(socket);
  if (_index != -1)
  {
    manager.users.splice(_index, 1, {
      socketId: socket.id,
      nickname: nickname
    });
    socket.emit('nickname-request', {
      nicknameAllowed: true,
      nickname: nickname
    });
    io.emit('user-joined', nickname);
    console.log(socket.id + ' nickname is now ' + nickname);
  }
  else
  {
    console.log(socket.id + ' socket id not found');
  }
};

manager.denyNickname = function(socket,nickname){
  socket.emit('nickname-request', {
    nicknameAllowed: false,
    nickname: nickname
    });
  console.log(socket.id + ' denied of nickname ' + nickname);
};

manager.clientJoined = function(socket){
  io.emit('status',{
    type: 'join',
    nickname: manager._nicknameForSocket(socket)
  });
};

manager.messageSend = function(socket,content){
  io.emit('message-received', {
    nickname: manager._nicknameForSocket(socket),
    content: content
  });
};

/* HELPER FUNCTIONS */

manager._nicknameForSocket = function(socket){
  var _index = manager._indexForSocket(socket);
  if (_index != -1)
    return manager.users[_index].nickname;
  else
    return null;
};

manager._indexForSocket = function(socket){
  return _.findIndex(manager.users, 'socketId', socket.id);
};

manager._indexForNickname = function(nickname){
  return _.findIndex(manager.users, 'nickname', nickname);
};
