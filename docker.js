/* eslint-disable id-length */

const rimraf = require('rimraf'); // "The UNIX command rm -rf for node."
const fse = require('fs-extra');
const tar = require('tar-fs');
const { makeTempDir, promisifyStream, IMAGE_NAME, CONTAINER_NAME } = require('./utils');


/*
The functions in this file oversee CRUD actions for a Docker container.
The file is organized as follows:
1) `buildImageAndCreateContainer` helper functions
2) `buildImageAndCreateContainer` wrapper function
3) `deleteContainerAndRemoveImage` function
4) `createImageAndRunContainer` wrapper function
5) `updateContainer` wrapper function (to restart an extant container)
*/


// 1) `buildImageAndCreateContainer` helper functions ----------------------- //
/*
`buildImage` composes a Docker image (i.e., container blueprint)
from a streamed zip-like "tar" file. This function returns a promise
which resolves to a streamable version of the image.
*/
const buildImage = (tarStream, imageName, snippetId) =>
  docker.image.build(tarStream, { t: imageName });

/*
`streamImage` configures a Docker image stream for logging and
output emission. This promisified stream can then be passed to
Docker to perform container CRUD. This function returns a promise
which resolves to an image stream configured to our needs.
*/
const streamImage = (imgStream, snippetId) =>
  promisifyStream(imgStream, 'image', snippetId);

/*
`createContainer` tells Docker to actually create a containerized
environment. This container is associated to an image stream
according to the image name passed into this function. The function
returns apromsise which resolves to a Docker container upon which
further CRUD actions can be performed.
*/
const createContainer = imgName =>
  docker.container.create({ Image: imgName, name: imgName });


// 2) `buildImageAndCreateContainer` wrapper function ----------------------- //
/*
This function builds and streams an image, and creates a container
based upon this image. The function returns a reference to the container.
*/
const buildImageAndCreateContainer = async (tarStream, imageName, snippetId) => {
  let image;
  let container;

  try {
    image = await buildImage(tarStream, imageName, snippetId);
  } catch (err) {
    console.error(`Error building Docker image: ${err}`);
    return null;
  }

  try {
    await streamImage(image, snippetId);
  } catch (err) {
    console.error(`Error configuring image stream: ${err}`);
    return null;
  }

  try {
    container = await createContainer(imageName);
  } catch (err) {
    console.error(`Error creating Docker container: ${err}`);
    return null;
  }

  return container;
};


// 3) `deleteContainerAndRemoveImage` function ------------------------------ //
/*
This function deletes a Docker container and returns a promise
which resolves to the removal of the image for this container.
*/
const deleteContainerAndRemoveImage = async (container, imageName) => {
  try {
    await container.delete({ force: true });
  } catch (err) {
    console.error(`Error deleting Docker container: ${err}`);
    return null;
  }

  return docker.image.get(imageName).remove();
}


// 4) `createImageAndRunContainer` wrapper function ------------------------- //
/*** INPUTS ***/
// snippetId --> snippet id
// docker --> instance of the Node Docker API
// indexContents --> current code text in the snippet
// containers --> map of all running snippets to their associated containers
/*** OUTPUTS ***/
// Success --> returns promise for a Docker container
// Error --> returns null
const createImageAndRunContainer = async ({
  snippetId,
  docker,
  indexContents,
  containers,
}) => {
  let cleanUpFunc;
  let container;
  let dockerSnippetId = snippetId.toLowerCase(); // Docker needs lowercase ID

  try {
    /*
    (A) Set up temp directory of files for docker,
    and a way to clean up this temp dir.

    Based on the indexContents passed in on index.js we have a tmpDir string,
    and a tmpDirCreate function which returns a promise which resolves to the
    following:
      tmpDir: `/tmp/${randomName}` --> path to the directory used to build the docker image
      tmpDirCreate: () => Promise.all(promises) --> Function that returns an array of promises. Each promise in the array is an invocation of fse.outputFile. fse.outputFile takes a file and text we want to write to that file. When fse.outputFile resolves, this means that the text we passed in has been written to the filename we passed in.
    */
    const { tmpDir, tmpDirCreate } = makeTempDir({
      dockerSnippetId, indexContents
    });

    cleanUpFunc = () => rimraf(tmpDir, () =>
      /*
      The callback here runs the equivalent to `rm -rf tmpDir/`;
      i.e., recursively "force remove" all files from this directory.
      */
      console.warn(`Deleted temporary directory ${tmpDir}.`)
    );

    // Wait for the temporary directory to be created:
    await tmpDirCreate();


    /*
    (B) Pack the temporary directory into a zip-like "tar" stream.
    Docker best practice is to "archive" the directory like so.
    "Archive a directory" = pack everything into a single file,
    so we can unpack later. Analogy: a casette tape being wound up.
    */
    const tarStream = await tar.pack(tmpDir);
    const imageName = 'node_docker_' + dockerSnippetId;


    /*
    (C) Build and stream an image, and create a container based
    upon this image.
    */
    container = await buildImageAndCreateContainer(
      tarStream, imageName, snippetId
    );


    /*
    (D) Start the container (in order to run user code), and
    stream its logs.
    */
    container = await container.start();
    const containerStream = await container.logs({
      follow: true, stdout: true, stderr: true
    });


    /*
    (E) Create a promise for the container stream; and
    delete temp dir, container and image when container ends.
    */
    promisifyStream(containerStream, 'container', snippetId)
      // When code is done, or container lifetime has expired:
      .finally(async () => {
        if (cleanUpFunc) cleanUpFunc();
        if (container) {
          containers.delete(snippetId);
          await deleteContainerAndRemoveImage(container, imageName);
        }
      });


    /*
    (F) Since we don't await the previous promise, we execute the
    return statement synchronously here and return the container.
    */
    return container;
  } catch (err) {
    console.error(`Uncaught error in running container: ${err}`);
    return null;
  }
};


// 5) `updateContainer` wrapper function ------------------------------------ //
const updateContainer = async ({ snippetId, indexContents, container }) => {
  const indexjs = `/tmp/docker-${snippetId}/index.js`;  // or another file ext if different language
  console.warn('container: ', container);
  await fse.outputFile(indexjs, indexContents);

  // here we are putting 'index.js' into the container's filesystem.
  await container.fs.put(indexjs, { path: '/usr/src/app' });
  await container.restart();
  return undefined;
};

module.exports = { createImageAndRunContainer,
  buildImageAndCreateContainer, updateContainer, deleteContainerAndRemoveImage };
