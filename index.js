const { Docker } = require('node-docker-api');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const { createImageAndRunContainer } = require('./docker');
const { db } = require('./firebase/initFirebase');

// Contents of index.js in image
const indexContents =
  `'use strict';
  
  const express = require('express');
  
  // Constants
  const PORT = 8080;
  const HOST = '0.0.0.0';
  
  // App
  const app = express();
  app.get('/', (req, res) => {
    res.send('Hello world');
  });
  
  app.listen(PORT, HOST);
  console.log(\`Running on http://$\{HOST}:$\{PORT}\`);`;

const query = db.collection('snippets').where('running', '==', true);
const containers = new Map();

const observer = query.onSnapshot(querySnapshot => {
  console.log(`Received query snapshot of size ${querySnapshot.size}`);
  querySnapshot.docs.forEach(doc => {
    const { id } = doc;
    const indexContents = doc.get('text');

    if (!containers.has(id)) {
      createImageAndRunContainer({ id, docker, indexContents })
        .then((container) => {
          console.log(`Ran container with doc id ${id}.`);
          containers.set(id, container);
        });
    }
  });
}, err => {
  console.log(`Encountered error: ${err}`);
});
