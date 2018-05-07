const fse = require('fs-extra');

const promisifyStream = stream => new Promise((resolve, reject) => {
  stream.on('data', data => console.log(data.toString()));
  stream.on('end', resolve);
  stream.on('error', reject);
});

const makeTempDir = (indexContents) => {
  const rndStr = Math.random().toString(36).substring(10);
  const promises = [];

  const dockerFileContents =
    `FROM node:carbon
    WORKDIR /usr/src/app
    COPY package*.json ./
    RUN npm install
    COPY . .
    EXPOSE 8080
    CMD ["npm", "start"]`;

  const packageJSONContents =
    `{
      "name": "${rndStr}",
      "version": "1.0.0",
      "description": "Node.js on Docker",
      "author": "First Last <first.last@example.com>",
      "main": "index.js",
      "scripts": {
        "start": "node index.js"
      },
      "dependencies": {
        "express": "^4.16.1"
      }
    }`;

  const dockerIgnoreContents =
    `node_modules
    npm-debug.log`;

  promises.push(fse.outputFile(`/tmp/${rndStr}/Dockerfile`, dockerFileContents));
  promises.push(fse.outputFile(`/tmp/${rndStr}/package.json`, packageJSONContents));
  promises.push(fse.outputFile(`/tmp/${rndStr}/.dockerignore`, dockerIgnoreContents));
  promises.push(fse.outputFile(`/tmp/${rndStr}/index.js`, indexContents));

  return {
    tmpDir: `/tmp/${rndStr}`,
    tmpDirCreate: () => Promise.all(promises),
  };
};

module.exports = { makeTempDir, promisifyStream };
