const FIELDS = ['provider', 'apiKey', 'model', 'baseURL', 'autoAnalyze', 'agentEnabled', 'agentBaseURL', 'agentModel', 'agentApiKey'];

async function load() {
  const s = await chrome.storage.local.get(FIELDS);
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el.type === 'checkbox') el.checked = !!s[f];
    else if (s[f] != null) el.value = s[f];
  }
}

async function save() {
  const data = {};
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    data[f] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  await chrome.storage.local.set(data);
  document.getElementById('status').textContent = 'Kaydedildi.';
}

document.getElementById('save').addEventListener('click', save);
load();
