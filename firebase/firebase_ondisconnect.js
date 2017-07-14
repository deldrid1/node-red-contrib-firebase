module.exports = function(RED) {
    'use strict';
    var path= require('path');

    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

    function FirebaseOnDisconnect(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.name = n.name;
        this.childpath = n.childpath;
        this.childtype = n.childtype;
        this.childvalue = n.childvalue;
        this.method = n.method;
        this.value = n.value;
        this.priority = n.priority;
        this.fbRequests = [];

        this.ready = false;

        this.validMethods = {
          "set": true,
          "update": true,
          "remove": true,
          "setWithPriority": true,
          "cancel": true
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
              //this.log("firebase synchronization failed")
              this.error("firebase synchronization failed - " + error, msg)
            }
        }.bind(this);


        //this.config.fbConnection EventEmitter Handlers
        this.fbInitializing = function(){  //This isn't being called because its emitted too early...
          // this.log("initializing")
          this.status({fill:"grey", shape:"ring", text:"initializing..."})
          this.ready = false;
        }.bind(this)

        this.fbConnected = function(){
          // this.log("connected")
          this.status({fill:"green", shape:"ring", text:"connected"})
          // this.ready = false;
        }.bind(this)

        this.fbDisconnected = function(){
          // this.log("disconnected")
          this.status({fill:"red", shape:"ring", text:"disconnected"})
          this.ready = false;
        }.bind(this)

        this.fbAuthorized = function(authData){
          // this.log("authorized")
          this.status({fill:"green", shape:"dot", text:"ready"})
          this.ready = true;
          if (this.value != "msg.payload" && this.method != "msg.method" && this.childpath != "msg.childpath"){
            //this.warn("FB Authorized -- explicitly emitting event INPUT");
            this.emit('input', {});
          }
        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
          this.status({fill:"red", shape:"dot", text:"unauthorized"})
          this.ready = false;
        }.bind(this)

        this.fbError = function(error){
          // this.log("error")
          this.status({fill:"red", shape:"ring", text:error})
          this.error(error, {})
        }.bind(this)

        this.fbClosed = function(error){
          // this.log("closed")
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

            //Parse out msg.method
            var method = this.method
            if(method == "msg.method"){
              if("method" in msg){
                method = msg.method
              } else {
                this.error("Expected \"method\" property not in msg object, .onDisconnect() will not be set", msg)
                return;
              }
            }

            //Parse out msg.payload
            var value = this.value;
            if (method != "setPriority" && method != "cancel"){
              if (value == "msg.payload"){
                if ("payload" in msg){
                  value = msg.payload;
                  if (!Buffer.isBuffer(value) && typeof value != "object"){
                    try {
                      value = JSON.parse(value)
                    } catch(e){
                      value = msg.payload.toString();
                    }
                  }
                } else {
                  this.warn("Expected \"payload\" property not in msg object (setting payload to \"null\")", msg);
                  value = null;
                }
              } else if(this.value == "Firebase.ServerValue.TIMESTAMP") {
                value = this.config.fbConnection.Firebase.ServerValue.TIMESTAMP
              }
              msg.payload = value;
            }

            //Parse out msg.priority
            var priority = null;
            if (method == "setPriority" || method == "setWithPriority"){
              priority = this.priority;
              if (priority == null){
                this.error("Expected \"priority\" property not included, .onDisconnect() will not be set", msg)
                return;
              } else if (priority == "msg.priority"){
                if ("priority" in msg) priority = msg.priority;
                else {
                  this.error("Expected \"priority\" property in msg object, .onDisconnect() will not be set", msg)
                  return;
                }
              }
            }

            //Parse out msg.childpath
           /* var childpath = this.childpath
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
            switch (method) {
              case "set":
              case "update":
              case "push":
                this.fbRequests.push(msg)
                this.config.fbConnection.fbRef.child(childpath).onDisconnect()[method](msg.payload, this.fbOnComplete.bind(this)); //TODO: Why doesn't the Firebase API support passing a context to these calls?
                break;javas
              case "remove":
                this.fbRequests.push(msg)
                this.config.fbConnection.fbRef.child(childpath).onDisconnect()[method](this.fbOnComplete.bind(this));
                break;
              // case "setPriority":
              //   this.fbRequests.push(msg)
              //   this.config.fbConnection.fbRef.child(childpath).onDisconnect()[method](priority, this.fbOnComplete.bind(this));
              //   break;
              case "cancel":
                this.fbRequests.push(msg)
                this.config.fbConnection.fbRef.child(childpath).onDisconnect()[method](this.fbOnComplete.bind(this));
                break;
              case "setWithPriority":
                this.fbRequests.push(msg)
                this.config.fbConnection.fbRef.child(childpath).onDisconnect()[method](msg.payload, priority, this.fbOnComplete.bind(this));
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
    RED.nodes.registerType("firebase ondisconnect", FirebaseOnDisconnect);

    RED.httpAdmin.post("/firebase/:id/cancelOnDisconnect", RED.auth.needsPermission("firebase.write"), function(req,res) {
            var node = RED.nodes.getNode(req.params.id);
            if (node !== null && typeof node !== "undefined" ) {
              if(node.ready){
                node.config.fbConnection.fbRef.onDisconnect().cancel(function(error){
                  if(error){
                    res.send(502, error)
                  } else{
					          node.warn("Cancelling all firebase.onDisconnect() values");
                    res.send(200)
                  }
                }) //Cancel all previously queued onDisconnect() set or update events for this location and all children
              }
            } else {
                res.send(404);
            }
        });
};
