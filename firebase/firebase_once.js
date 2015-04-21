module.exports = function(RED) {
    'use strict';
    var https = require("follow-redirects").https;
    var urllib = require("url");


    function FirebaseOnce(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.childpath = n.childpath;
        this.eventType = n.eventType;

        this.activeRequests = [];
        this.ready = false;
        this.authData = null;

        // Check credentials
        if (!this.config) {
            this.status({fill:"red", shape:"ring", text:"invalid credentials"})
            this.error('You need to setup Firebase credentials!');
            return
        }

        this.validEventTypes = {
          "value": true,
          "child_added": true,
          "child_changed": true,
          "chiled_removed": true,
          "child_moved": true,
          "shallow_query": true
        }

        this.onFBData = function(snapshot, prevChildName) {
            //console.log("In onFBData + " + JSON.stringify(snapshot.val()))
            //TODO: Once Node-Red supports it, we should flash the Node when we receive this data.

            // if(!snapshot.exists()){
            //   //The code below will simply send a payload of nul if there is no data
            // }

            //Tstart with original message object so we retain all of those properties...
            var msg = this.activeRequests.shift();

            msg.href = snapshot.ref().toString();
            msg.key = snapshot.key();
            msg.payload = snapshot.val();
            if(snapshot.getPriority())
              msg.priority = snapshot.getPriority();
            if(prevChildName)
              msg.previousChildName = prevChildName;

            this.send(msg);
            this.setStatus();
        }.bind(this);

        this.onFBError = function(error){
          this.error(error, {})
          this.status({fill:"red",shape:"ring",text:error || "error"});
          setTimeout(this.setStatus, 5000)  //Reset back to the Firebase status after 5 seconds
        }.bind(this);

        this.registerListeners = function(msg){

          var eventType = this.eventType
          if(eventType == "msg.eventType"){
            if("eventType" in msg){
              eventType = msg.eventType
            } else {
              this.error("Expected \"eventType\" property in msg object", msg)
              return;
            }
          }

          if(!(eventType in this.validEventTypes)){
            this.error("Invalid msg.eventType property \"" + eventType + "\".  Expected one of the following: [\"" + Object.keys(this.validEventTypes).join("\", \"") + "\"].", msg)
            return;
          }

          var childpath = this.childpath
          if(!childpath || childpath == ""){
            if("childpath" in msg){
              childpath = msg.childpath
            }
          }


          msg.eventType = eventType;
          msg.childpath = childpath || "/";
          this.activeRequests.push(msg)

          if(msg.eventType == "shallow_query"){
            this.shallowQuery(msg)
          } else {
            this.status({fill:"blue",shape:"dot",text:"requesting from firebase..."});
            if(msg.childpath){
              this.config.fbConnection.fbRef.child(msg.childpath).once(eventType, this.onFBData, this.onFBError, this);
            }else{
              this.config.fbConnection.fbRef.once(eventType, this.onFBData, this.onFBError, this);
            }
          }


        }.bind(this);

        this.destroyListeners = function(reason){
          if(this.activeRequests.length > 0 && reason){  //ensure the close function doesn't trigger this
            // var msg = {};
            // msg.href = this.config.firebaseurl;
            // msg.payload = "ERROR: " + reason;
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

        this.shallowQuery = function(msg){
          this.status({fill:"blue",shape:"dot",text:"shallow_query requesting..."});

          // make sure the path starts with '/'
          var childpath = (msg.childpath.indexOf("/") == 0) ? msg.childpath : "/" + msg.childpath;
          //make sure the path does not end with '/', (unless that is the string in its entirety)
          childpath = (childpath.length != 1 && childpath.substr(-1) == "/") ? childpath.slice(0,-1) : childpath

          msg.href = this.config.firebaseurl + childpath
          var url =  msg.href + ".json?shallow=true"

          if(this.authData && this.authData.token)
            url += "&auth=" + this.authData.token

          var opts = urllib.parse(url);
          opts.method = "GET";;
          //opts.headers = {};

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
                    this.send(msg);
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
            case "connecting":
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
        this.fbConnecting = function(){  //This isn't being called because its emitted too early...
          // this.log("connecting...")
          this.status({fill:"grey", shape:"ring", text:"connecting..."})
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
          this.authData = authData
        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
          this.status({fill:"red", shape:"dot", text:"unauthorized"})
          this.ready = false;
          this.destroyListeners();
          this.authData = null;
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
        this.config.fbConnection.on("connecting", this.fbConnecting)
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
