var config = {};

config.couchdb = {};
config.twilio = {};

config.couchdb.url = 'https://username:passsword@couchserver:port/database';
config.couchdb.secondsToInvalidateEvents = 120;
config.couchdb.secondsToFlushVotes = 10;

config.twilio.sid = 'ACxxx';
config.twilio.key = 'yyy';
config.twilio.disableSigCheck = false;

module.exports = config;
