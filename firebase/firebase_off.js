module.exports = function(RED) {
    'use strict';

    function FirebaseOff(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.childpath = n.childpath;
        this.eventType = n.eventType;

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

        this.setStatus = function(error){
          //set = state (depending on the deployment strategy, for newly deployed nodes, some of the events may not be refired...)
          switch(this.config.fbConnection.lastEvent) {
            case "initializing":
              this.status({fill:"grey", shape:"ring", text:"initializing..."})
              break;
            case "connected":
              this.status({fill:"green", shape:"ring", text:"connected"})
              break;
            case "disconnected":
              this.status({fill:"red", shape:"ring", text:"disconnected"})
              break;
            case "authorized":
              this.status({fill:"green", shape:"dot", text:"ready"})
              break;
            case "unauthorized":
              this.status({fill:"red", shape:"dot", text:"unauthorized"})
              break;
            case "error":
              this.status({fill:"red", shape:"ring", text:error || "error"}) //TODO: should we store the last error?
              break;
            case "closed":
              this.status({fill: "gray", shape: "dot", text:"connection closed"})
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
          // this.log("initializing")
          this.setStatus();
        }.bind(this)

        this.fbConnected = function(){
          // this.log("connected")
          this.setStatus();
        }.bind(this)

        this.fbDisconnected = function(){
          // this.log("disconnected")
          this.setStatus();
        }.bind(this)

        this.fbAuthorized = function(authData){
          // this.log("authorized")
          this.setStatus();
        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
          this.setStatus();
        }.bind(this)

        this.fbError = function(error){
          // this.log("error - " + error)
          this.setStatus(error);
          this.error(error, {})
        }.bind(this)

        this.fbClosed = function(){
          // this.log("closed")
          this.setStatus();
        }.bind(this)


        //Register Handlers
        this.config.fbConnection.on("initializing", this.fbInitializing)
        this.config.fbConnection.on("connected", this.fbConnected)
        this.config.fbConnection.on("disconnected", this.fbDisconnected)
        this.config.fbConnection.on("authorized", this.fbAuthorized)
        this.config.fbConnection.on("unauthorized", this.fbUnauthorized)
        this.config.fbConnection.on("error", this.fbError)
        this.config.fbConnection.on("closed", this.fbClosed)

        // this.log("setting initial state to [fb" + this.config.fbConnection.lastEvent.capitalize()+ "]("+this.config.fbConnection.lastEventData+")" )

        //set initial state (depending on the deployment strategy, for newly deployed nodes, some of the events may not be refired...)
        this["fb" + this.config.fbConnection.lastEvent.capitalize()](this.config.fbConnection.lastEventData)  //Javascript is really friendly about sending arguments to functions...

        this.on('input', function(msg) {
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

              //Parse out msg.childpath
              var childpath = this.childpath
              if(childpath == "msg.childpath"){
                if("childpath" in msg){
                  childpath = msg.childpath
                }
              }
              childpath = childpath || "/"

              msg.eventType = eventType;
              msg.childpath = childpath || "/";

              if(msg.childpath)
                this.config.fbConnection.fbRef.child(msg.childpath).off(msg.eventType) //, this.onFBValue, this); //TODO: BUG: this is a little more overzealous than it should be but I don't have a good way for the node to send its own ID down the flow currently...
              else
                this.config.fbConnection.fbRef.off(msg.eventType) //, this.onFBValue, this);  //TODO: BUG: this is a little more overzealous than it should be but I don't have a good way for the node to send its own ID down the flow currently...
        });

        this.on('close', function() {
          this.destroyListeners();
        });

    }
    RED.nodes.registerType('firebase.off', FirebaseOff);
};
