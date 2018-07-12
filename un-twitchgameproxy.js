var TwitchGameProxy = (function() {
  
  var ext = Twitch.ext;
  var act = ext.actions;
  
  function parseJWT(token) {
    var parts = token.split('.');
    var jwt = {};
    jwt.header = JSON.parse(atob(parts[0]));
    jwt.payload = JSON.parse(atob(parts[1]));
    jwt.signature = parts[2];
    
    
    return jwt;
  }
  
  function parseQueryString() {
    var q = {};
    var pairs = window.location.search.substring(1).split('&');
    pairs.forEach(function(pair) {
      var kv = pair.split('=');
      if (kv[1]) {
        q[kv[0]] = kv[1];
      } else {
        q[kv[0]] = true;
      }
    });
    
    return q;
  }
  
  function TwitchGameProxy(opt) {
    
    var _this = this;
    
    //whether the JWT has been received or not.
    var authed = false;
    
    //the raw jwt to easily send as-is to EBS
    var token = null;
    
    //holds client values passed in as query params
    var environment = parseQueryString();
    
    //Recognize testing modes to expose some stuff globally
    var testing = (environment.state == 'testing' || environment.state == 'hosted_test');
    
    this.inTest = function() {
      return testing;
    }
    
    //the parsed jwt components for some initial sanity checks before connecting to EBS
    var jwt = {
      header: null,
      payload: null,
      signature: null
    };
    
    //whether websocket has finished connecting or not.
    var connected = false;
    
    //websocket connection instance
    var conn = null;
    
    //Object container for external event callbacks
    var events = {
      //OnConnect(server_info)
      connect: [],    //fired when successfully connected and authorized to EBS
      
      //OnDisconnect(reason)
      disconnect: [], //whenever the websocket disconnects whether due to failed authorization, network timeout, server shutdown, or other websocket failure
      
      //OnMessage(message_id, data)
      message: [],    //fired whenever a message is received that's been forwarded from the game server (other messages may be handled directly by this object
      
      //OnError(reason, message)
      error: [],      //fired on internal errors such as user id not granted, unrecognized messages, etc
      
      //OnStatus(state, message)
      status: [],     //fired to update on intermediate state changes
    };
    
    function fireConnect(info) {
      events.connect.forEach(function(callback) {
        callback(info);
      });
    }
    
    function fireDisconnect(reason) {
      events.disconnect.forEach(function(callback) {
        callback(reason);
      });
    }
    
    function fireMessage(msg) {
      events.message.forEach(function(callback) {
        callback(msg.id, msg.data);
      });
    }
    
    function fireError(reason, message) {
      events.error.forEach(function(callback) {
        callback(reason, message);
      });
    }
    
    function fireStatus(state, message) {
      events.status.forEach(function(callback) {
        callback(state, message);
      });
    }
    
    function handleJoin(data) {
      //look over channel config and game info
      
      //example channel config: includes customizations available to a broadcaster that has installed the extension to their channel
      /**
      channel: {
        console: {
          colors: {
            background: '#111',
            player: '#37D',
            local: '#ED3',
            server: '#D44',
          },
          
          opacity: 0.8,
          
          position: {
            top: 0.0,
            left: 0.0,
            bottom: 1.0,
            right: 1.0
          },
          
          instance: {
            server_name: 'SpaceMUD',
            group_name: 'MUDnauts',
            
        },
      }
      **/
    }
    
    //private function sends message as-is
    function _send(id, data) {
      conn.send(JSON.stringify({id: id, data: data}));
    }
    
    //Websocket callbacks
    function OnOpen() {
      fireStatus('connected', 'Connected to server. Authorizing with server.');
      //whenever we connect to EBS, send JWT to associate with this connection. If it checks out on the EBS, then the game server is notified to retrieve channel configuration and game info.
      _send('auth', token);
    }
    
    function OnMessage(evt) {
      var msg = JSON.parse(evt.data);
      
      switch (msg.id) {
        case 'gm':
          fireMessage(JSON.parse(msg.data));
          break;
          
        case 'join':
          handleJoin(msg.data);
          break;
      }
    }
    
    function OnClose(evt) {
    }
    
    function OnError(evt) {
    }
    
    /** payload:
    {
      channel_id: numeric ID of channel being viewed
      exp: expiration time in seconds since unix epoch
      opaque_user_id: anonymized ID of user, persistent for individual user unless revoked
      pubsub_perms: listen and send arrays of permitted pubsub topics
      role: 'broadcaster', 'moderator', 'viewer', or 'external'
      user_id: provided for users that grant indentification and extensions configured to be allowed to request it.
    } **/
  
    //Twitch extension helper events
    function OnAuthorization(auth) {
      token = auth.token;
      jwt = parseJWT(token);
      
      if (!jwt.payload.user_id) {
        fireError('user_id', 'This extension requires the user to grant access to their Twitch ID.');
        act.requestIdShare();
        return;
      }
      
      fireStatus('connecting', 'Connecting to server...');
      conn = new WebSocket(opt.url);
      conn.addEventListener('open', OnOpen);
      conn.addEventListener('message', OnMessage);
      conn.addEventListener('close', OnClose);
    }
    
    function OnContext(context, changed) {
    }
    
    function OnError(err) {
    }
    
    function OnVisibilityChanged(visible, context) {
    }
    
    function OnFollow(followed, channel) {
    }
    
    //TwitchGameProxy EBS events
    function OnChannelConfig(config) {
    }
    
    //public send nests the message to forward one more layer deep so the proxy knows to forward it to game
    this.send = function(id, data) {
      _send('gm', {id: id, data: data});
    }
    
    this.addEventListener = function(event_name, callback) {
      var e = events[event_name];
      
      if (!e) {
        throw 'Event "' + event_name + '" not found for addEventListener.';
      }
      
      if (e.includes(callback)) {
        throw 'Event "' + event_name + '" already added with ' + callback;
      }
      
      e.push(callback);
    }
    
    this.removeEventListener = function(event_name, callback) {
      var e = events[event_name];
      
      if (!e) {
        throw 'Unknown event callback for "' + event_name + '" specified for removal.';
      }
      
      var i = e.indexOf(callback);
      if (i < 0) {
        throw 'Event callback not found for "' + event_name;
      }
      
      e.splice(i, 1);
    }
    
    //setup proxy method for requesting twitch ID access
    this.requestIdShare = act.requestIdShare;
    
    //if events are specified, hook them up now
    if (opt.events) {
      Object.keys(opt.events).forEach(function(name) {
        _this.addEventListener(name, opt.events[name]);
      });
    }
    
    fireStatus('init', 'Initialized Twitch game client.');
    
    ext.onAuthorized(OnAuthorization);
    ext.onContext(OnContext);
    ext.onError(OnError);
    ext.onVisibilityChanged(OnVisibilityChanged);
    act.onFollow(OnFollow);
  }
  
  return TwitchGameProxy;
})();