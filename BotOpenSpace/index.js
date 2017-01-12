'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const recastai = require('recastai')
const app = express()

const token = process.env.FB_TOKEN
const verify_token = process.env.VERIFY_TOKEN
const bot_token = process.env.BOT_TOKEN

var HashTable = require('hashtable');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var schedule = require('node-schedule');

var hashtable = new HashTable();


var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [new schedule.Range(1, 5)];
rule.hour = 11;
rule.minute = 45;

var j = schedule.scheduleJob(rule, function(){
  var reques = 'https://rietourcristal.votreextranet.fr/iframeRestauration.cfm?zr=29';
  request(reques, function (error, response, body) {
    //console.log(response.body);
    var index = 0;
    var str = response.body;
    var rep = 'Le Menu du midi :\nLes entrees:'
    while (str.search('<li>') < str.search('</ul>')){
      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))
      //console.log(str.substring(0,str.search('</span>')));
    }

    rep += '\nLes plats:';
    do{
      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))

    rep += '\nLes garnitures:';
    do{

      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))

    rep += '\nLes desserts:';
    do{

      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))
    console.log(rep);
    var reques = 'https://slack.com/api/chat.postMessage?token=xoxp-5188345088-81170677831-95185056723-e80de9c8bb94e0ddea8d0c1e55ddfbe2&&channel=C055JA58W&text='+rep
    request(reques, function (error, response, body) {
      console.log(error);
      console.log(response.body);
    })

  });

});

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = __dirname;
var TOKEN_PATH = TOKEN_DIR+'/' + 'calendar-nodejs-quickstart.json';
var oauth2Client ;

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  authorize(JSON.parse(content));
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client);
    } else {
      oauth2Client.credentials = JSON.parse(token);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}



function insert(sender, name, date, dateEnd){
  var event = {
    'summary': name,
    'start': {
      'dateTime': date ,
      'timeZone': 'Europe/Paris',
    },
    'end': {
      'dateTime': dateEnd ,
      'timeZone': 'Europe/Paris',
    }
  };
  var calendar = google.calendar('v3');
  calendar.events.insert({
    auth: oauth2Client,
    calendarId: 'ed8c5b0idspn3ps661fvh2tv74@group.calendar.google.com',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
    sendTextMessage(sender, 'Vous avez bien reservé la salle de creativité pour le ' + date);
  });
}





function insertDate(sender, date, date2){
  var reques = 'https://graph.facebook.com/v2.6/'+ sender + '?fields=first_name,last_name&access_token=' + token;
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      console.log(body);
      var name = getName(tmp);
      var dateS = date.toISOString()//'' + date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate() + 'T' + date.getHours() + date.getMinutes();
      var dateEnd = date2.toISOString()//'' + date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate() + 'T' + date2.getHours() +  date2.getMinutes();
      insert(sender, name, dateS, dateEnd);
    }
  })
}
/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function checkDate(auth,sender,date, date2) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: 'ed8c5b0idspn3ps661fvh2tv74@group.calendar.google.com',
    timeMin: (new Date()).toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
      insertDate(sender, date, date2)
    } else {
      var b = false;
      var name = "tmp"

      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        var end = event.end.dateTime || event.end.date;
        var dstart = new Date(start.substring(0,4),start.substring(5,7) - 1,start.substring(8,10) ,start.substring(11,13) - 1,start.substring(14,16));
        var dend = new Date(end.substring(0,4),end.substring(5,7) - 1,end.substring(8,10),end.substring(11,13) - 1, end.substring(14,16));
        if (!b){
          if (i === 0 && date2 < dstart){
            console.log("1");
            insertDate(sender, date, date2)
            b = true
          }
          else{
            if (name !== 'tmp'){
              name = event.summary + ' de ' + dstart.getHours() + 'h' + dstart.getMinutes() + ' à ' + + dend.getHours() + 'h' + dend.getMinutes()
            }
          }
          if (i === (events.length - 1) ){
            console.log("2");
            if (dend < date){
              insertDate(sender, date, date2)
              b = true
            }
            else {
              if (name !== 'tmp'){
                name = event.summary + ' de ' + dstart.getHours() + 'h' + dstart.getMinutes() + ' à ' + + dend.getHours() + 'h' + dend.getMinutes()
              }
            }
          }
          else{
            console.log("3");
            var event = events[i + 1];
            var start = event.start.dateTime || event.start.date;
            var end = event.end.dateTime || event.end.date;
            var dstart2 = new Date(start.substring(0,4),start.substring(5,7) - 1,start.substring(8,10) ,start.substring(11,13) - 1,start.substring(14,16));
            var dend2 = new Date(end.substring(0,4),end.substring(5,7) - 1,end.substring(8,10),end.substring(11,13) - 1, end.substring(14,16));
            if ( dend < date && date2 < dstart2){
              insertDate(sender, date, date2)
              b = true
            }
            else {
              if (name !== 'tmp'){
                name = event.summary + ' de ' + dstart.getHours() + 'h' + dstart.getMinutes() + ' à ' + + dend.getHours() + 'h' + dend.getMinutes()
              }
            }
          }
        }
      }
      if (!b)
        sendTextMessage(sender, 'La salle est indisponible, elle est reserver par '+name)
    }
  })
}





app.set('port', (process.env.PORT || 5000))

// Process application/xwww-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
//  insert();
    listEvents(oauth2Client);

    res.send('Hello world, I am a chat bot')
});

// for Facebook verification
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === verify_token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

app.post('/test/', function (req, res) {
  console.log("test");
  var reques = 'https://rietourcristal.votreextranet.fr/iframeRestauration.cfm?zr=29';
  request(reques, function (error, response, body) {
    //console.log(response.body);
    var index = 0;
    var str = response.body;
    var rep = 'Le Menu du midi :\nLes entrees:'
    while (str.search('<li>') < str.search('</ul>')){
      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))
      //console.log(str.substring(0,str.search('</span>')));
    }

    rep += '\nLes plats:';
    do{
      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))

    rep += '\nLes garnitures:';
    do{

      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))

    rep += '\nLes desserts:';
    do{

      str = str.substring(str.search('<span>') + 6);
      rep += ('\n-' +  str.substring(0,str.search('</span>')))

  //    console.log(str.substring(0,str.search('</span>')));
    }while (str.search('<li>') < str.search('</ul>'))
    console.log(rep);
    var reques = 'https://slack.com/api/chat.postMessage?token=xoxp-5188345088-81170677831-95185056723-e80de9c8bb94e0ddea8d0c1e55ddfbe2&&channel=C055JA58W&text='+rep
    request(reques, function (error, response, body) {
      console.log(error);
      console.log(response.body);
    })

  });
  res.sendStatus(200)
})

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        console.log(event);
        if (event.message && event.message.text) {
            let text = event.message.text
            console.log(text);
            parseMessage(sender,text.substring(0, 200))
        }
      }
    res.sendStatus(200)
})

function parseMessage(sender, text){
  var recastai = require('recastai')
  if (text.endsWith('h')){
    text = text.concat('00');
  }
  var client = new recastai.Client('4ae3e9426700577fb2bc44efaffb8cb3', 'fr')
  client.textRequest(text)
  .then(function(res)  {

    var intent = res.intent();
    if (!intent){
      sendTextMessage(sender, 'Je ne peux pas encore vous répondre mais j\'apprends de jour en jour');

    }

    if (!intent.slug){
      console.log("none");
      sendTextMessage(sender, 'Je ne peux pas encore vous répondre mais j\'apprends de jour en jour');
    }
    if (intent.slug && intent.slug === 'retard'){
      console.log("ret");

      sendlate(sender, res);
    }
    else if (intent.slug && intent.slug === 'absence'){
      console.log("abs");

      sendAbs(sender, res);
    }
    else if (intent.slug && intent.slug === 'resa'){
      console.log("resa");

      resRoom(sender, res);
    }
    else if (intent.slug && intent.slug === 'telephone'){
      console.log("tel");

      sendTel(sender, res);
    }
    else if (intent.slug && intent.slug === 'bonjour'){
      console.log("bjr");

      sendTextMessage(sender, 'Hello je suis Momo le bot de la team IO!\nRetard, absence, besoin d\'un 06, reservation de salle créa? Conctact moi, je m\'occupe de tout ca ;)')
    }
    else{
      console.log("none2");

      sendTextMessage(sender, 'Je ne peux pas encore vous répondre mais j\'apprends de jour en jour');
    }
  }).catch(function(err)  {
    // Handle error
  })
}


function sendTel(sender, res){
  var pers = res.get('person');
  if (pers){
    var obj = JSON.parse(fs.readFileSync('tel.json', 'utf8'));
    for(let i = 1; i < obj.person.length;i++){
      if (obj.person[i].name === pers.raw){
        sendNum(sender, 'Le numero de telephone de ' + obj.person[i].name + ' est :',  obj.person[i].tel);
        return;
      }
    }
    sendTextMessage(sender, 'Le numero de telephone de ' + pers.raw + ' n\'est pas dans notre base de donnée');
    return;
  }
  sendTextMessage(sender, 'Vous n\'avez pas specifié de personne, n\'oubliez pas les majuscules aux prenoms');
}

function resRoom(sender, res){
  var date = res.get('datetime');
  if (date){
    var str = '{"state":"1"'
    var jso = hashtable.get(sender);
    if(jso && jso.day && jso.hour){
      var dates = new Date(jso.year,jso.month ,jso.day,jso.hour,jso.min);
      var dates2 = new Date(jso.year,jso.month,jso.day,date.iso.substring(11,13) ,date.iso.substring(14,16));
      checkDate(oauth2Client, sender, dates, dates2);
      hashtable.remove(sender)
    }
    else{
      if(date.accuracy.includes("day")){
        str = str + ',"month":"' + (date.iso.substring(5,7) - 1) +  '","day":"' + date.iso.substring(8,10) +'","year":"' +  date.iso.substring(0,4)+ '"';
      }
      else if (jso && jso.day){
          str = str + ',"month":"' + jso.month +  '","day":"' + jso.day +'","year":"' +  jso.year+ '"';
      }
      if (date.accuracy.includes("hour"))
      {
        str = str  + ',"hour":"' + date.iso.substring(11,13) + '","min":"' + date.iso.substring(14,16) + '"';
      }
      else if (jso && jso.hour){
        str = str  + ',"hour":"' + jso.hour + '","min":"' + jso.min + '"';
      }
      str = str + '}'
      jso = JSON.parse(str);
      if(jso && jso.day && jso.hour){
        hashtable.remove(sender)
        hashtable.put(sender, jso)
        var dates = new Date(jso.year,jso.month ,jso.day,jso.hour,jso.min);
        sendTextMessage(sender, 'Vous avez choisi de reserver le \nMerci de preciser l\'heure de fin de la reservation')
      }
      else {
        hashtable.put(sender, jso)
        if (jso && jso.day){
          sendTextMessage(sender, 'Merci de preciser l\'heure de la reservation')
        }
        else if (jso && jso.hour){
          sendTextMessage(sender, 'Merci de preciser le jour de la reservation')
        }
        else{
          sendTextMessage(sender, 'Erreur')
        }
      }
    }
  }
  else{
    sendTextMessage(sender, 'Vous n\'avez pas precisé de date')
  }
}


function getName(tmp){
  switch (tmp.first_name) {
    case 'Jules':
      return 'Julie'
    case 'Vin':
      return 'Vincent'
    case 'Marie':
      return tmp.first_name + ' '+ tmp.last_name;
    case 'Lisa':
      return tmp.first_name + ' '+ tmp.last_name;
    default:
      return tmp.first_name;

  }
}

function sendAbs(sender, res){
  var reques = 'https://graph.facebook.com/v2.6/'+ sender + '?fields=first_name,last_name&access_token=' + token;
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      var name = getName(tmp);

      var date = res.get('datetime');

      if (date){
        var time = date.formatted.substring(0, date.formatted.indexOf('à'));
        var text = 'Bonjour je vous informe que '+ name + ' sera absent le ' + time;
      }
      else{
        var text = 'Bonjour je vous informe que '+ name + ' sera absent aujourd\'hui'
      }
    //  #general
      var reques = 'https://slack.com/api/chat.postMessage?token=xoxp-5188345088-81170677831-95185056723-e80de9c8bb94e0ddea8d0c1e55ddfbe2&channel=%40'+ 'quentingras'+'&username=team%20io%20retard&text='+text
      request(reques, function (error, response, body) {
        if (error){
          console.log(error);
        }
        else{
          if(date){
            sendTextMessage(sender, 'Marie, Inez et Cecile on bien été informée que vous serez absent le ' + time);
          }
          else{
            sendTextMessage(sender, 'Marie, Inez et Cecile on bien été informée de votre absence aujourd\'hui');
          }
        }
      });


    }
  })
}

function sendlate(sender,res){
  var reques = 'https://graph.facebook.com/v2.6/'+ sender + '?fields=first_name,last_name&access_token=' + token;
  console.log(reques);
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      console.log(body);
      var name = getName(tmp);

      var date = res.get('datetime');
      if (date){
        var text = 'Bonjour je vous informe que '+ name + ' sera en retard de ' + date.raw;
      }
      else{
        var text = 'Bonjour je vous informe que '+ name + ' sera en retard aujourd\'hui'
      }
      var reques = 'https://slack.com/api/chat.postMessage?token=xoxp-5188345088-81170677831-95185056723-e80de9c8bb94e0ddea8d0c1e55ddfbe2&channel=%40'+ 'quentingras'+'&username=team%20io%20retard&text='+text
      request(reques, function (error, response, body) {
        if (error){
          console.log(error);
        }
        else{
          if(date){
            sendTextMessage(sender, 'Marie, Inez et Cecile on bien été informée que vous serez en retard de ' + date.raw);
          }
          else{
            sendTextMessage(sender, 'Marie, Inez et Cecile on bien été informée de votre retard aujourd\'hui');
          }
        }
      });


    }
  })
}

function sendTextMessage(sender, text) {
  console.log(text);
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log(sender);
            console.log('Error: ', response.body.error)
        }
    })
}

function sendNum(sender, text, num) {
  console.log(text);
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
      sendTextMessage(sender, num);
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log(sender);
            console.log('Error: ', response.body.error)
        }
    })
}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})
