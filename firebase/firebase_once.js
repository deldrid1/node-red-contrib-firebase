module.exports = function(RED) {
    'use strict';
    var https = require("follow-redirects").https;
    var utils = require("./FirebaseUtils.js");
    var urllib = require("url");
    var getPushIdTimestamp = (function getPushIdTimestamp() {
    var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
      return function getTimestampFromId(id) {
        try {
          var time = 0;
          var data = id.substr(0, 8);

          for (var i = 0; i < 8; i++) {
            time = time * 64 + PUSH_CHARS.indexOf(data[i]);
          }
          return time;
        } catch(ex){}
      }
    })();

    function FirebaseOnce(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.childpath = n.childpath;
        this.eventType = n.eventType;
        this.eventTypevalue = n.eventTypevalue;
        this.queries = n.queries;
        this.repeatifnull = n.repeatifnull;
        this.event = n.event;
        this.childtype = n.childtype;
        this.childvalue = n.childvalue;
  

        this.activeRequests = [];
        this.ready = false;
        if (!this.config) {
            this.status({fill:"red", shape:"ring", text:"invalid credentials"})
            this.error('You need to setup Firebase credentials!');
            return
        }
        this.validEventTypes = {
          "value": true,
          "child_added": true,
          "child_changed": true,
          "child_removed": true,
          "child_moved": true,
          "shallow_query": true
        }

        this.onFBData = function(snapshot, prevChildName) {
            //Tstart with original message object so we retain all of those properties...
            var msg = this.activeRequests.shift();

            msg.href = snapshot.ref.toString();
            msg.key = snapshot.key; 
            msg.payload = snapshot.val(); 

            if(snapshot.getPriority())
              msg.priority = snapshot.getPriority();
            if(prevChildName)
              msg.previousChildName = prevChildName;

            if(this.repeatifnull && msg.payload == null && msg.attemptNumber++ < 100 ){ // Repeat sending the request.  //TODO: we could use a configurable timer in seconds or a configurable number of attempts
              this.registerListeners(msg)
            } else {
              this.send(msg);
            }
            this.setStatus();
        }.bind(this);

        this.onFBError = function(error){
          this.error(error, {})
          this.status({fill:"red",shape:"ring",text:error.code || "error"});
          setTimeout(this.setStatus, 5000)  //Reset back to the Firebase status after 5 seconds
        }.bind(this);

        this.registerListeners = function(msg){

          var eventType = utils.getType(this.eventType,this.eventTypevalue,msg,this);

          if(!(eventType in this.validEventTypes)){ //ensure eventType is one of the allowed events
              this.error("Invalid msg.eventType property \"" + eventType + "\".  Expected one of the following: [\"" + Object.keys(this.validEventTypes).join("\", \"") + "\"].", msg)
            }
          
          var childpath = utils.getType(this.childtype,this.childvalue,msg,this);

          if(childpath == "jsonata"){
            try{
                var childvalue = this.childvalue;
                childpath = RED.util.prepareJSONataExpression(childvalue,this);
                childpath = RED.util.evaluateJSONataExpression(childpath, msg);
            }catch(e){
                node.error(RED._("firebase.once.errors.invalid-expr",{error:err.message}));
            }  
          }
         
          childpath = childpath || "/"
          msg.eventType = eventType;
          msg.childpath = childpath || "/";

          if(!msg.attemptNumber)
            msg.attemptNumber = 0

          this.activeRequests.push(msg)

          if(eventType == "shallow_query"){
            this.shallowQuery(msg)  //TODO: https://www.firebase.com/docs/rest/guide/retrieving-data.html#section-rest-ordered-data and https://www.firebase.com/docs/rest/guide/retrieving-data.html#section-rest-queries
          } else {
            this.fbOnce(eventType, msg);
          }
        }.bind(this);

        this.destroyListeners = function(reason){
          if(this.activeRequests.length > 0 && reason){  //ensure the close function doesn't trigger this
            var msg = this.activeRequests.shift()
            this.error(reason, msg)
            var eventType = this.eventType
            if(eventType == "msg.eventType")
              eventType = msg.eventType

            if(!(eventType in this.validEventTypes)){
              //this.error("Invalid eventType - \"" + eventType + "\"", msg)  //We have already errored on the registerListener call
              return;
            }
            // We need to unbind our callback, or we'll get duplicate messages when we redeploy
            if(msg.childpath)
              this.config.fbConnection.fbRef.child(msg.childpath).off(eventType, this.onFBData, this);
            else
              this.config.fbConnection.fbRef.off(eventType, this.onFBData, this);
          }
        }.bind(this);

        this.fbOnce = function(eventType, msg){
          this.status({fill:"blue",shape:"dot",text:"requesting from firebase..."});

          //Create the firebase reference to the path
          var ref
          if(msg.childpath){
            ref = this.config.fbConnection.fbRef.child(msg.childpath)
          }else{
            ref = this.config.fbConnection.fbRef
          }
          var bool = false;
          //set a default for what the query should be ordered by if none is chosen
          for (var i=0; i<this.queries.length; i+=1) {
            var q = this.queries[i].name;
            if( q == "orderByKey" || q == "orderByValue" || q =="orderByPriority" || q == "orderByChild"){ 
              bool = true;
              }
          }
          if(bool == false){
            q = "orderByKey"
            ref= ref[q]();
          }

          for (var i=0; i<this.queries.length; i+=1) {
              var query = this.queries[i];
              switch(query.name){
                case "orderByKey":    
                case "orderByValue":
                case "orderByPriority":
                  ref= ref[query.name]();
                case "orderByChild":
                case "startAt":
                case "endAt":
                case "equalTo":
                case "limitToFirst":
                case "limitToLat":
                  ref = utils.getRef(ref,query.valType,query.name,query.value,msg,this);
                  if(ref == "json"){ 
                    try {
                      var val = JSON.stringify(query.value);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    }
                    ref = ref[queryname](val);
                  }
                  else if(ref == "jsonata"){ 
                    try{
                      var val = RED.util.prepareJSONataExpression(query.value);
                      val = RED.util.evaluateJSONataExpression(val, msg);
                      ref = ref[queryname](val);
                    }
                    catch(e){
                      node.error(RED._("firebase.once.errors.invalid-expr",{error:err.message}));
                    }
                  }
                   break;
                default:
                  //TODO:
                  break;
              }    
          }     
          ref.once(eventType, this.onFBData, this.onFBError, this);
        }.bind(this)

        this.shallowQuery = function(msg){  //Could we use the REST Streaming API and do shallow queries in firebase.on()? Update - currently firebase doesn't support shallow and query args in the same request
          this.status({fill:"blue",shape:"dot",text:"shallow_query requesting..."});

          // make sure the path starts with '/'
          var childpath = (msg.childpath.indexOf("/") == 0) ? msg.childpath : "/" + msg.childpath;
          //make sure the path does not end with '/', (unless that is the string in its entirety)
          childpath = (childpath.length != 1 && childpath.substr(-1) == "/") ? childpath.slice(0,-1) : childpath

          msg.href = this.config.firebaseurl + childpath
          var url =  msg.href + ".json?shallow=true"

          if(this.config.fbConnection.passORuid)
            url += "&auth=" + this.config.fbConnection.passORuid

          //apply the queries
          for (var i=0; i<this.queries.length; i+=1) {
              var query = this.queries[i];
              var val

              //try to convert to native type for bools, ints, etc.
              try{ val = JSON.parse(query.value.toLowerCase() || query.value) }
              catch(e){ val = query.value}

              switch(query.name){
                case "orderByChild":
                  url += '&orderBy="' + val + '"'
                  break;
                case "orderByKey":
                  url += '&orderBy="$key"'
                  break;
                case "orderByValue":
                  url += '&orderBy="$value"'
                  break;
                case "orderByPriority":
                  url += '&orderBy="$priority"'
                  break;
                case "startAt":
                case "endAt":
                case "equalTo":
                case "limitToFirst":
                case "limitToLast":
                  if (typeof val == 'string' || val instanceof String)
                    url += '&' + query.name + '="' + val + '"'
                  else
                    url += '&' + query.name + '='+ val
                  break;

                default:
                  //TODO:
                  break;
              }
          }

          var opts = urllib.parse(url);
          opts.method = "GET";;
          //opts.headers = {};

          //TODO: BUG: There needs to be a request.ontimeout
          var req = https.request(opts,function(res) {
              res.setEncoding('utf8');
              msg.statusCode = res.statusCode;
              //msg.headers = res.headers;
              msg.payload = "";
              //msg.url = url;   // revert when warning above finally removed
              res.on('data',function(chunk) {
                  msg.payload += chunk;
              }.bind(this));

              res.on('end',function() {
                  try { msg.payload = JSON.parse(msg.payload); }
                  catch(e) { this.warn("JSON parse error"); }

                  if(msg.statusCode != 200){
                    this.error(msg.payload.error || "firebase shallow_query error", msg)
                    this.status({fill:"red",shape:"ring",text:msg.payload.error || "error"});
                    setTimeout(this.setStatus, 5000)  //Reset back to the Firebase status after 5 seconds
                  } else {
                    if(this.repeatifnull && msg.payload == null && msg.attemptNumber++ < 100 ){ // Repeat sending the request
                      this.registerListeners(msg)
                    } else {
                      this.send(msg);
                    }
                    this.setStatus();
                  }
              }.bind(this));
          }.bind(this));

          req.on('error',function(err) {
              msg.statusCode = err.code;
              this.error(err.toString() + " : " + url, msg);
              this.status({fill:"red",shape:"ring",text:err.code});
              setTimeout(this.setStatus, 5000)  //Reset back to the Firebase status after 5 seconds
          }.bind(this));

          req.end();
        }.bind(this);

        this.setStatus = function(){
          //set = state (depending on the deployment strategy, for newly deployed nodes, some of the events may not be refired...)
          switch(this.config.fbConnection.lastEvent) {
            case "initializing":
            case "connected":
            case "disconnected":
            case "authorized":
            case "unauthorized":
            case "error":
            case "closed":
              this["fb" + this.config.fbConnection.lastEvent.capitalize()](this.config.fbConnection.lastEventData)  //Javascript is really friendly about sending arguments to functions...
              break;
            // case "undefined":
            // case "null":
            //   break;  //Config node not yet setup
            default:
              this.error("Bad lastEvent Data from Config Node - " + this.config.fbConnection.lastEvent)
          }

        }.bind(this)


        //this.config.fbConnection EventEmitter Handlers
        this.fbInitializing = function(){  //This isn't being called because its emitted too early...
          // this.log("initializing...")
          this.status({fill:"grey", shape:"ring", text:"initializing..."})
          this.ready = false;
        }.bind(this)

        this.fbConnected = function(){
          // this.log("connected")
          this.status({fill:"green", shape:"ring", text:"connected"})
          this.ready = false;
        }.bind(this)

        this.fbDisconnected = function(){
          // this.log("disconnected")
          this.status({fill:"red", shape:"ring", text:"disconnected"})
          this.ready = false;
        }.bind(this)

        this.fbAuthorized = function(authData){
          // this.log("authorized: " + JSON.stringify(authData))
          this.status({fill:"green", shape:"dot", text:"ready"})
          this.ready = true;
        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
          this.status({fill:"red", shape:"dot", text:"unauthorized"})
          this.ready = false;
          this.destroyListeners();
        }.bind(this)

        this.fbError = function(error){
          //this.log("error: " + JSON.stringify(error))
          this.status({fill:"red", shape:"ring", text:error})
          this.error(error, {})
          this.destroyListeners();
        }.bind(this)

        this.fbClosed = function(error){
          //this.log("closed")
          this.status({fill: "gray", shape: "dot", text:"connection closed"})
          this.ready = false;
          this.destroyListeners();  //TODO: this is being called in too many places but better safe than sorry?  Really need to figure out execution flow of Node-Red and decide if we can only have it here instead of also in this.on("close")
        }.bind(this)

        //Register Handlers
  
        this.config.fbConnection.on("initializing", this.fbInitializing)
        this.config.fbConnection.on("connected", this.fbConnected)
        this.config.fbConnection.on("disconnected", this.fbDisconnected)
        this.config.fbConnection.on("authorized", this.fbAuthorized)
        this.config.fbConnection.on("unauthorized", this.fbUnauthorized)
        this.config.fbConnection.on("error", this.fbError)
        this.config.fbConnection.on("closed", this.fbClosed)

        this.setStatus()

        this.on('input', function(msg) {

            if(this.ready){
              this.registerListeners(msg);
            } else {
              this.warn("Received msg before firebase.once() node was ready.  Not processing: " + JSON.stringify(msg, null, "\t"))
            }
        });

        this.on('close', function() {
          this.destroyListeners();
        });

    }
    RED.nodes.registerType('firebase.once', FirebaseOnce);
};