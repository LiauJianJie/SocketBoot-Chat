var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var nicknames = [];

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){

  socket.on('nickname-request', function(nickname){
    console.log('nickname-request received: ' + nickname);
    if (!arrayContains(nicknames, nickname))
    {
      io.emit('nickname-request', {
        nickname: nickname,
        nicknameAllowed: true
      });
      nicknames.push(nickname);
      console.log('nickname-request accepted: ' + nickname);
    }
    else
    {
      io.emit('nickname-request', {
        nickname: nickname,
        nicknameAllowed: false
      });
      console.log('nickname-request denied: ' + nickname);
    }
  });

  socket.on('user-joined', function(nickname){
  console.log('user-joined: ' + nickname);
    io.emit('user-joined', nickname);
  });

  socket.on('send-message', function(message){
  console.log('send-message ' + message.nickname + ': ' + message.text);
    io.emit('send-message', message);
  });

});

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:' + (process.env.PORT || 3000));
});

function arrayContains(a, obj) {
    var i = a.length;
    while (i--) {
       if (a[i] === obj) {
           return true;
       }
    }
    return false;
}
