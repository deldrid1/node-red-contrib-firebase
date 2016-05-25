module.exports = function(RED) {
    'use strict';

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
        this.eventType = n.eventType;
		    this.queries = n.queries

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
          "chiled_removed": true,
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
            msg.href = snapshot.ref().toString();
            msg.key = snapshot.key();
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
          if(this.childpath){
            ref = this.config.fbConnection.fbRef.child(this.childpath  == "msg.childpath" ? this.msg.childpath : this.childpath)  //Decide if we are using our input msg object or the string we were configured with
          } else {
            ref = this.config.fbConnection.fbRef
          }

          //apply the queries
          for (var i=0; i<this.queries.length; i+=1) {
              var query = this.queries[i];
              var val

              switch(query.name){
                case "orderByKey":
                case "orderByValue":
                case "orderByPriority":
                  ref = ref[query.name]()  //No args //TODO: BUG: Update HTML to hide box for these 3...
                  break;

                case "orderByChild":
                case "startAt":
                case "endAt":
                case "equalTo":
                case "limitToFirst":
                case "limitToLast":
                  //try to convert to native type for bools, ints, etc.
                  try{ val = JSON.parse(query.value.toLowerCase() || query.value) }
                  catch(e){ val = query.value}

                  ref = ref[query.name](val) //TODO: no error checking...
                  break;

                default:
                  //TODO:
                  break;
              }
          }

          ref.on(this.eventType == "msg.eventType" ? this.msg.eventType : this.eventType, this.onFBValue, this.onFBError, this);


        }.bind(this);

        this.destroyListeners = function(){
          if(this.ready == false)
            return;

          // We need to unbind our callback, or we'll get duplicate messages when we redeploy
          if(this.msg == null){ //Not using in input mode - do what we've always done
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

          if((this.eventType != "msg.eventType" && this.childpath != "msg.childpath") || this.msg != null)
            this.registerListeners();

        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
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
          var eventType
          if(this.eventType == "msg.eventType"){
            if("eventType" in msg){
              eventType = msg.eventType
            } else {
              this.error("Expected \"eventType\" property in msg object", msg)
              return;
            }
          } else {
            eventType = this.eventType
          }

          if(!(eventType in this.validEventTypes)){
            this.error("Invalid msg.eventType property \"" + eventType + "\".  Expected one of the following: [\"" + Object.keys(this.validEventTypes).join("\", \"") + "\"].", msg)
            return;
          }

          //Parse out msg.childpath
          var childpath
          if(this.childpath == "msg.childpath"){
            if("childpath" in msg){
              childpath = msg.childpath
            }
          }
          childpath = childpath || "/"

          msg.eventType = eventType;
          msg.childpath = childpath || "/";

          this.msg = msg;
          console.log(msg.childpath)

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
