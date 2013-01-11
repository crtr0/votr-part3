var config = require('./config')
  , utils = require('./utils')
  , _und = require('underscore')
  , db = require('nano')(config.couchdb.url)
  , client = require('twilio')(config.twilio.sid, config.twilio.key)
  
  // Local caches for event and voting information (will be periodically flushed)    
  , eventsCache = {}
  , secondsToInvalidateEvents = config.couchdb.secondsToInvalidateEvents

  , votesCache = {}
  , secondsToFlushVotes = config.couchdb.secondsToFlushVotes

  // Look up the phone number, get the document's ID, then lookup the full document (including votes)
  , findByPhonenumber = exports.findByPhonenumber = function(phonenumber, callback) {

      findBy('byPhonenumber', {key: phonenumber}, function(err, event) {
          if (err) {
            callback(err, null);
          }
          else {
              findBy('all', {key: [event._id], reduce: false}, callback);
          }
      });
  }

  , findBy = exports.findBy = function(view, params, callback) {

      var event;

      if (event = eventsCache[view+JSON.stringify(params)]) {
        callback(null, event);
      }
      else {
        
        db.view('event', view, params, function(err, body) {
          if (err) {
            console.log(err);
            callback(err, null);
          }
          else {
            if (body.rows.length == 0) {
              var msg = 'No match for: ' + view + ', ' + params;
              console.log(msg);
              callback(msg, null);              
            }
            else {
              event = body.rows[0].value;
              eventsCache[view+JSON.stringify(params)] = event;
              callback(null, event);
            }
          }
        });
      }
  }

  , voteCounts = exports.voteCounts = function(event, callback) {
      db.view('event', 'all', {startkey: [event._id], endkey: [event._id, {}, {}], group_level: 2}, function(err, body) {
        if (err) {
          callback(err);
        }
        else {
          // populate count for voteoptions
          event.voteoptions.forEach(function(vo, i){ 
            var found = _und.find(body.rows, function(x) {return x.key[1] == vo.id});
            vo['votes'] = (found? found.value : 0);
          });
          callback();
        }
      });
  }

  ,	saveVote = exports.saveVote = function(event, vote, from) {

      // The _id of our vote document will be a composite of our event_id and the
      // person's phone number. This will guarantee one vote per event 
      var voteDoc = {  
        _id: 'vote:' + event._id + ':' + from,
        type: 'vote',
        event_id: event._id,
        event_phonenumber: event.phonenumber,
        vote: vote,
        phonenumber: from
      };

      votesCache[voteDoc._id] = voteDoc;
  	}

  , flushVotes = function() {
      
      var votesToSave = _und.values(votesCache);
      votesCache = {};

      if (votesToSave.length > 0) {
        db.bulk({docs: votesToSave}, function(err, body) {
          if (err) {
            console.log("Failed to save votes, popping them back on the cache");
            votesToSave.forEach(function(v) {
              votesCache[v._id] = v;
            });
          }
          else {
            // loop through the response to detect votes that were rejected as duplicates
            for (var i in votesToSave) {
              if (body[i].error) {
                // send the person an SMS to alert them that you can only vote once
                console.log('Notifying of duplicate vote: ', votesToSave[i])
                client.sendSms({To: votesToSave[i].phonenumber, From: votesToSave[i].event_phonenumber, Body: 'Sorry, you are only allowed to vote once.'});
              }
            }
          }
        });
      }
  }

  , invalidateEvents = function() {
      eventsCache = {};
  }

  , invalidateEventsJob = setInterval(invalidateEvents, 1000*secondsToInvalidateEvents)
  , flushVotesJob = setInterval(flushVotes, 1000*secondsToFlushVotes);
