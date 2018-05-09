const { Docker } = require('node-docker-api');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const { createImageAndRunContainer, updateContainer } = require('./docker');
const { db } = require('./firebase/initFirebase');

const query = db.collection('snippets').where('running', '==', true);
const containers = new Map();

query.onSnapshot((querySnapshot) => {
  console.warn(`Received query snapshot of size ${querySnapshot.size}`);
  querySnapshot.docs.forEach((doc) => {
    let { id } = doc;
    const indexContents = doc.get('text');

    id = id.toLowerCase();

    if (!containers.has(id)) {
      createImageAndRunContainer({ id, docker, indexContents, containers })
        .then((container) => {
          console.warn(`Ran container with doc id ${id}.`);
          containers.set(id, container);
        });
    } else {
      updateContainer({ id, indexContents, container: containers.get(id) })
        .then(() => console.warn(`Restarted container with doc id ${id}.`));
    }
  });
}, (err) => {
  console.error(`Encountered error: ${err}`);
});
