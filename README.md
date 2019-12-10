node-red-contrib-firebase
=========================

# DANGER WILL ROBINSON!!!

> See https://github.com/deldrid1/node-red-contrib-firebase/issues/28 - unfortunately, this repo is no longer maintained and is known to not work with the latest versions of node-red / Firebase.  Perhaps you can take up the cause - if you are up to the challenge and want to submit a complete PR or a new repo that wants to take this npm package name, please submit a PR or File a Pull Request and I will be happy to review.

<span class="badge-npmversion">[![NPM version](https://img.shields.io/npm/v/node-red-contrib-firebase.svg)](https://npmjs.org/package/node-red-contrib-firebase "View this project on NPM")</span> <span class="badge-npmdownloads">[![NPM downloads](https://img.shields.io/npm/dm/node-red-contrib-firebase.svg)](https://npmjs.org/package/node-red-contrib-firebase "View this project on NPM")</span>

[node-red](http://nodered.org) [nodes](http://nodered.org/docs/creating-nodes/) for interacting with [Firebase](https://www.firebase.com/).

The goal of this project is to provide an elegant GUI that allows you to interact with your Firebase data using Node-Red.

As a side benefit, these nodes should be a natural complement to the data explorer interface offered by the Firebase Forge and a faster/easier to use tool than diving straight into the programming libraries offered for all of the [Firebase supported platforms](https://www.firebase.com/docs/).


# Install

Run the following command after you have done a global install of Node-RED (as described at <http://nodered.org/docs/getting-started/installation.html>)

	sudo npm install -g node-red-contrib-firebase

## Manual Installation
##### The following instructions assume a standard installation of Node-Red.  Please adjust directories accordingly if a non-standard installation is used.  

##### The Node-Red _user directory_ is printed to the Terminal whenever Node-Red is launched.

##### Windows users will need to replace "$HOME" with "%HOMEPATH%" and replace forwardslashes with backslashes.

To manually install :

1. Download this repository (via git clone, as a .zip, etc.)

2. Launch your favorite Terminal / Command Prompt

3. Create a `nodes` folder in the Node-Red _user directory_.  
_Don't worry if you see a `cannot create directory, File exists` error - that simply means this directory has already been created._

		mkdir $HOME/.node-red/nodes

4. cd into the `.node-red/nodes` user directory of Node-RED

		cd $HOME/.node-red/nodes

5. Copy the `node-red-contrib-firebase` folder into the `.node-red/nodes` directory.  The final directory structure should be `$HOME/.node-red/nodes/node-red-contrib-firebase/`

		cp -r $HOME/Downloads/node-red-contrib-firebase/ ./node-red-contrib-firebase/

6. cd into the `node-red-contrib-firebase` folder

		cd node-red-contrib-firebase

7. Install the required dependencies

		npm install

# Usage

To use the nodes, launch Node-RED (see <http://nodered.org/docs/getting-started/running.html> for help getting started).

The firebase nodes will appear in their own "firebase" catagory on the Node-Red pallet. Drag and drop any node onto the canvas and configure as you would any other node-red node.  Node specific configuration information for each node is included in the info pane in Node-Red.

# Updates
the project uses Semantic Versioning so hopefully no big surprises.

Unfortunately, Node-RED is a bit "stickier" than a traditional node.js app.  If you find that things are acting strangely after updating to a new version, dragging a fresh node onto the workspace from the palette (potentially with fresh config nodes) should clear it up.

# Example Application
If you are brand new to Node-Red, one simple way to get started is to use an existing flow.

- Start by copying the following to your clipboard

```json
[{"id":"d42f4c8f.2bd0b","type":"debug","name":"","active":true,"console":"false","complete":"true","x":377,"y":753,"z":"6fed67fe.901298","wires":[]},{"id":"26e83f77.d917c","type":"catch","name":"","x":231,"y":753,"z":"6fed67fe.901298","wires":[["d42f4c8f.2bd0b"]]},{"id":"621022ff.9defdc","type":"debug","name":"","active":true,"console":"false","complete":"payload","x":570,"y":593,"z":"6fed67fe.901298","wires":[]},{"id":"8d94ee64.726b1","type":"comment","name":"firebase.once() example flow","info":"This flow is the same as the\nfirebase.on() example flow, \nexcept that it uses \nfirebase.once(\"value\") to query Firebase\nin the middle of a flow and return a \nresponse synchronously (as opposed to \nstarting a flow whenever the firebase.on()\nevent is triggered).\n\n\nThe inject node begins the flow\nevery 5 seconds and the debug node logs \nthe weather in San Francisco, CA.","x":120.5,"y":557,"z":"6fed67fe.901298","wires":[]},{"id":"68921ac1.976de4","type":"firebase.once","name":"","firebaseconfig":"","childpath":"sanfrancisco","eventType":"value","queries":[],"x":345,"y":593,"z":"6fed67fe.901298","wires":[["621022ff.9defdc"]]},{"id":"1af0fa3.fe50f06","type":"inject","name":"","topic":"","payload":"","payloadType":"date","repeat":"5","crontab":"","once":false,"x":127,"y":593,"z":"6fed67fe.901298","wires":[["68921ac1.976de4"]]},{"id":"aff728f3.5008d8","type":"firebase modify","name":"","firebaseconfig":"","childpath":"myHomeTown","method":"set","value":"msg.payload","priority":"","x":518,"y":699,"z":"6fed67fe.901298","wires":[]},{"id":"2698847d.d9677c","type":"inject","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":true,"x":125,"y":699,"z":"6fed67fe.901298","wires":[["55b9be5e.aa464"]]},{"id":"55b9be5e.aa464","type":"change","name":"","rules":[{"t":"set","p":"payload","to":"my weather station data..."}],"action":"","property":"","from":"","to":"","reg":false,"x":304,"y":699,"z":"6fed67fe.901298","wires":[["aff728f3.5008d8"]]},{"id":"761c3f4a.89e3c","type":"comment","name":"firebase modify example flow","info":"This flow attempts to set data at the \nfirebase location.  \n\nUnfortunately, the open data set firebase\nwe are using has security rules in place\nand we are unauthorized!  \n\nThe set node will fail and generate a \nNode-Red error.  The catch node will \nreceive the message that caused this \nerror and log it to the debug tab.\n\nThis flow is fired once at Deploy time\nand when Node-Red is first started up.\nYou can also click the button on the \ninject node to fire it whenever you like.","x":120.5,"y":662,"z":"6fed67fe.901298","wires":[]},{"id":"7f9d00bd.8063","type":"firebase.on","name":"","firebaseconfig":"","childpath":"/nashville","atStart":true,"eventType":"value","queries":[],"x":146,"y":482,"z":"6fed67fe.901298","wires":[["e3f4c139.1c0b4"]]},{"id":"e3f4c139.1c0b4","type":"debug","name":"","active":true,"console":"false","complete":"payload","x":344,"y":482,"z":"6fed67fe.901298","wires":[]},{"id":"cdf350cb.320cb","type":"comment","name":"firebase.on() example flow","info":"This flow provides a simple example which\nconnects to the firebase \n[weather](https://publicdata-weather.firebaseio.com/)\n[open data set](https://www.firebase.com/docs/open-data/).\n\nFirebase.on(\"value\") events are fired\nwhenever the weather changes in \nNashville, TN and sent to the debug node.\n\nYou can view the data in the debug tab\nto the right.","x":113,"y":444,"z":"6fed67fe.901298","wires":[]},{"id":"2f20c042.d0df4","type":"comment","name":"-------------------CLICK ME AND READ THE INFO PANE-------------------","info":"Before clicking the Deploy button,\nYou need to configure login credentials \nfor each node with a Red Triangle (all of \nthe Firebase nodes)\n\nYou can add new credentials by double \nclicking on any firebase node and \nclicking on the pencil icon in the top \nright corner of the edit dialog box. \nOnce you have created a set of credentials\nthey will be available in the drop down\nbox.\n\nFor this example, you will want to set\nFirebase to \"publicdata-weather\" \n(without the quotes) and Auth Type to \nNone.","x":245.5,"y":384,"z":"6fed67fe.901298","wires":[]}]
```
- [Launch Node-Red](http://nodered.org/docs/getting-started/running.html) and open the web user interface (Located at [http://127.0.0.1:1880](http://127.0.0.1:1880) by default).

- Click the menu drop down in the top right corner and select Import -> Clipboard.

- Paste the contents of your clipboard in and click "OK".

- Click in the palette to place the nodes.

- You now need to configure login credentials for each node with a Red Triangle.  You can add new credentials by double clicking on any firebase node and clicking on the pencil icon in the top right corner of the edit dialog box. Once you have created a set of credentials they will be available in the drop down box for use in other nodes.

- Press the Deploy Button in the top right corner and begin experimenting!

## Potential Node-Red Installation Issues on Windows

For Node-Red installations on Windows using Node.JS v0.12, you may run into missing compiler dependencies from npm and see MSBUILD errors.  Installing [Microsoft Visual Studio Community](https://www.visualstudio.com/en-us/visual-studio-homepage-vs.aspx) should fix this issue.

## Node.JS on Windows behind a Corporate Proxy Server

If you are using Node.JS on Windows behind a corporate proxy server, you will likely run into issues with
node programs and npm.  Run the following commands to inform node of your proxy settings (modify the values to fit your proxy setup):

    set HTTP_PROXY=http://myproxy.myproxydomain.com:port
    set HTTPS_PROXY=http://myproxy.myproxydomain.com:port
    npm config set proxy http://myproxy.myproxydomain.com:port
    npm config set https-proxy http://myproxy.myproxydomain.com:port

If authentication is required by your proxy, you may need to use the following syntax:

    set HTTP_PROXY=http://domain%5Cuser:password@myproxy.myproxydomain.com:port
    set HTTPS_PROXY=http://domain%5Cuser:password@myproxy.myproxydomain.com:port
    npm config set proxy http://domain%5Cuser:password@myproxy.myproxydomain.com:port
    npm config set https-proxy http://domain%5Cuser:password@myproxy.myproxydomain.com:port

To undo these changes for use outside of a proxied environment run

    set HTTP_PROXY=
    set HTTPS_PROXY=
    npm config delete proxy
    npm config delete https-proxy

# Feedback and Support
For feedback or support on the Firebase Nodes, please submit issues to the [Github issue tracker](https://github.com/deldrid1/node-red-contrib-firebase/issues).

For more information, feedback, or community support on Node-Red, see the [Node-Red Website](http://nodered.org/), [Google groups forum](https://groups.google.com/forum/#!forum/node-red), and [Github Repository](https://www.github.com/node-red/node-red).

# //TODO: List
* All of the ones scattered throughout the code

* testFlows.json to provide good unit testing coverage

* Code cleanup and commenting (using jsDoc?)

* Make some errors "sticky" so we don't report inappropriate status in case the page is loaded after initial deploy as the errors could be missed later and make debugging flows difficult (need to come up with a list of what is/isn't recoverable and under what conditions...)

* Add support for remaining Firebase Authentication strategies including facebook, twitter, GitHub and Google. (the Twitter Node likely should provide good inspiration for how to do this)

* Expose more of the Firebase API and add nodes for creating users, updating passwords, etc.?
