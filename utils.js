/* eslint-disable no-console */
/* eslint-disable no-control-regex */

const fse = require('fs-extra');
const Promise = require('bluebird');
const { db } = require('./firebase/initFirebase');

const IMAGE_NAME = 'image';
const CONTAINER_NAME = 'container';
const snippetOutputs = new Map();

const promisifyStream = (stream, name, id) => new Promise((resolve, reject) => {
  // If this is the stream for a container
  // set the initial snippet output to
  // an empty string
  if (name === CONTAINER_NAME) {
    snippetOutputs.set(id, '');
  }

  stream.on('data', (data) => {
    // Remove all control characters from output
    const newOutput = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    // If this output is the stream for a container and it contains some alphanumeric
    // character and it doesn't contain docker or node in it, add it to the snippetOutput
    if (name === CONTAINER_NAME && newOutput.match(/[a-zA-Z0-9]/) !== null
      && !newOutput.includes('docker') && !newOutput.includes('node')) {
      // Replace the value in the hashtable with new value
      const oldOutput = snippetOutputs.get(id);
      const output = oldOutput + newOutput;
      snippetOutputs.set(id, output);
      console.log(`Adding new output "${newOutput}" to old output "${oldOutput}"`);

      db.collection('snippetOutputs').doc(id).set({ output })
        .then(writeResult => console.log(`Document written at: ${writeResult.writeTime}`))
        .catch(error => console.error(`Error writing document: ${error}`));
    }

    console.log(name + ': ' + data.toString());
  });
  stream.on('end', resolve);
  stream.on('error', reject);
});



/* INPUTS */
// id --> snippet id (string)
// indexContents --> code from editor (string)

/* OUTPUT */
// an object containing...
//   tmpDir: `/tmp/${randomName}` --> path to the directory used to build the docker image
//   tmpDirCreate: () => Promise.all(promises) --> Function that returns an array of promises. Each promise in the array is an invocation of fse.outputFile. fse.outputFile takes a file and text we want to write to that file. When fse.outputFile resolves, this means that the text we passed in has been written to the filename we passed in.

const makeTempDir = ({ id, indexContents }) => {
  const randomName = 'docker-' + id;
  const promises = [];

  // Contents of Dockerfile
  const dockerFileContents =
    `FROM node:carbon
    WORKDIR /usr/src/app
    COPY package*.json ./
    RUN npm install
    COPY . .
    EXPOSE 8080
    CMD ["npm", "start"]`;

  // Contents of package.json
  const packageJSONContents =
    `{
      "name": "${randomName}",
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

  // Contents of .dockerignore
  const dockerIgnoreContents =
    `node_modules
    npm-debug.log`;

  promises.push(fse.outputFile(`/tmp/${randomName}/Dockerfile`, dockerFileContents)); // dockerFileContents is written in /Dockerfile
  promises.push(fse.outputFile(`/tmp/${randomName}/package.json`, packageJSONContents));
  promises.push(fse.outputFile(`/tmp/${randomName}/.dockerignore`, dockerIgnoreContents));
  promises.push(fse.outputFile(`/tmp/${randomName}/index.js`, indexContents));

  return {
    tmpDir: `/tmp/${randomName}`,
    tmpDirCreate: () => Promise.all(promises),
  };
};

module.exports = { makeTempDir, promisifyStream, IMAGE_NAME, CONTAINER_NAME };
