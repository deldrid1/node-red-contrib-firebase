module.exports = function(RED) {
    'use strict';

    function FirebaseAuth(n) {
        RED.nodes.createNode(this,n);

        this.config = RED.nodes.getNode(n.firebaseconfig);
        this.name = n.name;
        this.ready = false;

        // Check credentials
        if (!this.config) {
            this.status({fill:"red", shape:"ring", text:"invalid credentials"})
            this.error('You need to setup Firebase credentials!');
            return
        }

        this.fbAuthorized = function(authData){
          // this.log("authorized")
          this.status({fill:"green", shape:"dot", text:"ready"})
          this.send({payload: authData})
        }.bind(this)

        this.fbUnauthorized = function(){
          // this.log("unauthorized")
          this.status({fill:"red", shape:"dot", text:"unauthorized"})
          this.send({payload: null})
        }.bind(this)

        //Register Handlers

        this.config.fbConnection.on("authorized", this.fbAuthorized)
        this.config.fbConnection.on("unauthorized", this.fbUnauthorized)

        if(this.config.fbConnection.authData)
            this.send({payload: this.config.fbConnection.authData})



          this.on('close', function() {
            //Cancel modify request to firebase??
          });

    }
    RED.nodes.registerType("firebase auth", FirebaseAuth);

    RED.httpAdmin.post("/firebase/:id/auth", RED.auth.needsPermission("firebase.write"), function(req,res) {
            var node = RED.nodes.getNode(req.params.id);
            if (node !== null && typeof node !== "undefined" ) {
                node.send({payload: node.config.fbConnection.lastEventData}); //lastEventData contains authData from first deploy
                res.sendStatus(200)
            } else {
                res.send(404);
            }
        });
};
