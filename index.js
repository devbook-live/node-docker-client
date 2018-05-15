const { Docker } = require('node-docker-api');

const docker = new Docker({ socketPath: process.env.DOCKER_SERVER_ADDRESS || '/var/run/docker.sock' });
const { createImageAndRunContainer, updateContainer } = require('./docker');
const { db } = require('./firebase/initFirebase');

const query = db.collection('snippets').where('running', '==', true);
const containers = new Map();

query.onSnapshot((querySnapshot) => {
  console.warn(`Received query snapshot of size ${querySnapshot.size}`);
  querySnapshot.docs.forEach((doc) => {
    const snippetId = doc.id;
    const indexContents = doc.get('text');
    const language = doc.get('language');
    
    // if there is no container assigned to the snippet id, it will create an image and run the container
    if (!containers.has(snippetId)) {
      createImageAndRunContainer({ snippetId, docker, indexContents, containers })
        .then((container) => {
          console.warn(`Ran container with doc id ${snippetId}.`);
          containers.set(snippetId, container);
        });
    // if the containers map has the id in it, it will fetch the container to update
    } else {
      updateContainer({ snippetId, indexContents, container: containers.get(snippetId) })
        .then(() => console.warn(`Restarted container with doc id ${snippetId}.`));
    }
  });
}, (err) => {
  console.error(`Encountered error: ${err}`);
});
