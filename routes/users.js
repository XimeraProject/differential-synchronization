var express = require('express');
var router = express.Router();

/* GET users listing. */
/* GET users listing. */
router.get('/', function(req, res, next) {
    // Some fake data
  res.json([{
  	id: 1,
  	username: "fake-one"
  }, {
  	id: 2,
  	username: "fake-two"
  }]);
});

module.exports = router;
