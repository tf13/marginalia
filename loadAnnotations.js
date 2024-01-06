function hlite(range, annotation, hcolor) {
  span = document.createElement("span");
  span.style.backgroundColor = hcolor;
  span.appendChild(range.extractContents());
  span.title = annotation;
  range.insertNode(span);
}

function findEle(tagName, innerHTML) {
  let list = document.getElementsByTagName(tagName);
  for (let i = 0; i < list.length; i++) {
    if (list[i].innerHTML == innerHTML) {
      return list[i];
    }
  }
}

function reselect(startNode,startIsText,startOffset, endNode,endIsText,endOffset,sP,eP,annotation,hcolor) {
  var s, e
  if (startIsText) {
  let childs = sP.childNodes;
  // console.log(childs);
  for (let i = 0; i < childs.length; i++) {
    // console.log(childs[i].nodeValue);
    // console.log(startNode);
    if (childs[i].nodeType == 3 && childs[i].nodeValue == startNode)
      s = childs[i];
    // console.log(s);
    }
  } else {
    s = startNode;
  }
  if (endIsText) {
    let childs = eP.childNodes;
    // console.log(childs);
    for (let i = 0; i < childs.length; i++) {
      if (childs[i].nodeType == 3 && childs[i].nodeValue == endNode)
        e = childs[i];
      // console.log(e);
    }
  } else {
    e = endNode;
  }

  // create range based on start, end nodes & offsets
  let range = document.createRange();
  range.setStart(s, startOffset);
  range.setEnd(e, endOffset);

  // highlight resulting range
  hlite(range, annotation, hcolor)
  // reset selection to newly created range
  // let sel = window.getSelection();
  // sel.removeAllRanges();
  // sel.addRange(range);
}

function use(localData) {
  if (localData instanceof Array) { 
    // data is an array with multiple highlights to handle
    localData.forEach(localD => use(localD));
  } else {
    // it is not an array, just one object to handle 
    console.log("no array, just one object");
    let sP = findEle(localData.startTagName, localData.startHTML);
    let eP = findEle(localData.endTagName, localData.endHTML);
    reselect(
      localData.startNode,
      localData.startIsText,
      localData.startOffset,
      localData.endNode,
      localData.endIsText,
      localData.endOffset,
      sP,
      eP,
      localData.annotation,
      localData.hcolor
    );
  }
}

// retrieve data as string from localStorage
retrieved = window.localStorage.getItem("r");
// use the use() function to turn into 
use(JSON.parse(retrieved));

