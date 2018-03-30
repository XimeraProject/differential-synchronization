var express = require('express');
var router = express.Router();

var CANON = require('canon');
var XXHash = require('xxhash');
function checksumObject(object) {
  console.log("canonicalizing:",object);
    return XXHash.hash( Buffer.from(CANON.stringify( object )), 0x1337 ).toString(16);
}

var sockets = new Set();

var jsondiffpatch = require('jsondiffpatch');

// In production, you'd want different state's for different groups of
// users, for different pages, etc.  For now, we just have a single
// STATE for everything
var STATE = {};

STATE['hello'] = 'WHEEEEE';

// Syncing only updates the shadow
function sync( ws, session, event ) {
  session.shadow = event.state;
}

function wantSync( ws, session, event ) {
  ws.emit( 'sync', { state: session.shadow } );
}

function wantPatch( ws, session, event ) {
  var delta = jsondiffpatch.diff(session.shadow, STATE);
  console.log( "delta=",delta);
  if (delta !== undefined) {
    var message = { delta: delta,
		    checksum: checksumObject( session.shadow ) };
    ws.emit( 'patch', message );
    session.shadow = jsondiffpatch.clone(STATE);
  }
}

function patch( ws, session, event ) {
  // Apply the patch to the shadow
  if (checksumObject(session.shadow) != event.checksum) {
    ws.emit( "want-sync", {} );
    return;
  }

  // This should never fail because we passed a checksum test
  try {
    jsondiffpatch.patch(session.shadow, event.delta);
  } catch (e) {
    console.log('could not patch a shadow that passed a checksum test');
    console.log(e);
  }
  
  // fuzzypatch the state, which can fail for any number of reasons
  try {
    jsondiffpatch.patch(STATE, event.delta);
  } catch (e) {
  }

  ws.emit( "patched", {} );

  // For now, tell EVERYONE ELSE connected about what is happening
  sockets.forEach( function(socket) {
    if (socket.readyState == 1)
      if (socket !== ws.socket)
	socket.send( JSON.stringify( { type: 'have-patch' } ) );
  });
}

module.exports = function(options) {
  var ws = options.ws;
  var sessionParser = options.sessionParser;
  
  ws.on("connection", function connection(ws, req) {
    sessionParser(req, {}, function(){
      console.log("New websocket connection:");
      var session = req.session;
      session = {};
      
      // Maintain the list of all open sockets
      sockets.add(ws);
      ws.on('close', function close() {
	sockets.delete(ws);
      });

      // BADBAD: Also will want to clean up disconnected sockets from
      // the socket list

      // Initialize the shadow
      session.shadow = jsondiffpatch.clone(STATE);
      ws.send( JSON.stringify( {type: 'sync', state: STATE } ) );
      
      ws.on('message', function incoming(message) {
	message = JSON.parse(message);

	console.log('received: %s', JSON.stringify(message));
	console.log( 'there are ', sockets.size, 'people' );
	
	var fakeSocket = { socket: ws,
			   emit: function( type, payload ) {
			     payload.type = type;

			     // Fail silently if we try to send to an unready socket
			     if (ws.readyState == 1) {
			       ws.send( JSON.stringify( payload ) );
			     }
			   }};
	
	if (message.type === 'sync')
	  sync(fakeSocket, session, message);
	
	if (message.type === 'want-sync')
	  wantSync(fakeSocket, session, message);

	if (message.type === 'want-patch')
	  wantPatch(fakeSocket, session, message);
	
	if (message.type === 'patch')
	  patch(fakeSocket, session, message);
      });
    });
  });
};
