/*
	Copyright 2017 Renato Cortinovis

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

/*
	This file includes a slightly modified implementation of the Jenks Natural Breaks Optimization algorithm, for which a number of very similar implementations exist
	on the Internet, likely ported from a common initial Fortran version.
	For example: 
	classybrew, Copyright (c) 2015 Joshua Tanner, MIT licence,
	geostat, classification library released by Simon Georget under MIT license in 2013, who
	in turn cites a previous implementation by Doug Curl, etc.
*/

/*
Discoverer - Version 4.0

This Chrome extension provides two different integrated functionalities:

    (1) if activated from Google pages, it transparently replicates the keywords search on the Learning Registry, usually identifying plenty of educational resources, that are displayed with some important descriptive metadata;
	(2) if activated while exploring (the home page of) an educational resource, it attempts to find  other similar educational resources, again by interacting with the Learning Registry REST services.

Similar resources are identified according to a novel metric, based on the number of educational alignments they have in common.

Note: this is a proof-of-concept prototype. Please send comments to renato.cortinovis (open.ac.uk)

Full documentation with screenshots available on GitHub
*/


chrome.runtime.sendMessage({action: 'getData'}, function(response) { 
				snackBar();
				organize(response.data, response.scores, response.expResTitle);
});
const maxNumClasses=3;

/* Testing the file autonomously - different format from OpenNode, icons.
Nptes: comment out sendMessage, use allow external origin extension
window.onload =  function() {testExtendedMetadataDisplay();};
function testExtendedMetadataDisplay(){
	var scores = [9,8,3,1]; 
	var resources = [
		"https://www.tes.com/teaching-resource/physics-revision-game-6426683",
		"http://www.shodor.org/interactivate/activities/AlgebraQuiz/",
		"http://nlvm.usu.edu/en/nav/frames_asid_324_g_3_t_2.html",
		"https://www.tes.com/teaching-resource/physics-revision-game-6426683"
	]; 

	expResTitle = "faked expanded resource";
	organize (resources, scores, expResTitle);
}
*/

/* testing the file autonomously - Jenks
function testOrganize(){
	//var scores = [9,9,9,5,5,4,4,4,3,3,1,1,1,1]; 
	//var resources = ["r0","r1","r2","r3","r4","r5","r6","r7","r8","r9","r10","r11","r12","r13"];
	//var scores = [9,9,9,5,5,4,4,4,3,1,1,1,1]; 
	//var resources = ["r0","r1","r2","r3","r4","r5","r6","r7","r8","r10","r11","r12","r13"];
	var scores = [9,9,9,6,5,5,5,4]; 
	var resources = ["r0","r1","r2","r3","r4","r5","r6","r7"];
	organize (resources, scores);
}
*/

function organize (resources, scores, expResTitle){
	// resources: ["URLres1", "URLres2"...] (unique resources)
	// scores: [noccurrURLres1, noccurrURLres1...] (ex: [5, 5, 3...])
	// console.log(resources);
	// console.log(scores);

	var breaks = classifyJenks(scores);
	// breaks: [i1, i2, i3...] -> [i1, i2], (i2, i3]... con i1<i2<i3....
	breaks[0]--; // to force inclusion of the resources with lower similarity
	// console.log("breaks: "+breaks);

	// M: identify resources: 13 per similarity class (strongly similar 2, average 1, minimum 0).
	var resToBeDisplayed = [];
	var resOutIndex = 0; // index of output structure
	var cursorIn = 0; // to scan the array of resources
	var similClass; var MaxResPerClass = 13; // to be customized with settings popup
	for (similClass=breaks.length - 2; similClass >= 0; similClass--){
		var resPerClass = 0;
		while (scores[cursorIn] > breaks[similClass] && scores[cursorIn] <= breaks[similClass + 1]
				&& cursorIn < resources.length
				&& resPerClass < MaxResPerClass) { 
					resToBeDisplayed[resOutIndex] = {};
					resToBeDisplayed[resOutIndex].url=resources[cursorIn];
					resToBeDisplayed[resOutIndex].simil=scores[cursorIn];
					resToBeDisplayed[resOutIndex].similClass=similClass;
					cursorIn++; resOutIndex++; resPerClass++;
		}
		if (similClass != 0) {
			while (scores[cursorIn] > breaks[similClass] && scores[cursorIn] <= breaks[similClass + 1]){
				cursorIn++;
			}
		}
	}
	// console.log(resToBeDisplayed);
	display(resToBeDisplayed, resources.length); // array of objects (url, simil, similClass)
}

function display(resources, total){
	prepareHistoryPanel();
	
	var NumRes = document.getElementById("NumRes");
		NumRes.innerHTML = total;

	var expandedRes = getURLParameter('expandedRes');
		document.getElementById("expandedRes").innerHTML = expandedRes;

	var EXPWINcontainer = document.getElementById("EXPWINcontainer");
	var div = EXPWINcontainer;
	var resPerClass = 0;
	var MaxResPerClass = 3; // parameter to be customized with settings popup
	var previousClass = -1 // to force a change of class
	for (var cursor = 0; cursor < resources.length; cursor++){
		var res = resources[cursor];
		 if (previousClass != res.similClass) {
			// A: new class
			resPerClass = 0; // reset
			previousClass=res.similClass;
			
			var simClassPanel = document.createElement("DIV"); // to contain all resources for this  class
			simClassPanel.className="simClassPanel";
			
			var simClassTitle = document.createElement("p");
			simClassTitle.className="simClassTitle";
			simClassTitle.innerHTML="Resources with "+similClassW(res.similClass) + " similarity:   ";
			var icn = document.createElement("IMG");
			icn.setAttribute("src", similClassImage(res.similClass));
			icn.className = "simClassIcon";
			simClassTitle.appendChild(icn);
			
			simClassPanel.appendChild(simClassTitle);
			EXPWINcontainer.appendChild(simClassPanel);
			div=simClassPanel; // next resources in this class section
		 }
		 if (resPerClass == MaxResPerClass) {
			//M: create section for hidden resources
			var btn =  document.createElement("button");
			btn.innerHTML = " Additional resources with " + similClassW(res.similClass) + " similarity: ";
			btn.className = "accordion";
			 
			var hdnDiv = document.createElement("DIV");
			hdnDiv.className = "hdnPanel";
			
			div.appendChild(btn);
			div.appendChild(hdnDiv);
			div = hdnDiv; // next resources in hidden section
		 }
		var resSnippet = document.createElement('DIV'); resSnippet.className = "resSnippet";
		div.appendChild(resSnippet);

		var url = "https://node02.public.learningregistry.net/obtain?request_id=" + res.url;

		$.getJSON(url, createBuildSnippet(res, resSnippet)); // via closure
/*		testing: (I don't request any data, and I call directly the snippet builder)
		createBuildSnippet(res, div)("pippo"); */
		resPerClass++;
	}
	
	/* Toggle between adding and removing the "active" and "show" classes */
	var acc = document.getElementsByClassName("accordion");
	var i;
	for (i = 0; i < acc.length; i++) {
		acc[i].onclick = function(){
			this.classList.toggle("active"); // add backgr color to the current button when its belonging panel is open.
			this.nextElementSibling.classList.toggle("show"); // open the related accordion panel
		}
	}
}

/* metadata to be displayed, in this order: */
var metadata = [["Name", "name"],
				["Publisher", "publisher"],
				["Author", "author"],
				["Description", "description"],
				["Audience", "audience"],
				["Grades", "grades"],
				["Learning resource type", "learningResourceType"],
				["Interactivity type", "interactivityType"],
				["Educational role", "educationalRole"],
				["Age range", "typicalAgeRange"],
				["Time required", "timeRequired"],
				["Use rights", "useRightsUrl"],
				["Licence", "licence"],
				["Access rights", "accessRights"]
				];
function createBuildSnippet(resData, resSnippet){
	return  function(res){
		// console.log(res);
		var resourceMetadata = extractMetadata(res); // independent of services and formats
		// console.log (resourceMetadata);
		if (!jQuery.isEmptyObject(resourceMetadata)) {
			// A: metadata concerning this resource available
			var resHeader = document.createElement('p');
			resHeader.className = "resHeader";

			var thumbNail = document.createElement("IMG");
			thumbNail.className = "thumbNail";
			resHeader.appendChild(thumbNail);

			if (resourceMetadata.thumbnailUrl) {
				// A: there is a specific thumbnail - easy
				thumbNail.setAttribute("src", resourceMetadata.thumbnailUrl);
			} else {
				// call API search to get _id, then get icon from screencap
				var surl = "http://search.learningregistry.net/api/search?api_key=e01ce26dae12d45adf53de5659c69fdea691c3882ebfe57b290b400cfe80e6a0&q=&facet_filters%5Burl%5D%5B%5D=" + resourceMetadata.url;
				$.getJSON(surl, updateThumbnailURL(thumbNail));
			}
			
			var a = document.createElement('a');
				a.setAttribute('href', resData.url.toString());
				a.setAttribute('target', '_blank');
				a.className = "resTitle";
				a.onclick = logClosure({
					action: "visit",
					url: resData.url.toString(),
					param: resourceMetadata["name"],
					date: Date()
			}); // does not cancel the navigation event with return false
			// a.innerHTML = resData.url.toString();
			a.innerHTML = resourceMetadata["name"];
			resHeader.appendChild(a);
			
			var x = document.createElement("IMG");
			x.setAttribute("src", similClassImage(resData.similClass));
			x.className = "simClassIcon";
			resHeader.appendChild(x);
			
			resSnippet.appendChild(resHeader);

			var resMetadata = document.createElement("div"); resMetadata.className = "resMetadata";
			for (var i = 1; i < metadata.length; i++){ // starts after "Name"
				if (resourceMetadata[metadata[i][1]]){
					var nodeL = document.createTextNode(metadata[i][0] + ": ");
					var nodeR = document.createTextNode(resourceMetadata[metadata[i][1]]);
					var snLeft = document.createElement('span'); snLeft.appendChild(nodeL);
						snLeft.className = "snLeft";
					var snRight = document.createElement('span'); snRight.appendChild(nodeR);
						snRight.className = "snRight";
					var myRow = document.createElement('DIV'); myRow.className = "myRow";
					myRow.appendChild(snLeft); myRow.appendChild(snRight);
					resMetadata.appendChild(myRow);
					resSnippet.appendChild(resMetadata);
				}
			}

		} else { 
			// A: metadata concerning this resource not available
			var resHeader = document.createElement('p'); resHeader.className = "resHeader";
			var a = document.createElement('a');
				a.setAttribute('href', resData.url.toString());
				a.setAttribute('target', '_blank');
				a.onclick = logClosure({
					action: "visit",
					param: "title not available",
					url: resData.url.toString(),
					date: Date()
				}); // does not cancel the navigation event with return false
				a.innerHTML = resData.url.toString();
				
				var x = document.createElement("IMG");
				x.setAttribute("src", similClassImage(resData.similClass));
				x.className = "simClassIcon";
				resHeader.appendChild(x);
				
				resHeader.appendChild(a);
				resSnippet.appendChild(resHeader);
		}
	}
}

/* 
   M: function that updates the url in the icon of the resources
   It is returned as a closure, because it needs to know which
   thumbNail to update - all instances are launched asyncronously
*/
function updateThumbnailURL(thumbNail){
	return  function(res){
		console.log("res",res); console.log("_id",res.hits.hits[0]._id);
		var _id = res.hits.hits[0]._id;
		var thumbNailUrl = "http://search.learningregistry.net/webcap/" +
						_id + "/48/screencap.jpg";
		thumbNail.setAttribute("src", thumbNailUrl);
	}
}
/* this one works fine for the Search Service, but few metadata are available
function extractMetadata(res){
	var resourceMetadata = {};
	if (res.hits.total == 1){
		//A: metadata available
		resourceMetadata["_id"]  = res.hits.hits[0]._id;
		resourceMetadata["title"] = res.hits.hits[0]._source["title"];
		for (var i = 0; i < metadata.length; i++){
			resourceMetadata[metadata[i][1]] = res.hits.hits[0]._source[metadata[i][1]];
		}
		return (resourceMetadata);
	}
} */

function extractMetadata(resData){
	var resourceMetadata = {};
	if (resData.documents.length != 0){
		//A: metadata available
		var payload = getLRMIpayload(resData);
		var info={};
		// M: process first the envelope and get some useful metadata
		if ('identity' in payload) {
		$.each(payload.identity, function(key, val){
			// console.log ("checking: " + key + " " + val);
			switch(key.toLowerCase()){
				case "curator":
					info[key]=getValue(val);
					break;
				case "submitter":
					info[key]=getValue(val);
					break;
				case "submitter_type":
					info[key]=getValue(val);
					break;
				case "contributor":
					info[key]=extractValuesFromArrOfObjs(val,"name").join(", ");
					break;
			}
		});
	}
	// M: process now the LRMI data in resource_data

	if (payload.resource_data.items) {
		// because sometimes resource_data are incapsulated in a property item (e.g. http://www.einstein.caltech.edu/)
		payload.resource_data=payload.resource_data.items[0].properties;
	}

	if (typeof (payload.resource_data) == "string") {
		// to take care of resources from GoOpen node
		payload.resource_data=JSON.parse(payload.resource_data);
	} 

	$.each(payload.resource_data, function(key, val){
		// console.log ("checking: " + key + " " + val);
		switch(key){
			case "description":
				info[key]=getValue(val);
				break;
			case "publisher":
				info[key]=extractValuesFromArrOfObjs(val,"name").join(", ");
				break;
			case "author":
				info[key]= extractValuesFromArrOfObjs(val,"name").join(", ");
				break;
			case "typicalAgeRange":
				info[key]=getValue(val);
				break;
			case "grades":
				info[key]=getValue(val);
				break;
			case "learningResourceType":
				info[key]=getValue(val);
				break;
			case "audience":
				info[key]=extractValuesFromArrOfObjs(val,"educationalRole").join(", ");
				break;
			case "educationalRole":
				info[key]=getValue(val);
				break;
			case "interactivityType":
				info[key]=getValue(val);
				break;
			case "name":
				info[key]=getValue(val);
				break;
			case "timeRequired":
				info[key]=getValue(val);
				break;
			case "useRightsUrl":
				info[key]=getValue(val);
				break;
			case "licence":
				info[key]=getValue(val);
				break;
			case "accessRights":
				info[key]=getValue(val);
				break;
			case "thumbnailUrl":
				info[key]=getValue(val);
				break;
				 
// M: for testing:
			case "url":
				info[key]=getValue(val);
				break;
		}
	});
	return info;
	}
}

function getValue(prop) {
    if (prop instanceof Array) return (prop.join(", "));
    else if (typeof prop == "object") return JSON.stringify(prop);
	else return prop;
}

function extractValuesFromArrOfObjs (arr,field){
	var info=[];
	for (var i=0;i<arr.length;i++){
		info.push(arr[i][field])
	}
	return info;
}



function getLRMIpayload(resData) {
		//M: process envelope
		for (var i=0; i<resData.documents[0].document.length; i++){
			if (resData.documents[0].document[i].payload_placement.toLowerCase()=="inline"){
				var schemas=[];
				schemas=resData.documents[0].document[i].payload_schema.map(function(e){return e.toLowerCase()});
				if (schemas.indexOf("lrmi") != -1){
					return(resData.documents[0].document[i]);
					break; // just process the first (more recent?) useful document
				} else if (schemas.indexOf("nsdl_dc") != -1){
					console.log("Payload not yet handled for "+resURL+": "+schemas.toString())
				} else if (schemas.indexOf("lom") != -1) {
					console.log("Payload not yet handled for "+resURL+": "+schemas.toString())
				} else if (schemas.indexOf("comm_para 1.0") != -1) {
					console.log("Payload not yet handled for "+resURL+": "+schemas.toString())
				}
			}
		}
}



function similClassW (similClass){
// M: map numeric similarity class to string
	switch (similClass) {
		case 0: return ("Minimum");
		break;
		case 1: return ("Medium");
		break;
		case 2: return ("Maximum");
	}
}

function similClassImage (similClass){
// M: selects the right icon for the given class of similarity
	return ("icones/" + similClassW(similClass) + "SimIcon128.png");
}


function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function logClosure(action){
	return function log(){
		chrome.storage.local.get("log", function(obj){
				var tmp = (('log' in obj) ? obj.log : []);
				tmp.push(action);
				chrome.storage.local.set({"log" : tmp});
				// console.log(tmp);
		}
	)}
}

function prepareHistoryPanel(){
	chrome.storage.local.get("log",
		function(obj){
			var resMetadata = document.createElement("div");
			for(var i = 0; i < obj.log.length; i++){
				// s = s + obj.log[i]["action"] + ": " + obj.log[i]["param"] +"\n"; alert(s);
				// console.log(obj);
				var action = obj.log[i]["action"];
				var nodeL = document.createTextNode(action + ": ");

				if (action == "visit"){
					var nodeR = document.createElement('a');
					nodeR.setAttribute('href', obj.log[i]["url"]);
					nodeR.setAttribute('target', '_blank');
					nodeR.innerHTML = obj.log[i]["param"];
				} else {
					var nodeR = document.createTextNode(obj.log[i]["param"] + 
							" (" + obj.log[i]["url"] + ")");
				}
				var snRight = document.createElement('span');
				snRight.appendChild(nodeR); snRight.className = "snRight";
				var snLeft = document.createElement('span'); snLeft.appendChild(nodeL);
					snLeft.className = "snLeft";
				
				var myRow = document.createElement('DIV'); myRow.className = "myRow";
				myRow.appendChild(snLeft); myRow.appendChild(snRight);
				resMetadata.appendChild(myRow);
			}
			var hcont = document.getElementById("history-content");
			hcont.appendChild(resMetadata);
		});
}

function snackBar() {
    // Get the snackbar DIV
    var x = document.getElementById("snackbar");

    // Add the "show" class to DIV
    x.className = "show";

    // After 3 seconds, remove the show class from DIV
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}


function numClasses (series){
	var distinct=[];
	for(var i=0; i<series.length; i++){
		if (!(distinct.includes(series[i]))) {
			distinct.push(series[i]);
		}
	}
	if (distinct.length<maxNumClasses) return distinct.length;
	else return maxNumClasses;
}

 function classifyJenks(series) {
	numClasses=numClasses(series);
	var mat1 = [];
	for ( var x = 0, xl = series.length + 1; x < xl; x++) {
		var temp = []
		for ( var j = 0, jl = numClasses + 1; j < jl; j++) {
			temp.push(0)
		}
		mat1.push(temp)
	}

	var mat2 = []
	for ( var i = 0, il = series.length + 1; i < il; i++) {
		var temp2 = []
		for ( var c = 0, cl = numClasses + 1; c < cl; c++) {
			temp2.push(0)
		}
		mat2.push(temp2)
	}

	for ( var y = 1, yl = numClasses + 1; y < yl; y++) {
		mat1[0][y] = 1
		mat2[0][y] = 0
		for ( var t = 1, tl = series.length + 1; t < tl; t++) {
			mat2[t][y] = Infinity
		}
		var v = 0.0
	}

	for ( var l = 2, ll = series.length + 1; l < ll; l++) {
		var s1 = 0.0
		var s2 = 0.0
		var w = 0.0
		for ( var m = 1, ml = l + 1; m < ml; m++) {
			var i3 = l - m + 1
			var val = parseFloat(series[i3 - 1])
			s2 += val * val
			s1 += val
			w += 1
			v = s2 - (s1 * s1) / w
			var i4 = i3 - 1
			if (i4 != 0) {
				for ( var p = 2, pl = numClasses + 1; p < pl; p++) {
					if (mat2[l][p] >= (v + mat2[i4][p - 1])) {
						mat1[l][p] = i3
						mat2[l][p] = v + mat2[i4][p - 1]
					}
				}
			}
		}
		mat1[l][1] = 1
		mat2[l][1] = v
	}

	var k = series.length
	var kclass = []

	for (i = 0, il = numClasses + 1; i < il; i++) {
		kclass.push(0)
	}

	kclass[numClasses] = parseFloat(series[series.length - 1])

	kclass[0] = parseFloat(series[0])
	var countNum = numClasses
	while (countNum >= 2) {
		var id = parseInt((mat1[k][countNum]) - 2)
		kclass[countNum - 1] = series[id]
		k = parseInt((mat1[k][countNum] - 1))

		countNum -= 1
	}

	if (kclass[0] == kclass[1]) {
		kclass[0] = 0
	}

	var range = kclass;
	range.sort(function (a, b) { return a-b })

	return range; //array of breaks
}
