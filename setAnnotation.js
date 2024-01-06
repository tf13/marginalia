// get selection and turn it into a range
let range = window.getSelection().getRangeAt(0);
// identify the start and end nodes
let startNode = range.startContainer; 
let endNode = range.endContainer;
// for text nodes, use the parent node for reference
if (startNode.nodeType == 3) {
var startIsText = true;
var startFlag = startNode.parentNode;
startNode = startNode.nodeValue;
} else {
var startIsText = false;
var startFlag = startNode;
}
if (endNode.nodeType == 3) {
var endIsText = true;
var endFlag = endNode.parentNode;
endNode = endNode.nodeValue;
} else {
var endIsText = false;
var endFlag = endNode;
}
// set offset data
let startOffset = range.startOffset; 
let endOffset = range.endOffset; 
// get tag name (element type) for start node
let startTagName = startFlag.nodeName;
// get innerHTML for start node
let startHTML = startFlag.innerHTML;
// do the same for end node
let endTagName = endFlag.nodeName;
let endHTML = endFlag.innerHTML;
let hcolor = 'yellow'; // highlight color
var date = new Date();
var ts = date.getTime();
//you can store this in database and use it
let hInfo = {
startNode: startNode,
startOffset: startOffset,
startIsText: startIsText,
startTagName: startTagName,
startHTML: startHTML,
endNode: endNode,
endOffset: endOffset,
endIsText: endIsText,
endTagName: endTagName,
endHTML: endHTML,
hcolor: hcolor
};
hInfo.created = date; // add timestamp as text
hInfo.lsid = "hl"+ts;  // add a local-storage ID as epoch timestamp
var annotation = prompt("Annotation: ", "note");
if (annotation!=null) {
hInfo.annotation = annotation;
}
var getColor = prompt("Highlight color: ", "yellow");
if (getColor!=null) {
hInfo.hcolor = getColor;
}
existingLS = window.localStorage.getItem("r");
parsed = JSON.parse(existingLS);
if (parsed instanceof Array) {
	parsed.append(hInfo);
} else {
	parsed = [hInfo];
}
window.localStorage.setItem("r", JSON.stringify(hInfo));

function hlite(range, annotation, hcolor) {
  span = document.createElement("span");
  span.style.backgroundColor = hcolor;
  span.appendChild(range.extractContents());
  span.title = annotation;
  range.insertNode(span);
}

hlite(range, annotation, getColor);

