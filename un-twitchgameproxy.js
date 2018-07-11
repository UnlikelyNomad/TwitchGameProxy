var TwitchGameProxy = (function() {
  
  var ext = Twitch.ext;
  var act = ext.actions;
  
  function parseJWT(token) {
    var parts = token.split('.');
    return {
      header: JSON.parse(atob(parts[0])),
      payload: JSON.parse(atob(parts[1])),
      signature: JSON.parse(atob(parts[2]))
    };
  }
  
  function TwitchGameProxy(opt) {
    
    var _this = this;
    
    //whether the JWT has been received or not.
    var authed = false;
    
    //the raw jwt to easily send as-is to EBS
    var token = null;
    
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
      
    };
    
    function fireMessage(msg) {
      events.message.forEach(function(callback) {
        callback(msg.id, msg.data);
      });
    }
    
    //Websocket callbacks
    function OnOpen() {
    }
    
    function OnMessage(evt) {
      var msg = JSON.parse(evt.data);
      
      switch (msg.id) {
        case 'gm':
          fireMessage(JSON.parse(msg.data));
          break;
          
        case 'chan_cfg':
          handleChannelConfig(msg.data);
          break;
          
        case 'server_info':
          handleServerInfo(msg.data);
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
      
      conn = new WebSocket(opt.url);
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
    
    this.send = function(message_id, data) {
    }
    
    this.addEventListener = function(event_name, callback) {
    }
    
    this.removeEventListener = function(event_name, callback) {
    }
  }
  
  return TwitchGameProxy;
})();