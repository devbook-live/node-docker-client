/* eslint-disable max-len */
/* eslint-disable no-shadow */
/* eslint-disable comma-dangle */

const { Docker } = require('node-docker-api');
const { createImageAndRunContainer, updateContainer } = require('./docker');
const { db } = require('./firebase/initFirebase');
const express = require('express');

const app = express();

/* ---- INITS ---- */

const host = process.env.DOCKER_HOST;
const port = process.env.DOCKER_PORT;
const dockerConfigurationObject = host && port ? { host, port: Number(port) } : { socketPath: '/var/run/docker.sock' };
const docker = new Docker(dockerConfigurationObject);
const containers = new Map(); // snippetId => container instance

/* ---- CONTAINERIZATION ---- */
// Container timeout subprocess:
const forceDestroyContainer = (snippetId) => {
  containers.get(snippetId).kill();
  db.collection('snippets').doc(snippetId).set({ running: false }, { merge: true });
};

const timeoutCallback = async (snippetId) => {
  const snippet = await db.collection('snippets').doc(snippetId).get();
  if (snippet.data().running) forceDestroyContainer(snippetId);
};

const containerizationCallback = (snippetId, container, logging = true, lifeInMilliseconds = 1000) => {
  if (logging) console.warn(`Ran container with doc id ${snippetId}.`);
  containers.set(snippetId, container);
  setTimeout(() => timeoutCallback(snippetId), lifeInMilliseconds);
};

const recontainerizationCallback = (snippetId, logging = true, lifeInMilliseconds = 1000) => {
  if (logging) console.warn(`Restarted container with doc id ${snippetId}.`);
  setTimeout(() => timeoutCallback(snippetId), lifeInMilliseconds);
};

// `containerize` and `recontainerize` wrapper methods:
/* For a given body of code, these will attempt to
  (a) create or update an image out of that code and its specifications, and
  (b) run or restart a container based on that image qua filesystem.
  The container is to be destroyed after a given "lifeInMilliseconds," or when there's
  no more data to stream in, whichever comes first. */
const containerize = async (snippetId, docker, indexContents, logging = true, lifeInMilliseconds = 1000) => {
  const container = await createImageAndRunContainer({ snippetId, docker, indexContents, containers });
  containerizationCallback(snippetId, container, logging, lifeInMilliseconds);
};

const recontainerize = (snippetId, docker, indexContents, logging = true, lifeInMilliseconds = 1000) => {
  updateContainer({ snippetId, indexContents, container: containers.get(snippetId) });
  recontainerizationCallback(snippetId, logging, lifeInMilliseconds);
};

/* ---- API ---- */
const queryDocumentCallback = (doc, logging = true, lifeInMilliseconds = 1000) => {
  if (!doc.get('running')) return; // just to double check
  const snippetId = doc.id;
  const indexContents = doc.get('text');
  // const language = doc.get('language');
  // If there is no container assigned to `snippetId`, we'll create an image based on that snippet and its specifications and run a container based on that image.
  if (!containers.has(snippetId)) containerize(snippetId, docker, indexContents, logging, lifeInMilliseconds);
  // If a container has already been assigned to this snippet, we'll fetch the container to update appropriately.
  else recontainerize(snippetId, docker, indexContents, logging, lifeInMilliseconds);
};

const querySnapshotCallback = (querySnapshot, logging = true, lifeInMilliseconds = 1000) => {
  if (logging) console.warn(`Received query snapshot of size ${querySnapshot.size}`);
  querySnapshot.docs.forEach(doc => queryDocumentCallback(doc, logging, lifeInMilliseconds));
};

/* ---- RUN SCRIPT ---- */
(() => {
  const port = process.env.port || 3000;
  app.get('/', (req, res) => res.send('Hello World!'));
  app.listen(port, () => console.warn(`Example app listening on port ${port}!`));
  console.warn('Starting query.onSnapshot...');

  const logging = true;
  const lifeInMilliseconds = 1000;
  const query = db.collection('snippets').where('running', '==', true);
  query.onSnapshot(
    querySnapshot => querySnapshotCallback(querySnapshot, logging, lifeInMilliseconds),
    err => console.error(`Encountered error: ${err}`)
  );
  process.on('beforeExit', () => {
    // for (const container of containers.values()) container.kill();
    containers.forEach(value => value.kill());
  });
})();
