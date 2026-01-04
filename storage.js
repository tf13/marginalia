// Marginalia Storage Abstraction
// Handles both localStorage and remoteStorage backends

const STORAGE_PREF_KEY = 'marginalia_storage';
const ANNOTATIONS_KEY = 'marginalia_annotations';
const RS_CDN = 'https://unpkg.com/remotestoragejs@latest/release/remotestorage.js';

// Get current storage preference (default: 'local')
function getStoragePreference() {
  return localStorage.getItem(STORAGE_PREF_KEY) || 'local';
}

// Set storage preference
function setStoragePreference(type) {
  localStorage.setItem(STORAGE_PREF_KEY, type);
}

// Prompt user to choose storage backend
function promptStorageChoice() {
  const current = getStoragePreference();
  const choice = prompt(
    'Choose storage backend:\n' +
    '1 = localStorage (default, no sync)\n' +
    '2 = remoteStorage (sync across devices)\n' +
    'c = change/clear saved preference\n\n' +
    'Current: ' + (current === 'remote' ? 'remoteStorage' : 'localStorage'),
    current === 'remote' ? '2' : '1'
  );

  if (choice === null) return null; // cancelled

  if (choice === 'c' || choice === 'C') {
    localStorage.removeItem(STORAGE_PREF_KEY);
    return promptStorageChoice(); // ask again
  }

  const type = choice === '2' ? 'remote' : 'local';

  const remember = confirm('Remember this choice for future use?');
  if (remember) {
    setStoragePreference(type);
  }

  return type;
}

// Inject remoteStorage library into the page
function injectRemoteStorage() {
  return new Promise((resolve, reject) => {
    if (window.RemoteStorage) {
      resolve(window.RemoteStorage);
      return;
    }

    const script = document.createElement('script');
    script.src = RS_CDN;
    script.onload = () => resolve(window.RemoteStorage);
    script.onerror = () => reject(new Error('Failed to load remoteStorage'));
    document.head.appendChild(script);
  });
}

// Initialize remoteStorage instance
let rsInstance = null;
async function getRemoteStorage() {
  if (rsInstance) return rsInstance;

  await injectRemoteStorage();

  rsInstance = new RemoteStorage({ logging: false });
  rsInstance.access.claim('marginalia', 'rw');
  rsInstance.caching.enable('/marginalia/');

  // Define the annotations module
  rsInstance.defineModule('marginalia', function(privateClient) {
    return {
      exports: {
        getAnnotations: async function(url) {
          const key = 'annotations/' + encodeURIComponent(url);
          return await privateClient.getObject(key) || { items: [] };
        },
        saveAnnotation: async function(url, annotation) {
          const key = 'annotations/' + encodeURIComponent(url);
          const existing = await privateClient.getObject(key) || { items: [] };
          existing.items.push(annotation);
          await privateClient.storeObject('annotation-list', key, existing);
        },
        getAllAnnotations: async function() {
          const listing = await privateClient.getListing('annotations/');
          const all = {};
          for (const key in listing) {
            if (listing[key] === true) continue; // skip folders
            const url = decodeURIComponent(key);
            all[url] = await privateClient.getObject('annotations/' + key);
          }
          return all;
        }
      }
    };
  });

  return rsInstance;
}

// Check if remoteStorage is connected
async function isRemoteStorageConnected() {
  const rs = await getRemoteStorage();
  return rs.remote.connected;
}

// Show connection prompt for remoteStorage
async function ensureRemoteStorageConnected() {
  const rs = await getRemoteStorage();

  if (rs.remote.connected) return true;

  // Create a simple connection UI
  const connectUrl = prompt(
    'remoteStorage not connected.\n\n' +
    'Enter your remoteStorage address (e.g., user@provider.com)\n' +
    'or leave empty to use localStorage instead:'
  );

  if (!connectUrl || connectUrl.trim() === '') {
    return false;
  }

  try {
    await rs.connect(connectUrl.trim());
    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    return rs.remote.connected;
  } catch (e) {
    alert('Failed to connect to remoteStorage: ' + e.message);
    return false;
  }
}

// Save annotation to the appropriate backend
async function saveAnnotation(annotation, storageType) {
  const url = window.location.href;

  if (storageType === 'remote') {
    try {
      const rs = await getRemoteStorage();
      if (!rs.remote.connected) {
        const connected = await ensureRemoteStorageConnected();
        if (!connected) {
          // Fall back to localStorage
          saveToLocalStorage(url, annotation);
          alert('Saved to localStorage (remoteStorage not connected)');
          return;
        }
      }
      await rs.marginalia.saveAnnotation(url, annotation);
    } catch (e) {
      console.error('remoteStorage save failed:', e);
      saveToLocalStorage(url, annotation);
      alert('remoteStorage failed, saved to localStorage instead');
    }
  } else {
    saveToLocalStorage(url, annotation);
  }
}

// Save to localStorage (organized by URL)
function saveToLocalStorage(url, annotation) {
  const all = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) || '{}');
  if (!all[url]) all[url] = [];
  all[url].push(annotation);
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));

  // Also save to legacy 'r' key for backwards compatibility
  localStorage.setItem('r', JSON.stringify(annotation));
}

// Load annotations for current page
async function loadAnnotations(storageType) {
  const url = window.location.href;

  if (storageType === 'remote') {
    try {
      const rs = await getRemoteStorage();
      if (!rs.remote.connected) {
        const connected = await ensureRemoteStorageConnected();
        if (!connected) {
          return loadFromLocalStorage(url);
        }
      }
      const data = await rs.marginalia.getAnnotations(url);
      return data.items || [];
    } catch (e) {
      console.error('remoteStorage load failed:', e);
      return loadFromLocalStorage(url);
    }
  } else {
    return loadFromLocalStorage(url);
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

// Export for use in bookmarklets
if (typeof window !== 'undefined') {
  window.MarginaliaStorage = {
    getStoragePreference,
    setStoragePreference,
    promptStorageChoice,
    saveAnnotation,
    loadAnnotations,
    injectRemoteStorage,
    getRemoteStorage,
    ensureRemoteStorageConnected
  };
}
