var express = require('express');
var router = express.Router();

var CANON = require('canon');
var XXHash = require('xxhash');
function checksumObject(object) {
    return XXHash.hash( Buffer.from(CANON.stringify( object )), 0x1337 ).toString(16);
}

var jsondiffpatch = require('jsondiffpatch');

module.exports = function(options) {
  var ws = options.ws;
  var sessionParser = options.sessionParser;
  
  ws.on("connection", function connection(ws, req) {
    sessionParser(req, {}, function(){
      console.log("New websocket connection:");
      var sess = req.session;
      console.log("working = " + sses.working);
    });
  });
};
