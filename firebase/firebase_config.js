//All references to a Firebase share the same authentication status,
//so if you call new Firebase() twice and call any authentication method
//on one of them, they will both be authenticated.


module.exports = function (RED) {
    'use strict';
    var Firebase = require('firebase'); //for new version
    var auth = require('firebase/auth');
    var admin = require('firebase-admin');
    //var serviceAccount = require("./modules/testing-19109-firebase-adminsdk-n0bx5-096122e57c.json");
    //var serviceAccount = "C://testing-19109-firebase-adminsdk-n0bx5-096122e57c.json";


//C:\Users\c9924310\AppData\Roaming\npm\node_modules\node-red-contrib-firebase\firebase

    var FirebaseTokenGenerator = require("firebase-token-generator");
    var events = require("events");
    var path = require("path");
    var https = require("follow-redirects").https;
    var urllib = require("url");
   
    function generateUID(){
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { //Generates a random RequestID
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
          return v.toString(16);
      });
    }

//****261 commented out for now

    // Firebase Full Authentication Error Listing - https://www.firebase.com/docs/web/guide/user-auth.html#section-full-error
    // AUTHENTICATION_DISABLED  The requested authentication provider is disabled for this Firebase.
    // EMAIL_TAKEN  The new user account cannot be created because the specified email address is already in use.
    // INVALID_ARGUMENTS  The specified credentials are malformed or incomplete. Please refer to the error message, error details, and Firebase documentation for the required arguments for authenticating with this provider.
    // INVALID_CONFIGURATION  The requested authentication provider is misconfigured, and the request cannot complete. Please confirm that the provider's client ID and secret are correct in your Firebase Dashboard and the app is properly set up on the provider's website.
    // INVALID_CREDENTIALS  The specified authentication credentials are invalid. This may occur when credentials are malformed or expired.
    // INVALID_EMAIL  The specified email is not a valid email.
    // INVALID_ORIGIN A security error occurred while processing the authentication request. The web origin for the request is not in your list of approved request origins. To approve this origin, visit the Login & Auth tab in your Firebase dashboard.
    // INVALID_PASSWORD The specified user account password is incorrect.
    // INVALID_PROVIDER The requested authentication provider does not exist. Please consult the Firebase authentication documentation for a list of supported providers.
    // INVALID_TOKEN  The specified authentication token is invalid. This can occur when the token is malformed, expired, or the Firebase secret that was used to generate it has been revoked.
    // INVALID_USER The specified user account does not exist.
    // NETWORK_ERROR  An error occurred while attempting to contact the authentication server.
    // PROVIDER_ERROR A third-party provider error occurred. Please refer to the error message and error details for more information.
    // TRANSPORT_UNAVAILABLE  The requested login method is not available in the user's browser environment. Popups are not available in Chrome for iOS, iOS Preview Panes, or local, file:// URLs. Redirects are not available in PhoneGap / Cordova, or local, file:// URLs.
    // UNKNOWN_ERROR  An unknown error occurred. Please refer to the error message and error details for more information.
    // USER_CANCELLED The current authentication request was cancelled by the user.
    // USER_DENIED  The user did not authorize the application. This error can occur when the user has cancelled an OAuth authentication request.

    //TODO: Where is the full Firebase Error listing for .set(), etc.?

    //connectionPool is responsible for managing Firebase Connections, Authentication, etc.
    //connectionPool emits the following events:
      //initializing
      //connected
      //disconnected
      //authorized
      //unauthorized
      //error //TODO: need to wrap everything in a try/catch to make sure we don't ever crash node-red
      //closed
    var connectionPool = function(){  //TODO: This could probably be refactored to be a bit simpler now...
      var connections = {}

      return {
        get: function(firebaseurl, configNodeID, api,loginType,list){
          if(!connections[configNodeID]){ //Lazily create a new Firebase Reference if it does not exist
  
            connections[configNodeID] = function(){

              //Private
              var _emitter = new events.EventEmitter();
              var _emit = function(a,b){
                //console.log(firebaseurl + " - emitting " + a)
                
                if(this.lastEvent == a && this.lastEventData == b){
                  //console.log("ignoring duplicate emit event " + a)
                  return
                }

                this.lastEvent = a;
                this.lastEventData = b;

                _emitter.emit(a,b)
              }
            
              var obj = {
                Firebase: Firebase,  //Needed for Firebase.ServerValue.TIMESTAMP...

                firebaseurl: firebaseurl,  //TODO: Some of this data is duplicated...
                api: api,
                //fbRef: new Firebase(firebaseurl, configNodeID), //Including a second argument is a hack which allows us to have multiple auths connected to the same Firebase - see https://github.com/deldrid1/node-red-contrib-firebase/issues/3
                
                fbApp:Firebase.initializeApp({apiKey: api,databaseURL: firebaseurl},configNodeID),

                fbRef: null,

                fbRefAdmin:null,
                fbAdmin:null,
                authData: null, //TODO: Some of this data is duplicated...
                loginType: null,
                secret: null,
                privatekey: null,
                passORuid: null,  //TODO: Probably should clean this up similair to the config node to make it less confusing what is going on...
                uid: null,
                nodeCount: 0,
                lastEvent: "initializing",
                lastEventData: null,
                httpRequests: {},

                
              makeadmin: function(list,firebaseurl){

                  this.list = list;
                  this.firebaseurl = firebaseurl;

                  if(list !=undefined){
                  var project_id = list["project_id"];
                  var private_key = list["private_key"];
                  var client_email = list["client_email"];

                  var fbAdmin = admin.initializeApp({

                    credential: admin.credential.cert({
                    projectId: project_id,
                    clientEmail: client_email,
                    privateKey: private_key
                 }),
                  databaseURL: this.firebaseurl
                },configNodeID + "admin");

                    obj.fbAdmin = fbAdmin;

                }
                
              },  
                on: function(a,b) { _emitter.on(a,b); },
                once: function(a,b) { _emitter.once(a,b); },

                authorize: function(loginType, secret, passORuid, jwtClaims,privatekey,list,firebaseurl,admin,debug){
                  //console.log("Attempting to authorize with loginType="+loginType+" with secret="+secret+" and pass/uid="+passORuid)
                  this.list = list;
                  this.admin = admin;
                  this.debug = debug;
                  this.firebaseurl =firebaseurl

                
                  if(this.loginType && this.authData){
                    this.authData = null
                    
                    this.fbApp.auth().signOut().then(function(){
                      //console.log("signed out successfully");
                    }, function(error){
                       console.log("error signing out");
                    });  

                    //instead of onAuth
                      this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            //console.log("still signed in")

                          }
                          else{
                            console.log("user logged out ")
                          }
                        }); 
                    _emit("unauthorized");
                  }
                  
                  this.loginType = loginType
                  this.secret = secret
                  this.passORuid = passORuid
                  switch (loginType) {
                      case 'none':
                      
                          process.nextTick(function(){
                            _emit("authorized", null)
                          }.bind(this));
                          break;
                      case 'jwt':
                        this.fbApp.auth().signInWithCustomToken(secret)
                         .catch(function(error){
                                _emit("unauthorized");
                                console.log("Error wrong JWT token:", error);
                              });      
                      this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            //var isAnonymous = user.isAnonymous;
                           // console.log("signed in jwt");
                            _emit("authorized",user);

                          }
                        });   
                          break;
                      case 'anonymous':
                          this.fbApp.auth().signInAnonymously()
                          .catch(function(error) {
                          _emit("unauthorized");
                          console.log("error here")
                          var errorCode = error.code;
                          var errorMessage = error.message;
                        });

                           this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            //var isAnonymous = user.isAnonymous;
                            console.log("signed in anonymous");
                            _emit("authorized",user);

                          }
                        });                        
                         break;
                      case 'customGenerated':
                      
                        //call Admin function to make fbAdmin ref
  
                        this.makeadmin(this.list,this.firebaseurl);
   
                            var tokenArgs = {
                              admin: this.admin, 
                              debug: this.debug, 
  
                            };
                          var notAllowed = ["alg","acr","amr","at_hash","aud","auth_time","azp,cnf","c_hash,exp","firebase,iat","iss","jti","nbf","nonce","sub"];              
                           for(var i = 0; i < jwtClaims.length; i++){
                              if(notAllowed.indexOf(jwtClaims[i].key) != -1){ //meaning the key is an input that isnt allowed                      
                                _emit("error","JWT additional claims error. The key specified isnt allowed ");
                                return;
      
                              }
                              tokenArgs[jwtClaims[i].key] = jwtClaims[i].value
                           }
                           

                           
                      this.fbAdmin.auth().createCustomToken(passORuid, tokenArgs)
              
                              .then(function(customToken)
                              {
                                
                                  this.fbApp.auth().signInWithCustomToken(customToken)
                                   .catch(function(error) {
                                    _emit("unauthorized");
                                    console.log("error in token")
                                    var errorCode = error.code;
                                    var errorMessage = error.message;
                                    console.log(error);


                          }); 

                              }.bind(this))
                              .catch(function(error){
                                console.log("Error creating custom token:", error);
                              });

                        this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            user.getToken().then(function(data){
                            });
                            console.log("signed in with custom token");
                            _emit("authorized",user);
                          }
                        }); 
                            //this.fbRef.onAuth(this.onAuth, this);
                            break;
                       case 'admin':
                        process.nextTick(function(){
                            _emit("authorized", null)
                          }.bind(this));
                          break;
                      case 'email':
                                     
                        this.fbApp.auth().signInWithEmailAndPassword(secret, passORuid)
                        .catch(function(error) {
                         // node.warn("blabla")

                          var errorCode = error.code;
                          var errorMessage = error.message;
                          if (errorCode === 'auth/wrong-password') {
                            //  alert('ERROR: Invalid loginType in firebase " + this.firebaseurl + " config - " + this.loginType');
                            
                            } else {
                           //   alert(errorMessage);
                            }
                            console.log(error);
                            _emit("unauthorized");

                          })     
                        //instead of this.fbRef.onAuth(this.onAuth, this);
                        //this.fbApp.onAuth(this.on)

                    
                        this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            //console.log("signed in");
                            _emit("authorized",user);
                          }
                        });                        
                         break;
                      
                      default:
                           console.log("ERROR: Invalid loginType in firebase " + this.firebaseurl + " config - " + this.loginType)
                           this.status({fill:"red", shape:"ring", text:"invalid loginType"})
                           break;

                        
                           
                  }//logintype end 
                }, // end of authorize

                //Note, connected and disconnected can happen without our auth status changing...
                onConnectionStatusChange: function(snap){
                  
                  //var obj = connections[snap.ref().parent().parent().toString()]  //Not the most elegant, but it works
                  if (snap.val() === true) {
                    if(this.lastEvent != "authorized")//TODO: BUG: there is some kind of sequencing bug that can cause connected to be set to true after we have already emitted that authorized is true.  This is patch for that issue but we really should ge tht execution order correct...
                    
                      _emit("connected")
                  } else {
                     
                    _emit("disconnected")
                  }
                },

                //However, it looks like with our current setup auth will get re-emitted after we reconnect.
 /*               onAuth: function(authData){
                  if(authData){
                    _emit("authorized", authData)
                  } else {
                    if(this.authData){
                      var now = new Date()
                      var authExpiration = new Date(this.authData.expires*1000)
                      if(authExpiration.getTime()-10000 <= now.getTime()){  //TODO: Do some research on this, we are subtracting 10 seconds - Firebase gets a little greedy with expirations (perhaps this is because of clock differences and network latencies?)
                        //Auth has expired - need to reauthorize
                        console.log("auth has expired - attempting single shot reauthentication")
                        this.authorize(this.loginType, this.secret, this.passORuid) //Single Shot Reauth attempt
                      }
                    }
                    _emit("unauthorized");
                  }
                  this.authData = authData
                },
*/
                onLoginAuth: function(error, authData) {
                  if (error) {
                    _emit("error", error.code);  //TODO: evaluate being verbose vs. using the error.code...
                  } //else //onAuth handles success conditions
                      //console.log("onLoginAuth Success: Logged into  " + this.firebaseurl + " as " + JSON.stringify(authData))
                },

                close: function(){
                  //console.log("in close function 2")

                  _emit("closed")
                  _emitter.removeAllListeners();  //Makes sure everybody stopped listening to us... //TODO: This may prevent nodes from receiving the "closed" event...

                  //Clean up the Firebase Reference and tear down the connection 
                   if(this.fbAdmin){
                     this.fbAdmin.delete()
                    .then(function() {
                     //console.log("App deleted successfully2");
                    })
                   }    
                   this.fbApp.delete()
                    .then(function() {
                     //console.log("App deleted successfully2");
                    });
                   

                  if(this.loginType){
                     this.fbApp.auth().signOut().then(function(){ 
                    }, function(error){
                       console.log("error signing out2");
                    });
                    this.fbApp.auth().onAuthStateChanged(function(user) {
                          if(user){
                            //var isAnonymous = user.isAnonymous;  
                          }
                          else{
                            //console.log("User not logged in anymore2")
                          }
                    });
                   }
                 // console.log(connections + "afer");
                }//end of close func
              };//end of obj
            
            //create db reference    
              if(loginType == "admin"){

                  
                 obj.makeadmin(list,firebaseurl);
                
                obj.fbRef = obj.fbAdmin.database().ref();

                _emit = _emit.bind(obj);
                _emitter.setMaxListeners(0);  //Suppress Memory Leak warnings, 0 means unlimited listeners
                process.nextTick(function(){
                  _emitter.emit("initializing");  //_emit would suppress this because of the default value...
                

                var connectedRef = this.fbAdmin.database().ref(".info/connected");
                connectedRef.on("value", obj.onConnectionStatusChange, obj);
                

                }.bind(obj))

                return obj;
                                         
              }//end of if

              
                obj.fbRef = obj.fbApp.database().ref();
              
                //Set "this" in our private functions
                _emit = _emit.bind(obj);
                _emitter.setMaxListeners(0);  //Suppress Memory Leak warnings, 0 means unlimited listeners
                process.nextTick(function(){
                  _emitter.emit("initializing");  //_emit would suppress this because of the default value...
                
                
                var connectedRef = this.fbApp.database().ref(".info/connected");
              
                connectedRef.on("value", obj.onConnectionStatusChange, obj);
                

                 //obj.fbRef.child(".info/connected").on("value", obj.onConnectionStatusChange, obj);
                 //sas TODO
                }.bind(obj))

              

              return obj;
            }();
          }

          connections[configNodeID].nodeCount++;

          return connections[configNodeID]
        },

        close: function(configNodeID){
          //console.log("in close 3")
          var obj = connections[configNodeID]

          obj.nodeCount--

          if(obj.nodeCount == 0){
            obj.close()

            delete connections[configNodeID]
            //TODO: BUG: there is not way to do close/kill a connection with the current Firebase Library.  It is a low priority for them but is scheduled for release middle of 2015...    http://stackoverflow.com/questions/27641764/how-to-destroy-firebase-ref-in-node
          }
        }
       
      }
    }();

    function FirebaseConfig(n) {
        RED.nodes.createNode(this, n);

        this.firebaseurl = "https://" + n.firebaseurl + ".firebaseio.com";
        this.api = n.api;

        
        this.loginType = n.loginType;

        
        this.uid = this.credentials.uid;  
        this.secret = this.credentials.secret;
        this.email = this.credentials.email;
        this.password = this.credentials.password;

        this.list = this.credentials.list;

        this.jwtClaims = n.jwt;

        if( (this.email == undefined  && this.loginType == 'email' ) || (this.password == undefined && this.loginType == 'email') ){
          this.error("Email and password required");
          _emit('error',"disconnected")
        }
        
        if((this.list == undefined && this.loginType == 'customGenerated') || (this.list == undefined && this.loginType == 'admin')){
          this.error("Private Key is required to create a token")
          _emit('error',"disconnected")
        }
        if(this.uid == undefined && this.loginType == 'customGenerated'){
          this.error("unique ID is required");
          _emit("disconnected");
        }
        if (this.list != undefined){ //if list is undefined and were in additional claims then throw error
          var data;
          data = JSON.parse(this.list);
          this.list = data;
       }

        this.admin = n.admin;
        this.debug = n.debug;

        
        this.jwtClaims = JSON.parse(this.jwtClaims != undefined ? this.jwtClaims : "[]");

        this.id = generateUID();

        if(this.loginType){ //getting empty logintypes for some reason

         this.fbConnection = connectionPool.get(this.firebaseurl, this.id,this.api,this.loginType,this.list)
       
        this.fbConnection.on("initializing", function(){
          // this.log("initializing to " + this.firebaseurl)
          this.status({fill:"grey", shape:"ring", text:"initializing..."})
        }.bind(this))

      
        this.fbConnection.on("connected", function(){

          switch (this.loginType) {
              case 'none':
              case 'anonymous':
                this.fbConnection.authorize(this.loginType);
                break;
              case 'jwt':  //TODO:
                this.fbConnection.authorize(this.loginType, this.secret);
                break;
              case 'email':

                this.fbConnection.authorize(this.loginType, this.email, this.password);
                break;
              case 'admin':
                this.fbConnection.authorize(this.loginType,null,null,null,null,this.list,this.firebaseurl);
                //this.fbConnection.authorize(null);
                this.status({fill:"green", shape:"ring", text:"connected"})
                break;
              case 'customGenerated':
                this.fbConnection.authorize(this.loginType, this.secret, this.uid, this.jwtClaims,this.privatekey,this.list,this.firebaseurl,this.admin,this.debug);
                break;     
              case 'facebook': //TODO:
                break;
              case 'twitter': //TODO:
                break;
              case 'github': //TODO:
                break;
              case 'google': //TODO:
                break;
              default:
                this.error("Invalid loginType in firebase " + this.firebaseurl + " config - " + this.loginType, {})
                this.status({fill:"red", shape:"ring", text:"invalid loginType"})
                break;
          }
          this.status({fill:"green", shape:"ring", text:"connected"})
        }.bind(this))

        this.fbConnection.on("disconnected", function(){

          this.status({fill:"red", shape:"ring", text:"disconnected"})
        }.bind(this))

        this.fbConnection.on("authorized", function(authData){
  
        }.bind(this))

        this.fbConnection.on("unauthorized", function(){

          this.status({fill:"red", shape:"dot", text:"unauthorized"})
        }.bind(this))

        this.fbConnection.on("error", function(error){

          this.status({fill:"red", shape:"ring", text:error})
          this.error(JSON.stringify(error), error);//TODO: BUG: Config nodes have no where to pass there second error param...
        }.bind(this))

        this.on('close', function() {
          //console.log("in close function")
            this.status({fill: "gray", shape: "dot", text:"connection closed"})
            // We need to unbind our callback, or we'll get duplicate messages when we redeploy
            //console.log(this.id + "thats the id")
            connectionPool.close(this.id)

        });
        //
      }
    }

    RED.nodes.registerType('firebase config', FirebaseConfig, {
      credentials: {
                 
          loginType: {type: 'text'},
          uid: {type: 'text'},
          secret: {type: 'password'},
          email: {type: 'text'},
          password: {type: 'password'},
          list: {type: 'text'},
          
      }
    });
}