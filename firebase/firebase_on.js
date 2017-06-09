module.exports = function(RED) {
    'use strict';

    var jsonata = require("jsonata");
    var startAtvar;
    var equalTovar;
    var bool;

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

var startAtvar;
var bool;
    function FirebaseOn(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.childpath = n.childpath;
        this.event = n.event;
        this.atStart = n.atStart;
        this.eventType = n.eventType;
		    this.queries = n.queries
        this.childtype = n.childtype;
        this.childvalue = n.childvalue;
        this.eventTypetype = n.eventTypetype;
        this.eventTypevalue = n.eventTypevalue;
        //this.querytype = n.querytype; 

  
       // console.log("childpath thisthing", this.childpath)
        
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

          var childpath;
          //Parse out msg.childpath
          if(this.childtype == "str"){
            childpath = this.childpath
          }
          else if(this.childtype == "msg"){
            var childvalue = this.childvalue;
            childpath = this.msg[childvalue];
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
                console.log("childpath is ", childpath);
                }
            catch(e){
                console.log("ERROR WITH JSONATA");
                    }
          }

          
          if(this.childpath){
            //ref = this.config.fbConnection.fbRef.child(this.childpath  == "msg.childpath" ? this.msg.childpath : this.childpath)  //Decide if we are using our input msg object or the string we were configured with
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
              console.log("query is", query.valType)
              console.log("val is ", query.value)
              switch(query.name){
                case "orderByKey":    
                case "orderByValue":
                case "orderByPriority":
                  ref= ref[query.name]();
                case "orderByChild":
                case "startAt":
                  if(query.valType == "str"){
                    ref = ref.startAt(query.value); 
                  } 
                  else if (query.valType == "msg") {
                    var val = this.msg[query.value]; 
                    ref = ref.startAt(val);
                  }
                  else if(query.valType == "flow"){
                    var val =  this.context().flow.get(query.value);
                    ref = ref.startAt(val);
                    
                  }
                  else if(query.valType == "global"){
                    var val =  this.context().global.get(query.value);
                    ref = ref.startAt(val);
                  }
                  else if(query.valType == "num"){

                    var val = query.value.toString();
                    ref = ref.startAt(val);
                  }
                  else if(query.valType == "json"){ //not valid json .. find valid json to test with
                    try {
                      var val = JSON.stringify(query.value);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    //this.error(RED._("change.errors.invalid-json"));
                    }
                    ref = ref.startAt(val);
                  }
                  else if(query.valType == "date"){ //doesnt work 
                    console.log("in date")
                    var val = Date.now();
                    console.log(query.value);
                    ref = ref.startAt(val);
                  }

                  else if(query.valType == "jsonata"){ //test w/jsonata string
                    try{
                      var val = jsonata(query.value);
                      ref = ref.startAt(val);
                    }
                    catch(e){
                      console.log("ERROR WITH JSONATA");
                    }
                    //value = query.value.evaluate({msg:msg}); //look into evaluate  https://github.com/node-red/node-red/blob/master/nodes/core/logic/15-change.js#L126
                  }
                  break;
                case "endAt":
                  if(query.valType == "str"){
                    ref = ref.endAt(query.value);
                  } 
                  else if (query.valType == "msg") {
                    var val = this.msg[query.value]; 
                    ref = ref.endAt(val);
                  }
                  else if(query.valType == "flow"){
                    var val =  this.context().flow.get(query.value);
                    ref = ref.endAt(val);
                    
                  }
                  else if(query.valType == "global"){
                    var val =  this.context().global.get(query.value);
                    ref = ref.endAt(val);
                  }
                  else if(query.valType == "num"){

                    var val = query.value.toString();
                    ref = ref.endAt(val);
                  }
                  else if(query.valType == "json"){ //not valid json .. find valid json to test with
                    try {
                      var val = JSON.stringify(query.value);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    //this.error(RED._("change.errors.invalid-json"));
                    }
                    ref = ref.endAt(val);
                  }
                  else if(query.valType == "date"){ //doesnt work 
                    console.log("in date")
                    var val = Date.now();
                    console.log(query.value);
                    ref = ref.endAt(val);
                  }

                  else if(query.valType == "jsonata"){ //test w/jsonata string
                    try{
                      var val = jsonata(query.value);
                      ref = ref.endAt(val);
                    }
                    catch(e){
                      console.log("ERROR WITH JSONATA");
                    }
                    //value = query.value.evaluate({msg:msg}); //look into evaluate  https://github.com/node-red/node-red/blob/master/nodes/core/logic/15-change.js#L126
                  }
                  break;
                case "equalTo":
                  if(query.valType == "str"){
                    ref = ref.equalTo(query.value); 
                  }       
                  else if (query.valType == "msg") { 
                    var val = this.msg[query.value]; 
                    ref = ref.equalTo(val);
                  }
                  else if(query.valType == "flow"){
                    var val =  this.context().flow.get(query.value);
                    ref = ref.equalTo(val);
                  }
                  else if(query.valType == "global"){
                    var val =  this.context().global.get(query.value);
                    ref = ref.equalTo(val);
                  }
                  else if(query.valType == "num"){

                    var val = query.value.toString();
                    ref = ref.equalTo(val);
                  }
                  else if(query.valType == "json"){ //not valid json .. find valid json to test with
                    try {
                      var val = JSON.stringify(query.value);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    //this.error(RED._("change.errors.invalid-json"));
                    }
                    ref = ref.equalTo(val);
                  }
                  else if(query.valType == "date"){ //doesnt work 
                    console.log("in date")
                    var val = Date.now();
                    console.log(query.value);
                    ref = ref.equalTo(val);
                  }

                  else if(query.valType == "jsonata"){ //test w/jsonata string
                    try{
                      var val = jsonata(query.value);
                      ref = ref.equalTo(val);
                    }
                    catch(e){
                      console.log("ERROR WITH JSONATA");
                    }
                    //value = query.value.evaluate({msg:msg}); //look into evaluate  https://github.com/node-red/node-red/blob/master/nodes/core/logic/15-change.js#L126
                  }
                  break;  
                case "limitToFirst":
                  if(query.valType == "str"){
                    query.value = parseInt(query.value);
                    ref = ref.limitToFirst(query.value); 
                  }       
                  else if (query.valType == "msg") { 
                    var val = this.msg[query.value]; 
                    val = parseInt(val);
                    ref = ref.limitToFirst(val); //val 
                  }
                  else if(query.valType == "flow"){
                    var val =  this.context().flow.get(query.value);
                    ref = ref.limitToFirst(val);
                    
                  }
                  else if(query.valType == "global"){
                    var val =  this.context().global.get(query.value);
                    ref = ref.limitToFirst(val);
                  }
                  else if(query.valType == "num"){
                    val = parseInt(query.value);
                    ref = ref.limitToFirst(val);
                  }
                   else if(query.valType == "json"){ //not valid json .. find valid json to test with
                    try {
                      var val = JSON.stringify(query.value);
                      val = parseInt(val);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    //this.error(RED._("change.errors.invalid-json"));
                    }
                    ref = ref.limitToFirst(val);
                  }
                  else if(query.valType == "jsonata"){ //test w/jsonata string
                    try{
                      var val = jsonata(query.value);

                      ref = ref.limitToFirst(parseInt(val.evaluate({msg:msg})));
                    }
                    catch(e){
                      console.log("ERROR WITH JSONATA");
                    }
                    //value = query.value.evaluate({msg:msg}); //look into evaluate  https://github.com/node-red/node-red/blob/master/nodes/core/logic/15-change.js#L126
                  }
                  break;
                case "limitToLast":
                  if(query.valType == "str"){
                    query.value = parseInt(query.value);
                    ref = ref.limitToLast(query.value); 
                  }       
                  else if (query.valType == "msg") { 
                    var val = this.msg[query.value]; 
                    val = parseInt(val);
                    ref = ref.limitToLast(val); 
                  }
                  else if(query.valType == "flow"){
                    var val =  this.context().flow.get(query.value);
                    ref = ref.limitToLast(val);
                    
                  }
                  else if(query.valType == "global"){
                    var val =  this.context().global.get(query.value);
                    ref = ref.limitToLast(val);
                  }
                  else if(query.valType == "num"){
                    val = parseInt(query.value);
                    ref = ref.limitToLast(val);
                  }
                  else if(query.valType == "json"){ //not valid json .. find valid json to test with
                    try {
                      var val = JSON.stringify(query.value);
                      val = parseInt(val);
                    } catch(e2) {
                        console.log("not a valid json",e2);
                    //this.error(RED._("change.errors.invalid-json"));
                    }
                    ref = ref.limitToLast(val);
                  }
                  else if(query.valType == "jsonata"){ //test w/jsonata string
                    try{
                      var val = jsonata(query.value);

                      ref = ref.limitToLast(parseInt(val.evaluate({msg:msg})));
                    }
                    catch(e){
                      console.log("ERROR WITH JSONATA");
                    }
                  break;
                  break;
                default:
                  //TODO:
                  break;
              }
          }
          
          //eventtype stuff set in .on("input")
          ref.on(this.eventType == "msg.eventType" ? this.msg.eventType : this.eventType, this.onFBValue, this.onFBError, this);
          //ref.orderbyKey().equalTo("hi").on
          //ref.on("child_added", function(snapshot) {
        
        
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

            if(this.eventTypetype == "msg"){
            
              eventType = msg[this.eventTypevalue];
              console.log("in herrr" ,eventType)

            }
            else if(this.eventTypetype =="flow"){
             
              eventType =  this.context().flow.get(this.eventTypevalue);

            }
            else if(this.eventTypetype =="global"){
              eventType =  this.context().global.get(this.eventTypevalue);
 
            }
            else if(this.eventTypetype =="str"){
              eventType =  this.eventTypevalue

            }
            else {
               
              this.error("Expected \"eventType\" property in msg object", msg)
              return;
            } 
          } 
          else {
            eventType = this.eventType
          }

        //  if(!(eventType in this.validEventTypes)){
        //    this.error("Invalid msg.eventType property \"" + eventType + "\".  Expected one of the following: [\"" + Object.keys(this.validEventTypes).join("\", \"") + "\"].", msg)
        //    return;
        //sas  }

             var childpath
          //Parse out msg.childpath
          if(this.childtype == "str"){
            childpath = this.childpath
            //console.log("childdpath is " ,childpath)
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

          //Parse out msg.childpath
          if(this.childpath == "msg.childpath"){
            if("childpath" in msg){
              childpath = msg.childpath
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
