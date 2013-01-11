var utils = require('../utils')
  , config = require('../config')
  , twilio = require('twilio')
  , events = require('../events')
  , io;

module.exports = function(app, socketio) {
  io = socketio;
  app.get('/', index);
  app.get('/events/:shortname', getEvent);
  app.post('/vote/sms', voteSMS);
};


/*
 * GET home page.
 */

var index = function(req, res){
  res.render('index', { title: 'Express' });
};

/*
 * GET an event.
 */

var getEvent = function(req, res){
  events.findBy('all', {key: ['event:'+req.params.shortname], reduce:false}, function(err, event) {
    if (event) {
      events.voteCounts(event, function (err) {
        if (err) {

        }
        else {


          res.render('event', {
            name: event.name, shortname: event.shortname, state: event.state,
            phonenumber: utils.formatPhone(event.phonenumber), voteoptions: JSON.stringify(event.voteoptions)   
          });
        }
      });
    }
    else {
      res.statusCode = 404;
      res.send('We could not locate your event');
    }
  });
};

/*
 * POST new vote via SMS
 */

var voteSMS = function(request, response) {

    if (twilio.validateExpressRequest(request, config.twilio.key) || config.twilio.disableSigCheck) {
        response.header('Content-Type', 'text/xml');
        var body = request.param('Body').trim();
        
        // the number the vote it being sent to (this should match an Event)
        var to = request.param('To');
        
        // the voter, use this to keep people from voting more than once
        var from = request.param('From');

        events.findByPhonenumber(to, function(err, event) {
            if (err) {
                console.log(err);
                // silently fail for the user
                response.send('<Response></Response>'); 
            }
            else if (event.state == "off") {
                response.send('<Response><Sms>Voting is now closed.</Sms></Response>');                 
            }
            else if (!utils.testint(body)) {
                console.log('Bad vote: ' + event.name + ', ' + from + ', ' + body);
                response.send('<Response><Sms>Sorry, invalid vote. Please text a number between 1 and '+ event.voteoptions.length +'</Sms></Response>'); 
            } 
            else if (utils.testint(body) && (parseInt(body) <= 0 || parseInt(body) > event.voteoptions.length)) {
                console.log('Bad vote: ' + event.name + ', ' + from + ', ' + body + ', ' + ('[1-'+event.voteoptions.length+']'));
                response.send('<Response><Sms>Sorry, invalid vote. Please text a number between 1 and '+ event.voteoptions.length +'</Sms></Response>'); 
            } 
            else { 
                var vote = parseInt(body);
                events.saveVote(event, vote, from);
                console.log('Accepting vote: ' + event.name + ', ' + from);
                io.sockets.in(event.shortname).emit('vote', vote);
                response.send('<Response><Sms>Thanks for your vote for ' + event.voteoptions[vote-1].name + '. Powered by Twilio.</Sms></Response>');      
            } 
        }); 
    }
    else {
        response.statusCode = 403;
        response.render('forbidden');
    }
};

