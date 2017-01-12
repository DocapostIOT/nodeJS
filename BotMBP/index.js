'use strict'
//lksdfks
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const token = process.env.FB_TOKEN
const verify_token = process.env.VERIFY_TOKEN
const bot_token = process.env.TOKEN_BOT
var identifier = '';

var HashTable = require('hashtable');
var hashtable = new HashTable();
var lookingFor = new HashTable();
var baltable = new HashTable();
var locTable = new HashTable();

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

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




//point d'entré
app.post('/webhook/', function (req, res) {

    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        console.log(event);
        if (event.message && event.message.text) {
            let text = event.message.text
            parseMessage(sender,text.substring(0, 200))
        }
        //elt joint au message
        else if (event.message && event.message.attachments && event.message.attachments[0].payload && event.message.attachments[0].payload.coordinates) {
          console.log(event.message.attachments[0].payload);
          var lat = event.message.attachments[0].payload.coordinates.lat
          var lng = event.message.attachments[0].payload.coordinates.long
          locTable.put(sender, lat + ',' + lng);
          if (lookingFor.has(sender)) {
            loopFindLetter(sender, 1000, lat, lng);
          }
          else {
            loopFindAdresse(sender, 1000, lat, lng);

          }
        }
        else if (event.message &&event.message.quick_reply && event.message.quick_reply.payload && event.message.quick_reply.payload === 'LAST_LOC' ){

        }
        //callback button
        else if (event.postback && event.postback.payload){
          if (event.postback.payload === 'CLOSE_DESK'){
            askForLocation(sender);
          }
          else if (event.postback.payload === 'CLOSE_BAL'){
            lookingFor.put(sender, true);
            askForLocation(sender);
          }
          else if (event.postback.payload === 'SEND_ITINERAIRE'){
            sendItineraire(sender);
          }
        }
    }
    res.sendStatus(200)
})


//parsing du message avec recast
function parseMessage(sender, text){
  var recastai = require('recastai')

  var client = new recastai.Client(bot_token, 'fr')
  client.textRequest(text, function(res, err) {
    if (err) {
      console.log('error');
    } else {

      if(res.intent() === 'adresse'){
        locTable.put(sender,res.source);
        if (lookingFor.has(sender)){
          sendLetterBox(sender, res.source);
        }
        else {
          getClosestDesk(sender, res.source);
        }
      }
      if (res.sentence().source === 'Dernière position'){
        if (!locTable.has(sender))
        {
          sendTextMessage(sender, 'Aucun position n\'est enregistrée');
          return;
        }
        if (lookingFor.has(sender)){
          console.log('lettre POS')
          sendLetterLast(sender, locTable.get(sender));
        }
        else{
          console.log('BP POS')
          sendBPLast(sender, locTable.get(sender));
        }
      }
      lookingFor.remove(sender);
      if (res.intent() === 'location')
      {
        sendLocation(sender, res);
      }
      else if(res.intent() === 'horaire'){
        sendHoraire(sender);
      }
      else if(res.intent() === 'service'){
        getService(sender);
      }
      else if(res.intent() === 'proximite'){
        askForLocation(sender);
      }
      else if(res.intent() === 'itineraire'){
        sendItineraire(sender);
      }
      else if(res.intent() === 'horaire_fermeture'){
        sendHoraire_ferm(sender)
      }
      else if(res.intent() === 'colis'){
        sendBPLocation(sender,res)
      }
      else if(res.intent() === 'lettre'){
        lookingFor.put(sender, true);
        askForLocation(sender);
      }
      else if(res.intent() === 'bonjour'){
        sendGretting(sender, 'Bonjour je suis votre assistant pour simplifier votre expérience postale\nVous cherchez :');
      }
      else if(res.intent() === 'comprise'){
        sendTextMessage(sender, 'Bonjour,\nSi notre reponse ne correspond pas à l\'objet de votre requête merci de reformuler ou de reporter le proleme à quentin.gras@docapost.fr');
      }
      else if(res.intent() === 'merci'){
        sendTextMessage(sender, 'De rien :D n\'hésitez pas à me poser des questions je ferais tout pour simplifier votre relation avec La Poste');
      }
      else if(res.intent() === 'demain') {
        sendHoraireDemain(sender);
      }
      else if (res.intent() !== 'adresse' && res.sentence().source !== 'Dernière position'){
        sendTextMessage(sender, 'Je ne peux pas encore vous répondre mais j\'apprends de jour en jour');
      }
    }
  })

}


//envoie de la boite aux lettre la plus proche de la derniere position
function sendLetterLast(sender, last){
  console.log(last);
  if(last.includes(',')){
    loopFindLetter(sender, 1000,last,0);
  }
  else{
    sendLetterBox(sender,last);
  }
}


//envoie du bureau de poste le plus proche de la derniere position
function sendBPLast(sender, last){
  console.log(last);
  if(last.includes(',')){
    loopFindAdresse(sender,1000, last,0);
  }
  else{
    getClosestDesk(sender,last);
  }
}


//envoie de la boite aux lettre la plus proche de l'adresse
function sendLetterBox(sender, adresse){
  var reques = 'https://maps.googleapis.com/maps/api/geocode/json?address='+ adresse +'&key=INSERT_KEY';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      console.log(body);
      //comment
      loopFindLetter(sender, 1000, tmp.results[0].geometry.location.lat, tmp.results[0].geometry.location.lng);
    }
  });
}


//recherche du bureau de poste
function loopFindLetter(sender, radius, lat, lng){
  var reques;
  if(lng === 0)
    reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_boiteruehdl&apikey=INSERT_KEY&geofilter.distance=' +lat + ','+radius+'&rows=1000';
  else
    reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_boiteruehdl&apikey=INSERT_KEY&geofilter.distance=' +lat + ',' + lng + ','+radius+'&rows=1000';
  console.log(reques);
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp2 = JSON.parse(body);
      console.log(body);
      if (tmp2.nhits === '0'){
        radius = radius * 2;
        if (radius > 20000){
          sendTextMessage(sender, "Il n'y a pas de boite aux lettre à proximité");
        }
        loopFindLetter(sender, radius, tmp);
      }
      else {
        if (lng === 0)
          reques = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + lat + '&destinations=' +  tmp2.records[0].fields.latitude + ',' + tmp2.records[0].fields.longitude;
        else
          reques = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + lat + ',' + lng + '&destinations=' +  tmp2.records[0].fields.latitude + ',' + tmp2.records[0].fields.longitude;
        for(let i = 1; i < tmp2.records.length;i++){
          reques = reques + '|' + tmp2.records[i].fields.latlong[0] + ',' + tmp2.records[i].fields.latlong[1];
        }
        reques = reques + '&language=fr-FR&key=INSERT_KEY';
        request(reques, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            console.log(body);
            var tmp3 = JSON.parse(body);
            var min = 0;
            var minIndex = 0;
            //comment
            for(let i = 0; i < tmp3.rows[0].elements.length;i++){
              if (tmp3.rows[0].elements[i].duration && tmp3.rows[0].elements[i].duration.value) {
                if (min === 0 || min > tmp3.rows[0].elements[i].duration.value) {
                  min = tmp3.rows[0].elements[i].duration.value;
                  minIndex = i;
                }
              }
            }
            var text = 'La boite aux lettre la plus proche est au ' + tmp2.records[minIndex].fields.va_no_voie + ' ' +tmp2.records[minIndex].fields.lb_voie_ext + ' à ' + tmp2.records[minIndex].fields.lb_com +'\nL\'heure limite du dépot est '+ tmp2.records[minIndex].fields.hdl_semaine + ' aujourd\'hui' ;
            baltable.remove(sender)
            baltable.put(sender, tmp2.records[minIndex].fields.latlong[0] + ',' + tmp2.records[minIndex].fields.latlong[1])
            sendTextMessage(sender, text)
          }
        });
      }
    }
    else {
      console.log(response.statusCode);
    }
  });

}


function sendBPLocation(sender, res){
  console.log(res);
    for(let i = 0; i < res.sentence().entities.length ; i++){
    if (res.sentence().entities[i].name === 'organization'){
      var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont2&q="' + res.sentence().entities[i].value+'"';
      request(reques, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var tmp = JSON.parse(body);
          if(tmp.records.length === 0)
            var v = 'Aucun bureau de poste ne correspond a votre recherche';
          else{
            //saveData(sender, tmp.records[0].fields.identifiant_a);
            var v = 'Le bureau de poste est au ' + tmp.records[0].fields.adresse + ' à '+  tmp.records[0].fields.localite;
          }
          sendTextMessageWithHoraire(sender, v);
        }
      })
    }
  }
}


//envoie de l'itineraire
function sendItineraire(sender){
  if(baltable.has(sender)){
    sendTextMessage(sender,'https://www.google.fr/maps/dir//' + baltable.get(sender));
    return;
  }
  if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }

  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont2' + '&refine.identifiant_a='+hashtable.get(sender);
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      sendTextMessage(sender,'https://www.google.fr/maps/dir//'+ tmp.records[0].fields.latitude+','+tmp.records[0].fields.longitude);
    }
  });

}


//envoie de l'horaire de fermeture
function sendHoraire_ferm(sender){
  if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }
  var date = new Date();
  var strDate = date.toISOString().substring(0,10);
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_ouvertur' + '&refine.identifiant='+hashtable.get(sender) + '&q="' + strDate + '"';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      if(tmp.records.length === 0)
        var v = 'Votre bureau de poste n\'est actuellement pas ouvert';
      else{
        var v = 'Le bureau de poste ferme à ';
        if (typeof tmp.records[0].fields.plage_horaire_2 !== 'undefined')
          v = v + tmp.records[0].fields.plage_horaire_2.substring(6,11);
        else {
          v = v + tmp.records[0].fields.plage_horaire_1.substring(6,11)
        }
        v = v + ' aujourd\'hui';
      }
      sendTextMessage(sender, v);
    }
  })
}


//envoie des horaires
function sendHoraire(sender){
  if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }
  var date = new Date();
  var strDate = date.toISOString().substring(0,10);
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_ouvertur' + '&refine.identifiant='+hashtable.get(sender) + '&q="' + strDate + '"';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      if(tmp.records.length === 0)
        var v = 'Votre bureau de poste n\'est actuellement pas ouvert';
      else{
        var v = 'Les horaires d\'ouverture sont ' + tmp.records[0].fields.plage_horaire_1;
        if (typeof tmp.records[0].fields.plage_horaire_2 !== 'undefined')
          v = v + ' et '+  tmp.records[0].fields.plage_horaire_2;
        v = v + ' aujourd\'hui';
      }
      sendTextMessage(sender, v);
    }
  })
}

function sendHoraireDemain(sender){
  if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }
  var date = new Date();
  date.setDate(date.getDate() + 1);
  var strDate = date.toISOString().substring(0,10);
  console.log(strDate);
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_ouvertur' + '&refine.identifiant='+hashtable.get(sender) + '&q="' + strDate + '"';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      if(tmp.records.length === 0)
        var v = 'Votre bureau de poste n\'est actuellement pas ouvert';
      else{
        var v = 'Les horaires d\'ouverture sont ' + tmp.records[0].fields.plage_horaire_1;
        if (typeof tmp.records[0].fields.plage_horaire_2 !== 'undefined')
          v = v + ' et '+  tmp.records[0].fields.plage_horaire_2;
        v = v + ' demain';
      }
      sendTextMessage(sender, v);
    }
  })
}

function getService(sender){
  /*if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont' + '&refine.identifiant_a='+hashtable.get(sender);
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body).records[0].fields;
      if(tmp.accessibilite_presence_d_une_bande_de_guidage_au_sol === 'Oui')
        sendTextMessage(sender, '-Presence d\'une bande de guidage au sol');
      if(tmp.accessibilite_espace_de_circulation_interieur_suffisant_pour_pmr === 'Oui')
        sendTextMessage(sender, '-Espace de circulation interieur suffisant pour personne a mobilité reduite');
      if(tmp.accessibilite_pas_d_escalier_ou_bandes_de_vigilance_presentes === 'Oui')
        sendTextMessage(sender, '-Pas d\'escalier ou de bande de vigilange presentes');
      if(tmp.accessibilite_borne_sonore_en_etat_de_fonctionnement === 'Oui')
        sendTextMessage(sender, '-Borne sonore en etat de fonctionnement');
      if(tmp.accessibilite_absence_de_ressaut_de_plus_de_2_cm_de_haut === 'Oui')
        sendTextMessage(sender, '-Absence de ressaut de plus de 2 cm de haut');
      if(tmp.distributeur_de_timbres === 'Oui')
        sendTextMessage(sender, '-Distributeur de timbre');
      if(tmp.accessibilite_presence_d_un_gab_externe_accessible_pmr === 'Oui')
        sendTextMessage(sender, '-Presence d\'un gab externe accessible pour les personne a mobilité reduite');
      if(tmp.accessibilite_presence_d_un_espace_confidentiel_accessible_pmr === 'Oui')
        sendTextMessage(sender, '-Presence d\'un espace confidentiel accessible pour les personne a mobilité reduite');
      if(tmp.accessibilite_entree_autonome_en_fauteuil_roulant_possible === 'Oui')
        sendTextMessage(sender, '-Entrée autonome pour les personne en fauteuil roulant possible');
      if(tmp.accessibilite_automate_d_affranchissement_avec_prise_audio === 'Oui')
        sendTextMessage(sender, '-Automate d\'affranchisement avec prise audio');
      if(tmp.distributeur_de_billets === 'Oui')
        sendTextMessage(sender, '-Distributeur de billets');
      if(tmp.accessibilite_distributeur_de_billets_avec_prise_audio === 'Oui')
        sendTextMessage(sender, '-Distributeur de billets avec prise audio');
      if(tmp.distributeur_pret_a_poster === 'Oui')
        sendTextMessage(sender, '-Distributeur de prêt à poster');
      if(tmp.accessibilite_boucle_magnetique_en_etat_de_fonctionnement === 'Oui')
        sendTextMessage(sender, '-Boucle magnetique en etat de fonctionnement');
      if(tmp.accessibilite_presence_d_un_guichet_surbaisse_ou_d_un_ecritoire === 'Oui')
        sendTextMessage(sender, '-Presence d\'un guichet surbaisse ou d\'un ecritoire');
      if(tmp.accessibilite_presence_d_un_panneau_prioritaire === 'Oui')
        sendTextMessage(sender, '-Presence d\'un panneau prioritaire');
      if(tmp.changeur_de_monnaie === 'Oui')
        sendTextMessage(sender, '-Changeur de monnaie');
      if(tmp.affranchissement_libre_service === 'Oui')
        sendTextMessage(sender, '-Affranchissement libre service');
    }
  });*/
customeServiceMessage(sender);


}



//envoie du bureau de poste le plus proche de l'adresse
function getClosestDesk(sender, adresse){
  var reques = 'https://maps.googleapis.com/maps/api/geocode/json?address='+ adresse +'&key=INSERT_KEY';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
console.log(body);
      //comment
      loopFindAdresse(sender, 1000, tmp.results[0].geometry.location.lat, tmp.results[0].geometry.location.lng);
    }
  });
}


//recherche de la position
function loopFindAdresse(sender, radius, lat, lng){
  var reques = '';
  if (lng === 0)
    reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont2&geofilter.distance=' +lat + ','+radius+'&rows=1000&q="Bureau de Poste"';
  else
   reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont2&geofilter.distance=' +lat + ',' + lng + ','+radius+'&rows=1000&q="Bureau de Poste"';
  console.log(reques);
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp2 = JSON.parse(body);
      if (tmp2.nhits === '0'){
        radius = radius * 2;
        if (radius > 20000){
          sendTextMessage(sender, "Il n'y a pas de bureau de poste à proximité");
        }
        loopFindAdresse(sender, radius, tmp);
      }
      else {
        if (lng === 0)
           reques = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + lat + '&destinations=' +  tmp2.records[0].fields.latitude + ',' + tmp2.records[0].fields.longitude;
        else
          reques = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + lat + ',' + lng + '&destinations=' +  tmp2.records[0].fields.latitude + ',' + tmp2.records[0].fields.longitude;

        for(let i = 1; i < tmp2.records.length;i++){
          reques = reques + '|' + tmp2.records[i].fields.latitude + ',' + tmp2.records[i].fields.longitude;
        }
        reques = reques + '&language=fr-FR&key=INSERT_KEY';
        console.log(reques);
        request(reques, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            console.log(body);
            var tmp3 = JSON.parse(body);
            var min = 0;
            var minIndex = 0;
            for(let i = 0; i < tmp3.rows[0].elements.length;i++){
              if(min === 0 || min > tmp3.rows[0].elements[i].duration.value){
                min = tmp3.rows[0].elements[i].duration.value;
                minIndex = i;
              }
            }
            var text = 'Le bureau de poste le plus proche est au ' + tmp2.records[minIndex].fields.adresse + ' à ' + tmp2.records[minIndex].fields.localite;
            var date = new Date();
            var strDate = date.toISOString().substring(0,10);
            var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_ouvertur' + '&refine.identifiant='+hashtable.get(sender) + '&q="' + strDate + '"';
            request(reques, function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var tmp = JSON.parse(body);
                if(tmp.records.length === 0)
                  var v = 'Votre bureau de poste n\'est actuellement pas ouvert';
                else{
                  var v = 'Les horaires d\'ouverture sont ' + tmp.records[0].fields.plage_horaire_1;
                  if (typeof tmp.records[0].fields.plage_horaire_2 !== 'undefined')
                    v = v + ' et '+  tmp.records[0].fields.plage_horaire_2;
                  v = v + ' aujourd\'hui';
                }
              }
            });
            saveData(sender, tmp2.records[minIndex].fields.identifiant_a);
            sendTextMessageWithHoraire(sender, text);
          }
        });
      }
    }
  });

}


//envoie du bureau de poste sur une rue

function sendLocation(sender, res){
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_poincont2'
  for (let i = 0; i <res.sentence().entities.length; i++){
    if (res.sentence().entities[i].name === 'location')
    {
      reques = reques + '&q="' + res.sentence().entities[i].raw.toUpperCase()+'"';
    }
    if (res.sentence().entities[i].name === 'number')
    {
      reques = reques + '&rows=' + res.sentence().entities[i].value ;
    }
  }
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      if(tmp.records.length === 0)
        var v = 'Aucun bureau de poste ne correspond a votre recherche';
      else{
        saveData(sender, tmp.records[0].fields.identifiant_a);
        var v = 'Il y a un bureau de poste au ' + tmp.records[0].fields.adresse + ' à '+  tmp.records[0].fields.localite;
      }
      sendTextMessageWithHoraire(sender, v);
    }
  })
}


//historique
function saveData(sender, data){
  hashtable.remove(sender);
  baltable.remove(sender);
  hashtable.put(sender, data);
}


//ajouter les horaires au messages
function sendTextMessageWithHoraire(sender, text) {
  if (!hashtable.has(sender)){
    sendTextMessage(sender, 'Aucun bureau de poste en memoire');
    return;
  }
  var date = new Date();
  var strDate = date.toISOString().substring(0,10);
  var reques = 'https://datanova.legroupe.laposte.fr/api/records/1.0/search/?dataset=laposte_ouvertur' + '&refine.identifiant='+hashtable.get(sender) + '&q="' + strDate + '"';
  request(reques, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tmp = JSON.parse(body);
      if(tmp.records.length === 0)
        var v = 'Votre bureau de poste n\'est actuellement pas ouvert';
      else{
        var v = 'Les horaires d\'ouverture sont ' + tmp.records[0].fields.plage_horaire_1;
        if (typeof tmp.records[0].fields.plage_horaire_2 !== 'undefined')
          v = v + ' et '+  tmp.records[0].fields.plage_horaire_2;
        v = v + ' aujourd\'hui';
      }
      sendItineraireMessage(sender,text + "\n" +v);
    }
  })
}


//envoie d'un message
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



// envoie d'une demande de localisation
function askForLocation(sender){
  let messageData = {
    text:'Merci de partager votre localisation ou entrez votre adresse',
    quick_replies:[
      {
        content_type:'location',
      },
      {
        content_type:'text',
        payload:'LAST_LOC',
        title:'Dernière position'
      }
    ]
  }
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
          console.log('Error: ', response.body.error)
      }
  })
}

function customeServiceMessage(sender){
  var messageData = {
    attachment:{
     type:'template',
     payload:{
       template_type:'generic',
       elements:[
         {
           title:'Prêtez, échangez, louez votre logement ou votre véhicule... on s’occupe des clés en votre absence.',
           item_url:'https://www.ohmykeys.com/',
           image_url:'https://files.slack.com/files-pri/T055JA52L-F2H34TE48/capture_d___e__cran_2016-09-28_a___17.37.34.png',
           buttons:[
             {
               type:'web_url',
               url:'https://www.ohmykeys.com/',
               title:"Voir le site"
             }
           ]
         },
         {
           title:'Quand ce n’est pas vous, c’est nous! Partez tranquille tout est prévu pour vous rassurer.',
           item_url:'http://www.aniweedoo.fr/',
           image_url:'https://files.slack.com/files-pri/T055JA52L-F2H1PGTNX/capture_d___e__cran_2016-09-28_a___17.37.53.png',
           buttons:[
             {
               type:'web_url',
               url:'http://www.aniweedoo.fr/',
               title:"Voir le site"
             }
           ]
         },
         {
           title:'Profitez des bons plans!',
           item_url:'https://www.lapostemobile.fr/',
           image_url:'https://files.slack.com/files-pri/T055JA52L-F2H1Q4CFM/capture_d___e__cran_2016-09-28_a___17.38.11.png',
           buttons:[
             {
               type:'web_url',
               url:'https://www.lapostemobile.fr/',
               title:"Voir le site"
             }
           ]
         }
       ]
     }
   }
 };

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

function sendGretting(sender, text) {
  console.log(text);
    let messageData = {
      attachment:{
        type:'template',
        payload:{
          template_type:'button',
          text:text,
          buttons:[
          {
            type:'postback',
            payload:'CLOSE_DESK',
            title:'Bureau de poste'
          },
          {
            type:'postback',
            payload:'CLOSE_BAL',
            title:'Boite aux lettres'
          }]
        }
      }
    }
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

function sendItineraireMessage(sender, text) {
    let messageData = {
      attachment:{
        type:'template',
        payload:{
          template_type:'button',
          text:text,
          buttons:[
          {
            type:'postback',
            payload:'SEND_ITINERAIRE',
            title:'Itinéraire'
          }]
        }
      }
    }
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



// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})
