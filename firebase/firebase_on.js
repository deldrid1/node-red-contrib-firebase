module.exports = function(RED) {
    'use strict';
    var utils = require("./FirebaseUtils.js");
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
    function FirebaseOn(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.childpath = n.childpath;
        this.atStart = n.atStart;
        this.queries = n.queries
        this.childtype = n.childtype;
        this.childvalue = n.childvalue;
        this.eventType = n.eventType;
        this.eventTypevalue = n.eventTypevalue;
        this.ready = false;
        this.ignoreFirst = this.atStart;
        this.authorized = false;
        this.msg = null;

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
          "child_removed": true,
          "child_moved": true,
          "shallow_query": true
        }

        this.onFBValue = function(snapshot, prevChildName) {
            //console.log("In onFBValue + " + JSON.stringify(snapshot.val()))

            if(this.ignoreFirst == false){
              this.ignoreFirst = true
              return;
            }

            this.status({fill:"blue",shape:"dot",text:"received data"});

            // if(!snapshot.exists()){
            //   //The code below will simply send a payload of nul if there is no data
            // }
            var msg = {};
            msg.href = snapshot.ref.toString();
            msg.key = snapshot.key;
            msg.payload = snapshot.val();
   
            if(snapshot.getPriority())
              msg.priority = snapshot.getPriority();
            if(prevChildName)
              msg.previousChildName = prevChildName;
            if(this.eventType.search("child") != -1 && getPushIdTimestamp(msg.key))  //We probably have a pushID that we can decode
              msg.pushIDTimestamp = getPushIdTimestamp(msg.key)

            this.send(msg);

            setTimeout(this.setStatus, 500)  //Reset back to the Firebase status after 0.5 seconds
        }.bind(this);

        this.onFBError = function(error){
          this.error(error, {})
          this.status({fill:"red",shape:"ring",text:error.code || "error"});
          setTimeout(this.setStatus, 5000)  //Reset back to the Firebase status after 5 seconds
        }.bind(this);

        this.registerListeners = function(msg){
            
          //this.log("Registering Listener for " + this.config.firebaseurl + (this.childpath || ""))

          if(this.ready == true)
            return  //Listeners are already created

          this.ready = true;
          this.ignoreFirst = this.atStart;  //Reset if we are re-registering listeners

          //Create the firebase reference to the path
          var ref
          var msg = this.msg;
          var childpath = utils.getType(this.childtype,this.childvalue,msg,this);
          
          if(childpath == "jsonata"){
            try{
                var childvalue = this.childvalue;
                childpath = RED.util.prepareJSONataExpression(childvalue,this);
                childpath = RED.util.evaluateJSONataExpression(childpath, msg);
            }catch(e){
                node.error(RED._("firebase.on.errors.invalid-expr",{error:err.message}));
            }     
          }   
          
          if(this.childpath){
            ref = this.config.fbConnection.fbRef.child(childpath)  
          } else {
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
                case "limitToLast":
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
          
    
          var eventType = utils.getType(this.eventType,this.eventTypevalue,msg,this);
          this.eventType = eventType;
          //was this.eventType
          if(!(eventType in this.validEventTypes)){ //ensure eventType is one of the allowed events
              this.error("Invalid msg.eventType property \"" + eventType + "\".  Expected one of the following: [\"" + Object.keys(this.validEventTypes).join("\", \"") + "\"].", msg)
            }
          ref.on(eventType, this.onFBValue, this.onFBError, this);
          //ref.on(eventType, this.onFBData, this.onFBError, this);
        
        }.bind(this);

        this.destroyListeners = function(){
          if(this.ready == false)
            return;

          // We need to unbind our callback, or we'll get duplicate messages when we redeploy
          if(this.childtype != "msg"){ //Not using in input mode - do what we've always done
            if(this.childpath)
              this.config.fbConnection.fbRef.child(this.childpath).off(this.eventType, this.onFBValue, this);
            else
              this.config.fbConnection.fbRef.off(this.eventType, this.onFBValue, this);
          } else {  // We've been set by our input port
            if(this.childpath)
              this.config.fbConnection.fbRef.child(this.childpath  == "msg.childpath" ? this.msg.childpath : this.childpath).off(this.eventType == "msg.eventType" ? this.msg.eventType : this.eventType, this.onFBValue, this);
            else
              this.config.fbConnection.fbRef.off(this.eventType == "msg.eventType" ? this.msg.eventType : this.eventType, this.onFBValue, this);
          }
          this.ready = false;
          this.msg == null;

        }.bind(this);

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
          this.authorized = true;
          this.setStatus();
          if(this.childtype != "msg"){ //only fire without input if its a string  //TODO: BUG: need to search the jsonata string to see if it is looking for any msg. (which may be implicit as of NR v.17) things to see if this is legal
            this.registerListeners(); 
          }
          //}
        }.bind(this)

        this.fbUnauthorized = function(){
          this.authorized = false;
          this.setStatus();
          this.destroyListeners();
        }.bind(this)

        this.fbError = function(error){
          // this.log("error - " + error)
          this.setStatus(error);
          this.error(error, {})
        }.bind(this)

        this.fbClosed = function(){
          // this.log("closed")
          this.setStatus();
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

        // this.log("setting initial state to [fb" + this.config.fbConnection.lastEvent.capitalize()+ "]("+this.config.fbConnection.lastEventData+")" )

        //set initial state (depending on the deployment strategy, for newly deployed nodes, some of the events may not be refired...)
        this["fb" + this.config.fbConnection.lastEvent.capitalize()](this.config.fbConnection.lastEventData)  //Javascript is really friendly about sending arguments to functions...

        this.on('input', function(msg) {
  
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

          this.msg = msg;
        
          //if we are authorized
          //if we have listerners
          if(this.authorized == true){
            if(this.ready == true){ //We have listeners
              this.destroyListeners();
              this.registerListeners();
            } else { // We don't have listeners
              this.registerListeners();
            }
          }

        }.bind(this));

        this.on('close', function() {
          this.destroyListeners();
        }.bind(this));

    }
    RED.nodes.registerType('firebase.on', FirebaseOn);
};
