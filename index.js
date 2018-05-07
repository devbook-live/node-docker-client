const { Docker } = require('node-docker-api');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const { createImageAndRunContainer } = require('./docker');

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


createImageAndRunContainer({ indexContents, docker })
    .then(() => console.log('Ran container.'));
