module.exports = function(RED) {
  'use strict';
  var Firebase = require('firebase');
  String.prototype.capitalize = function() {
      return this.charAt(0).toUpperCase() + this.slice(1);
  }

  function FirebaseModify(n) {
      RED.nodes.createNode(this,n);

      this.config = RED.nodes.getNode(n.firebaseconfig);
      this.childpath = n.childpath;
      this.childtype = n.childtype;
      this.childvalue = n.childvalue;
      this.value = n.value;
      this.valuetype = n.valuetype;
      this.valueval = n.valueval;
      this.method = n.method;
      this.priority = n.priority;
      this.fbRequests = [];

      this.ready = false;

      this.validMethods = {
        "set": true,
        "update": true,
        "push": true,
        "remove": true,
    		"setPriority": true,
    		"setWithPriority": true
      }

      // Check credentials
      if (!this.config) {
          this.status({fill:"red", shape:"ring", text:"invalid credentials"})
          this.error('You need to setup Firebase credentials!');
          return
      }

      this.fbOnComplete = function(error) {
          //this.log("fb oncomplete.  error = " + error)
          var msg = this.fbRequests.shift() //Firebase will call these in order for us
          //TODO: Once Node-Red supports it, we should flash the Node when we receive this data.
          if(error){
            this.log("firebase synchronization failed")
            this.error("firebase synchronization failed - " + error, msg)
          } else {
          	this.send(msg)
          }
      }.bind(this);


      //this.config.fbConnection EventEmitter Handlers
      this.fbInitializing = function(){  //This isn't being called because its emitted too early...
        this.status({fill:"grey", shape:"ring", text:"initializing..."})
        this.ready = false;
      }.bind(this)

      this.fbConnected = function(){
        this.status({fill:"green", shape:"ring", text:"connected"})
        this.ready = false;
      }.bind(this)

      this.fbDisconnected = function(){
        this.status({fill:"red", shape:"ring", text:"disconnected"})
        this.ready = false;
      }.bind(this)

      this.fbAuthorized = function(authData){
        this.status({fill:"green", shape:"dot", text:"ready"})
        this.ready = true;
      }.bind(this)

      this.fbUnauthorized = function(){
        this.status({fill:"red", shape:"dot", text:"unauthorized"})
        this.ready = false;
      }.bind(this)

      this.fbError = function(error){
        this.status({fill:"red", shape:"ring", text:error})
      }.bind(this)

      this.fbClosed = function(error){
        this.status({fill: "gray", shape: "dot", text:"connection closed"})
        this.ready = false;
      }.bind(this)


      //Register Handlers
      this.config.fbConnection.on("initializing", this.fbInitializing)
      this.config.fbConnection.on("connected", this.fbConnected)
      this.config.fbConnection.on("disconnected", this.fbDisconnected)
      this.config.fbConnection.on("authorized", this.fbAuthorized)
      this.config.fbConnection.on("unauthorized", this.fbUnauthorized)
      this.config.fbConnection.on("error", this.fbError)
      this.config.fbConnection.on("closed", this.fbClosed)

      //set initial state (depending on the deployment strategy, for newly deployed nodes, some of the events may not be refired...)
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


      this.on('input', function(msg) {
        if(this.ready){

          //TODO: this seems to be mostly working, but we really ought to do some more due diligence here...
          //Try to convert to JSON object...
          //Parse out msg.method
          var method = this.method
          if(method == "msg.method"){
            if("method" in msg){
              method = msg.method
            } else {
              this.error("Expected \"method\" property in msg object", msg)
              return;
            }
          }

          //Parse out msg.payload
          
          var value;
          if (method != "setPriority"){

          if(this.valuetype == "str"){
            value = this.value;
          }
          else if(this.valuetype == "msg"){
            console.log("valueval is ", this.valueval)
            var valueval = this.valueval
            value = msg[valueval];
          }
          else if(this.valuetype == "flow"){
            var valueval = this.valueval;
            value = this.context().flow.get(valueval)
          }
          else if(this.valuetype == "global"){
            var valueval = this.valueval;
            value = this.context().global.get(valueval)
          }
          else if(this.valuetype == "jsonata"){
            try{
                var valueval = this.valueval;
                value = jsonata(valueval);
                value = value.evaluate({msg:msg})
            }catch(e){
                console.log("ERROR WITH JSONATA");
                    }           
          }
         else if(this.valuetype == "serverTS"){
            value = Firebase.database.ServerValue.TIMESTAMP;
         }
         else if(this.valuetype == "date"){
            value = Date.now();
         }

            msg.payload = value;
          }

          //Parse out msg.priority
          var priority = null;
          if (method == "setPriority" || method == "setWithPriority"){
            priority = this.priority;
            if (priority == null){
              this.error("Expected \"priority\" property not included", msg)
              return;
            } else if (priority == "msg.priority"){
              if ("priority" in msg) priority = msg.priority;
              else {
                this.error("Expected \"priority\" property in msg object", msg)
                return;
              }
            }
          }

          //Parse out msg.childpath
          /*var childpath = this.childpath
          if(childpath == "msg.childpath"){
            if("childpath" in msg){
              childpath = msg.childpath
            }
          }
          childpath = childpath || "/"
          */
          var childpath
          //Parse out msg.childpath         
          if(this.childtype == "str"){
            childpath = this.childpath
          }
          else if(this.childtype == "msg"){
            var childvalue = this.childvalue;
            childpath = msg[childvalue];
          }
          else if(this.childtype == "flow"){
            var childvalue = this.childvalue;
            childpath = this.context().flow.get(childvalue)
          }
          else if(this.childtype == "global"){
            var childvalue = this.childvalue;
            childpath = this.context().global.get(childvalue)
          }
          else if(this.childtype == "jsonata"){
            try{
                var childvalue = this.childvalue;
                childpath = jsonata(childvalue);
                childpath = childpath.evaluate({msg:msg})
            }catch(e){
                console.log("ERROR WITH JSONATA");
                    }           
          }
         
          childpath = childpath || "/"
         
          msg.childpath = childpath || "/";


          switch (method){
            case "set":
            case "update":
              this.fbRequests.push(msg)
              this.config.fbConnection.fbRef.child(childpath)[method](msg.payload, this.fbOnComplete.bind(this)); //TODO: Why doesn't the Firebase API support passing a context to these calls?
              break;
            case "push":
              var pushRef = this.config.fbConnection.fbRef.child(childpath)[method]();
              msg.pushID = pushRef.key;
              this.fbRequests.push(msg)
              pushRef.set(msg.payload, this.fbOnComplete.bind(this)); //TODO: Why doesn't the Firebase API support passing a context to these calls?
              break;
            case "remove":
              this.fbRequests.push(msg)
              this.config.fbConnection.fbRef.child(childpath)[method](this.fbOnComplete.bind(this));
              break;
            case "setPriority":
              this.fbRequests.push(msg)
              this.config.fbConnection.fbRef.child(childpath)[method](priority, this.fbOnComplete.bind(this));
              break;
            case "setWithPriority":
              this.fbRequests.push(msg)
              this.config.fbConnection.fbRef.child(childpath)[method](msg.payload, priority, this.fbOnComplete.bind(this));
              break;
            default:
              this.error("Invalid msg.method property \"" + method + "\".  Expected one of the following: [\"" + Object.keys(this.validMethods).join("\", \"") + "\"].", msg)
              break;
          }
        } else {
          this.warn("Received msg before firebase modify node was ready.  Not processing: " + JSON.stringify(msg, null, "\t"))
        }
      });


      this.on('close', function() {
        //Cancel modify request to firebase??
      });

  }
  RED.nodes.registerType("firebase modify", FirebaseModify);
};
