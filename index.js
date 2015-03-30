var app = require('express')();
var _ = require('lodash');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mongoose = require('mongoose');

/* MONGOOSE */

mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/socketboot_chat');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log('MongoDB open');
});

// MESSAGE SCHEMA
var messageSchema = mongoose.Schema({
    // channel: {type: String, default:'general'},
    date: {type: Date, default:Date.now},
    content: String
});

var Message = mongoose.model('Message', messageSchema);

var manager = {
  users: [] // users: array of user{socketId,nickname,isTyping}
};

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

// NEW CONNECTION
io.on('connection', function(socket){
  console.log(socket.id + ' connected ');
  manager.clientConnect(socket);
  socket.emit('populate-ready');

  // POPULATE FROM MONGOOSE
  socket.on('populate-request', function(date){
    if (date)
    {
      Message.find({date: date})
             .sort('date')
             .exec(function(err, messages) {
        if (err) { console.log(err); }
        else if (!messages.length) {}
        else
        {
          messages.forEach(function(message) {
            socket.emit('message-populate', message);
          });
        }
      });
    }
    else
    {
      Message.find({})
             .sort('date')
             .exec(function(err, messages) {
        if (err) { console.log(err); }
        else if (!messages.length) {}
        else
        {
          messages.forEach(function(message) {
            socket.emit('message-populate', message);
          });
        }
      });
    }
  });

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
    console.log(content);
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
  manager.askClientForNickname(socket);
};

manager.askClientForNickname = function(socket){
  socket.emit('nickname-ask');
};

manager.clientDisconnect = function(socket){
  var nickname = manager._nicknameForSocket(socket);
  if (nickname)
  {
    io.emit('status:disconnect',{
      nickname: nickname
    });
    manager._storeAdd('<i><b>' + nickname + '</b> has left the chatroom.</i>');
  }
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
  io.emit('status:join',{
    nickname: manager._nicknameForSocket(socket)
  });
  manager._storeAdd('<i><b>' + manager._nicknameForSocket(socket) + '</b> has joined the chatroom.</i>');
};

manager.messageSend = function(socket,content){
  var latestDate = manager._storeAdd('<b>' + manager._nicknameForSocket(socket) + ':</b> ' + content);
  console.log('latestDate: ' + latestDate);
  io.emit('message-received', {
    nickname: manager._nicknameForSocket(socket),
    content: content,
    date: latestDate
  });
};

manager.updateTypingStatus = function(socket){
  // Typing status changes when
  // - user starts typing
  // - user stops typing
  // - user disconnects
  // - user idle
};

/* HELPER FUNCTIONS */

manager._storeAdd = function(content){
  message = new Message({
    content: content,
  });
  message.save(function (err, message)
  {
    if (err)
      return console.error(err);
  });
  return message.date;
};

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
