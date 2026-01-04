// Marginalia - Set Annotation Bookmarklet
// Highlights selected text and saves annotation to localStorage or remoteStorage

(async function() {
  const STORAGE_PREF_KEY = 'marginalia_storage';
  const ANNOTATIONS_KEY = 'marginalia_annotations';
  const RS_CDN = 'https://unpkg.com/remotestoragejs@latest/release/remotestorage.js';

  // Get storage preference
  function getStoragePreference() {
    return localStorage.getItem(STORAGE_PREF_KEY) || null;
  }

  function setStoragePreference(type) {
    localStorage.setItem(STORAGE_PREF_KEY, type);
  }

  // Prompt for storage choice
  function promptStorageChoice() {
    const current = getStoragePreference();
    const msg = 'Marginalia Storage:\n\n' +
      '1 = localStorage (default, no sync)\n' +
      '2 = remoteStorage (sync across devices)\n' +
      (current ? '\nc = clear saved preference' : '') +
      '\n\nCurrent: ' + (current === 'remote' ? 'remoteStorage' : current === 'local' ? 'localStorage' : 'not set');

    const choice = prompt(msg, current === 'remote' ? '2' : '1');
    if (choice === null) return null;

    if ((choice === 'c' || choice === 'C') && current) {
      localStorage.removeItem(STORAGE_PREF_KEY);
      return promptStorageChoice();
    }

    const type = choice === '2' ? 'remote' : 'local';
    const remember = confirm('Remember this choice for future annotations?');
    if (remember) setStoragePreference(type);

    return type;
  }

  // Inject remoteStorage library
  function injectRemoteStorage() {
    return new Promise((resolve, reject) => {
      if (window.RemoteStorage) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = RS_CDN;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load remoteStorage'));
      document.head.appendChild(script);
    });
  }

  // Initialize and get remoteStorage
  let rsInstance = null;
  async function getRemoteStorage() {
    if (rsInstance) return rsInstance;

    await injectRemoteStorage();

    rsInstance = new RemoteStorage({ logging: false });
    rsInstance.access.claim('marginalia', 'rw');
    rsInstance.caching.enable('/marginalia/');

    rsInstance.defineModule('marginalia', function(privateClient) {
      return {
        exports: {
          saveAnnotation: async function(url, annotation) {
            const key = 'annotations/' + encodeURIComponent(url);
            let existing;
            try {
              existing = await privateClient.getObject(key) || { items: [] };
            } catch(e) {
              existing = { items: [] };
            }
            existing.items.push(annotation);
            await privateClient.storeObject('annotation-list', key, existing);
          }
        }
      };
    });

    return rsInstance;
  }

  // Connect to remoteStorage
  async function ensureRemoteStorageConnected() {
    const rs = await getRemoteStorage();
    if (rs.remote.connected) return true;

    const addr = prompt(
      'Enter your remoteStorage address:\n(e.g., user@5apps.com)\n\nLeave empty to use localStorage instead:'
    );

    if (!addr || addr.trim() === '') return false;

    try {
      rs.connect(addr.trim());
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!rs.remote.connected) {
        alert('Connection initiated. You may need to authorize in a popup.\nRe-run the bookmarklet after connecting.');
        return false;
      }
      return true;
    } catch (e) {
      alert('Failed to connect: ' + e.message);
      return false;
    }
  }

  // Save to localStorage
  function saveToLocalStorage(url, annotation) {
    const all = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) || '{}');
    if (!all[url]) all[url] = [];
    all[url].push(annotation);
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
    // Legacy key for backwards compatibility
    localStorage.setItem('r', JSON.stringify(annotation));
  }

  // Main highlight function
  function hlite(range, annotation, hcolor) {
    const span = document.createElement('span');
    span.style.backgroundColor = hcolor;
    span.appendChild(range.extractContents());
    span.title = annotation;
    range.insertNode(span);
  }

  // === MAIN LOGIC ===

  // Check for text selection
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    alert('Please select some text first.');
    return;
  }

  // Determine storage type
  let storageType = getStoragePreference();
  if (!storageType) {
    storageType = promptStorageChoice();
    if (!storageType) return; // cancelled
  }

  // Get the selection range
  const range = selection.getRangeAt(0);

  // Identify start and end nodes
  let startNode = range.startContainer;
  let endNode = range.endContainer;
  let startIsText = startNode.nodeType === 3;
  let endIsText = endNode.nodeType === 3;
  let startFlag = startIsText ? startNode.parentNode : startNode;
  let endFlag = endIsText ? endNode.parentNode : endNode;

  if (startIsText) startNode = startNode.nodeValue;
  if (endIsText) endNode = endNode.nodeValue;

  // Get annotation details from user
  const annotation = prompt('Annotation:', 'note');
  if (annotation === null) return;

  const hcolor = prompt('Highlight color:', 'yellow');
  if (hcolor === null) return;

  // Build annotation object
  const date = new Date();
  const hInfo = {
    startNode: startNode,
    startOffset: range.startOffset,
    startIsText: startIsText,
    startTagName: startFlag.nodeName,
    startHTML: startFlag.innerHTML,
    endNode: endNode,
    endOffset: range.endOffset,
    endIsText: endIsText,
    endTagName: endFlag.nodeName,
    endHTML: endFlag.innerHTML,
    hcolor: hcolor,
    annotation: annotation,
    created: date.toISOString(),
    lsid: 'hl' + date.getTime()
  };

  const pageUrl = window.location.href;

  // Save annotation
  if (storageType === 'remote') {
    try {
      const rs = await getRemoteStorage();
      if (!rs.remote.connected) {
        const connected = await ensureRemoteStorageConnected();
        if (!connected) {
          saveToLocalStorage(pageUrl, hInfo);
          console.log('Marginalia: Saved to localStorage (remoteStorage not connected)');
        } else {
          await rs.marginalia.saveAnnotation(pageUrl, hInfo);
          console.log('Marginalia: Saved to remoteStorage');
        }
      } else {
        await rs.marginalia.saveAnnotation(pageUrl, hInfo);
        console.log('Marginalia: Saved to remoteStorage');
      }
    } catch (e) {
      console.error('Marginalia: remoteStorage error:', e);
      saveToLocalStorage(pageUrl, hInfo);
      console.log('Marginalia: Fell back to localStorage');
    }
  } else {
    saveToLocalStorage(pageUrl, hInfo);
    console.log('Marginalia: Saved to localStorage');
  }

  // Apply highlight
  hlite(range, annotation, hcolor);

})();
