const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = __dirname;
const jsFiles = ['www/js/app.js', 'www/js/api-service.js', 'www/js/updater.js'];
for (const file of jsFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source, { filename: file });
  console.log(`PASS syntax: ${file}`);
}
const html = fs.readFileSync(path.join(root, 'www/index.html'), 'utf8');
if (html.includes('id="settingsModal"') || html.includes('id="updateModal"') || html.includes('id="btnSettings"')) {
  throw new Error('User-facing settings/update modal should be removed');
}
if (!html.includes('vendor/hls.min.js')) throw new Error('Local HLS.js bundle reference missing');
const api = fs.readFileSync(path.join(root, 'www/js/api-service.js'), 'utf8');
if (!api.includes('https://phimapi.com')) throw new Error('Original movie API base was not preserved');
if (!api.includes('requestJson')) throw new Error('API timeout/HTTP validation helper missing');
console.log('PASS static app checks');
