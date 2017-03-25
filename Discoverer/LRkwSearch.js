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
Discoverer - Version 4.0

This Chrome extension provides two different integrated functionalities:

    (1) if activated from Google pages, it transparently replicates the keywords search on the Learning Registry, usually identifying plenty of educational resources, that are displayed with some important descriptive metadata;
	(2) if activated while exploring (the home page of) an educational resource, it attempts to find  other similar educational resources, again by interacting with the Learning Registry REST services.

Similar resources are identified according to a novel metric, based on the number of educational alignments they have in common.

Note: this is a proof-of-concept prototype. Please send comments to renato.cortinovis (open.ac.uk)

Full documentation with screenshots available on GitHub
*/

document.addEventListener('DOMContentLoaded', function () {
	var qstring = window.location.search.substring(1); // gets the query string from parameters
	snackbar();
	kwSearch(qstring);
});

function kwSearch (qstring){
	var api_key="e01ce26dae12d45adf53de5659c69fdea691c3882ebfe57b290b400cfe80e6a0";
	var url = "https://search.learningregistry.net/api/search?api_key="+
		api_key +
		"&" + qstring +
		"&facet_filters%5Bstandards%5D%5B%5D=e0d16f274fbf84050162cd7e765d30bd&limit=10";
	$.getJSON(url, function (res) {
		displayKwSearchResults(qstring, res)}); 
}

var metadata = [["Publisher","publisher"], ["Description", "description"],
				["Grades","grades"]]; // eliminated ["Title", "title"], 

function displayKwSearchResults(qstring, res){
	var kwords = document.getElementById("kwords");
		kwords.innerHTML = decodeURIComponent(qstring.substring(2));
	
	var NumRes = document.getElementById("NumRes");
		NumRes.innerHTML = res.hits.total;
	
	var clipped = false; 
	if (res.hits.total > 10){
		clipped = true;
	}
	
	var KSrchWINcontainer = document.getElementById("KSrchWINcontainer");
	for (var i = 0; i < res.hits.hits.length; i++){
		// debugger; console.log(res.hits.hits[i]);
		var resURL = res.hits.hits[i]._source.url;
		var title = res.hits.hits[i]._source.title;
 
		var resSnippet = document.createElement('DIV'); resSnippet.className = "resSnippet";
		var resID = document.createElement('p'); resID.className = "resID";

		var thumbnailURL = "http://search.learningregistry.net/webcap/" +
						res.hits.hits[i]._id + "/48/screencap.jpg";  
		var thumbNail = document.createElement("IMG");
			thumbNail.setAttribute("src", thumbnailURL);
			thumbNail.className = "thumbNail";
			resID.appendChild(thumbNail);

		var a = document.createElement('a');
			a.className = "resTitle";
			a.setAttribute('href', resURL.toString());
			a.setAttribute('target', '_blank');
			a.innerHTML = title;
			
			a.onclick=logClosure({
				action: "visit",
				param: res.hits.hits[0]._source["title"],
				url: resURL.toString(),
				date: Date()
			}); // does not cancel the navigation event

		resID.appendChild(a);
		resSnippet.appendChild(resID);
		KSrchWINcontainer.appendChild(resSnippet);
		
		var resMetadata = document.createElement("DIV"); resMetadata.className = "resMetadata";
		for (var j = 0; j < metadata.length; j++){
			var nodeL = document.createTextNode(metadata[j][0] + ": ");
			var nodeR = document.createTextNode(res.hits.hits[i]._source[metadata[j][1]]);
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
	
	if (clipped){
		// proper paging to be added
		var resSnippet = document.createElement('DIV'); resSnippet.className = "resSnippet";
		var resID = document.createElement('p');
		resID.innerHTML = " ... and so on... ";
		resSnippet.appendChild(resID);
		KSrchWINcontainer.appendChild(resSnippet);
	}
	
}

function logClosure(action){
	return function log(){
		chrome.storage.local.get("log", function(obj){
				var tmp = (('log' in obj) ? obj.log : []);
				tmp.push(action);
				chrome.storage.local.set({"log" : tmp});
		}
	)}
}

function snackbar() {
    // Get the snackbar DIV
    var x = document.getElementById("snackbar");

    // Add the "show" class to DIV
    x.className = "show";

    // After 3 seconds, remove the show class from DIV
    setTimeout(function(){
					x.className = x.className.replace("show", ""); },
				3000);
}
