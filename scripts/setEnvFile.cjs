const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const formattedDate = new Date().getTime();

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

const buildType = process.argv[2] || 'Beta';

let data =
  `BUILD_TYPE=${buildType}` +
  os.EOL +
  `GIT_HASH=${commitHash}` +
  os.EOL +
  `RELEASE_DATE=${formattedDate}` +
  os.EOL +
  `NODE_ENV=${buildType === 'Release' ? 'production' : 'development'}`;
let existingEnvData = '';

fs.readFile(path.join(__dirname, '..', '.env'), 'utf8', (err, existingData) => {
  if (err) return;

  existingEnvData = existingData
    .split(os.EOL)
    .filter(line => {
      return (
        !line.startsWith('BUILD_TYPE=') &&
        !line.startsWith('GIT_HASH=') &&
        !line.startsWith('RELEASE_DATE=')
      );
    })
    .join(os.EOL);
});

if (existingEnvData) {
  data += os.EOL + existingEnvData;
}

fs.writeFile(path.join(__dirname, '..', '.env'), data, 'utf8', err => {
  if (err) {
    console.log(err);
  }
});
