module.exports = function(RED) {
    'use strict';
    var Firebase = require('firebase');

    function FirebaseCreateUser(n) {
      RED.nodes.createNode(this, n);

      this.users = n.users;
      this.config = RED.nodes.getNode(n.firebaseconfig);
      this.completeInterval = null;

      this.createUser = function(fbAdmin, email, password, results) {
      
        fbAdmin.auth().createUserWithEmailAndPassword(email, password)
        .catch(function(error,userData) {
    
          var errorCode = error.code;
          var errorMessage = error.message;
          if (errorCode == 'auth/weak-password') {
            this.error('The password is too weak.');
            console.error('The password is too weak.');
          } 
          else if(errorCode == 'auth/email-already-in-use'){
            this.error('There already exists an account with the given email address.');
            console.error('There already exists an account with the given email address.');
          }
          else if(errorCode == 'auth/invalid-email'){
            this.error('The email address is not valid.');
            console.error('The email address is not valid.');
          }
          else if(errorCode == 'auth/operation-not-allowed'){
            this.error('Email/password accounts are not enabled. Enable email/password accounts in the Firebase Console, under the Auth tab');
            console.error('Email/password accounts are not enabled. Enable email/password accounts in the Firebase Console, under the Auth tab');
          }
          else{this.error("error ",error.code)}
            
          results.push({email: email, uid: error});
        }.bind(this));
          
          var user = fbAdmin.auth().currentUser;
          results.push({email: email, info: user});           
      }

      this.on('input', function(msg) {

        if (this.config == null || this.config.firebaseurl == null) {
          // this.send({payload: "Must set Firebase in Create User node first"});
          console.error("Must set Firebase in Create User node first")
          return;
        }

        var users = (msg.users == null ? this.users : msg.users);
        // var fbRef = new Firebase('https://'+this.config.firebaseurl+'.firebaseio.com');

        //Building the results array is done in a dirty way that could be cleaned up with a Promise.loop
        var numUsers = users.length;
        var results = [];

        for (var i = 0; i < users.length; i++) {
          var user = users[i];
          console.log(user);
          var email = String(user.email)
          console.log("userr ",email);
          this.createUser(this.config.fbConnection.fbApp, String(user.email), String(user.password), results);
        }

        clearInterval(this.completeInterval);
        this.completeInterval = setInterval(function(){
          if (results.length == numUsers) {
            clearInterval(this.completeInterval);
            this.send({payload: results});
          }
        }.bind(this), 100);
      });

      this.on('close', function() {
        //Nothing to do here?
      });

    }
    RED.nodes.registerType('firebase.createUser', FirebaseCreateUser);
};
