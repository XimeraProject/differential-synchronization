import CANON from 'canon';
import XXH from 'xxhashjs';
import _ from 'underscore';

// I find it annoying how hard it is to load some things under ES6
import {diff, patch, clone} from 'jsondiffpatch/dist/jsondiffpatch.esm.js';
const jsondiffpatch = {
  diff: diff,
  patch: patch,
  clone: clone,
};

function checksumObject(object) {
    return XXH.h32( CANON.stringify( object ), 0x1337 ).toString(16);
}

var DATABASE = undefined;
var SHADOW = undefined;

var Synchronizer = { callback: undefined };

////////////////////////////////////////////////////////////////
// connect to server
var socket = new WebSocket('ws://localhost:3001/');

const handlers = {
  'sync': function(message) {
    SHADOW = jsondiffpatch.clone(message.state);

    if (DATABASE === undefined) {
      DATABASE = jsondiffpatch.clone(SHADOW);
      
      // When the database is changed, we want to wait a bit and then sync
      // with the remote
      var databaseChangeHandler = {
	set: function(target, property, value, receiver) {
	  differentialSynchronizationDebounced();
	  target[property] = value;
	  return true;
	},
	// For a "deep" proxy, we want to also recursively proxy all
	// returned objects
	get: function(target, property, receiver) {
	  if (typeof target[property] === typeof {})
	    return new Proxy( target[property], databaseChangeHandler );
	  else
	    return target[property];
	}
      };
      Synchronizer.database = new Proxy( DATABASE, databaseChangeHandler );
      window.DATABASE = new Proxy( DATABASE, databaseChangeHandler );
    }
  },
  
  'want-sync': function() {
    var message = { type: "sync",
		    state: SHADOW };
    socket.send( JSON.stringify( message ) );
  },
  
  'patched': function() {
    status('patched');
  },
  
  'patch': function(message) {
    // Apply patch to the client state...
    jsondiffpatch.patch( DATABASE, message.delta);
    
    //synchronizePageWithDatabase();
    console.log("calling callback");
    if (Synchronizer.callback)
      Synchronizer.callback();
    
    // Confirm that our shadow now matches their shadow
    if (checksumObject(SHADOW) !== message.checksum) {
      // We are out of sync, and should request synchronization
      socket.send( JSON.stringify( { type: "want-sync" } ) );
    } else {
      jsondiffpatch.patch(SHADOW, message.delta);
    }
  },
  
  'have-patch': _.debounce( function() {
    socket.send( JSON.stringify( { type: 'want-patch' } ) );  
  }, 100 )
};

socket.onmessage = function(event) {
  var message = JSON.parse(event.data);
  if (handlers[message.type])
    (handlers[message.type])(message);
};

function status(type, message) {
  console.log( "sync status: ", type, message );
}

function differentialSynchronization() {
  if (socket.readyState !== 1) {
    status( "error", "Synchronization failed" );
    window.setTimeout(differentialSynchronizationDebounced, 3001);
    return;
  }

  var delta = jsondiffpatch.diff( SHADOW, DATABASE );
    
  if (delta !== undefined) {
    status( 'saving' );
    socket.send( JSON.stringify(
      { type: 'patch', delta: delta, checksum: checksumObject(SHADOW), from: 'me!' } ) );
    SHADOW = jsondiffpatch.clone(DATABASE);
  }
}

var differentialSynchronizationDebounced = _.debounce( differentialSynchronization, 3001 );

export default Synchronizer;
