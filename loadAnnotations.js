// Marginalia - Load Annotations Bookmarklet
// Restores saved annotations/highlights from localStorage or remoteStorage

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
    const remember = confirm('Remember this choice?');
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
          getAnnotations: async function(url) {
            const key = 'annotations/' + encodeURIComponent(url);
            try {
              const data = await privateClient.getObject(key);
              return data || { items: [] };
            } catch(e) {
              return { items: [] };
            }
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

  // Load from localStorage
  function loadFromLocalStorage(url) {
    // Try new format first
    const all = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) || '{}');
    if (all[url] && all[url].length > 0) {
      return all[url];
    }

    // Fall back to legacy 'r' key
    const legacy = localStorage.getItem('r');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      return Array.isArray(parsed) ? parsed : [parsed];
    }

    return [];
  }

  // Highlight function
  function hlite(range, annotation, hcolor) {
    const span = document.createElement('span');
    span.style.backgroundColor = hcolor;
    span.appendChild(range.extractContents());
    span.title = annotation;
    range.insertNode(span);
  }

  // Find element by tag name and innerHTML
  function findEle(tagName, innerHTML) {
    const list = document.getElementsByTagName(tagName);
    for (let i = 0; i < list.length; i++) {
      if (list[i].innerHTML === innerHTML) {
        return list[i];
      }
    }
    return null;
  }

  // Recreate selection and apply highlight
  function reselect(data) {
    const sP = findEle(data.startTagName, data.startHTML);
    const eP = findEle(data.endTagName, data.endHTML);

    if (!sP || !eP) {
      console.warn('Marginalia: Could not find elements for annotation:', data.annotation);
      return false;
    }

    let s, e;

    if (data.startIsText) {
      const childs = sP.childNodes;
      for (let i = 0; i < childs.length; i++) {
        if (childs[i].nodeType === 3 && childs[i].nodeValue === data.startNode) {
          s = childs[i];
          break;
        }
      }
    } else {
      s = sP;
    }

    if (data.endIsText) {
      const childs = eP.childNodes;
      for (let i = 0; i < childs.length; i++) {
        if (childs[i].nodeType === 3 && childs[i].nodeValue === data.endNode) {
          e = childs[i];
          break;
        }
      }
    } else {
      e = eP;
    }

    if (!s || !e) {
      console.warn('Marginalia: Could not find text nodes for annotation:', data.annotation);
      return false;
    }

    try {
      const range = document.createRange();
      range.setStart(s, data.startOffset);
      range.setEnd(e, data.endOffset);
      hlite(range, data.annotation, data.hcolor);
      return true;
    } catch (err) {
      console.warn('Marginalia: Error applying highlight:', err);
      return false;
    }
  }

  // Apply all annotations
  function applyAnnotations(annotations) {
    let applied = 0;
    let failed = 0;

    annotations.forEach(data => {
      if (reselect(data)) {
        applied++;
      } else {
        failed++;
      }
    });

    console.log(`Marginalia: Applied ${applied} annotations` + (failed > 0 ? `, ${failed} failed` : ''));
    return { applied, failed };
  }

  // === MAIN LOGIC ===

  const pageUrl = window.location.href;

  // Determine storage type
  let storageType = getStoragePreference();
  if (!storageType) {
    storageType = promptStorageChoice();
    if (!storageType) return; // cancelled
  }

  let annotations = [];

  // Load annotations
  if (storageType === 'remote') {
    try {
      const rs = await getRemoteStorage();
      if (!rs.remote.connected) {
        const connected = await ensureRemoteStorageConnected();
        if (!connected) {
          annotations = loadFromLocalStorage(pageUrl);
          console.log('Marginalia: Loaded from localStorage (remoteStorage not connected)');
        } else {
          const data = await rs.marginalia.getAnnotations(pageUrl);
          annotations = data.items || [];
          console.log('Marginalia: Loaded from remoteStorage');
        }
      } else {
        const data = await rs.marginalia.getAnnotations(pageUrl);
        annotations = data.items || [];
        console.log('Marginalia: Loaded from remoteStorage');
      }
    } catch (e) {
      console.error('Marginalia: remoteStorage error:', e);
      annotations = loadFromLocalStorage(pageUrl);
      console.log('Marginalia: Fell back to localStorage');
    }
  } else {
    annotations = loadFromLocalStorage(pageUrl);
    console.log('Marginalia: Loaded from localStorage');
  }

  // Apply annotations
  if (annotations.length === 0) {
    alert('No annotations found for this page.');
  } else {
    const result = applyAnnotations(annotations);
    if (result.failed > 0) {
      alert(`Applied ${result.applied} annotations.\n${result.failed} could not be applied (page may have changed).`);
    }
  }

})();
