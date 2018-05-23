/* eslint-disable id-length */

const rimraf = require('rimraf'); // "The UNIX command rm -rf for node."
const fse = require('fs-extra');
const tar = require('tar-fs');
const { makeTempDir, promisifyStream, IMAGE_NAME, CONTAINER_NAME } = require('./utils');


// helper fns
const buildImageAndCreateContainer = (tarStream, imageName, snippetId) => {
  return docker.image.build(tarStream, { t: imageName })
    .then((imgStream) => {
      // Set up logging, and catch errors, for the image build stream.
      return promisifyStream(imgStream, 'image', snippetId);
    })
    .then((promisifiedStream) => {
      // Create a container based on the image.
      return docker.container.create({ Image: imageName, name: imageName });
    });
}

const deleteContainerAndRemoveImage = (container, imageName) =>
  container.delete({ force: true })
    .then(() => docker.image.get(imageName).remove());


/*** INPUTS ***/
// snippetId --> snippet id
// docker --> instance of the Node Docker API
// indexContents --> current code text in the snippet
// containers --> map of all running snippets to their associated containers

/*** OUTPUTS ***/
// Success --> returns promise for a Docker container
// Error --> returns undefined
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
    // (1) set up temp directory of files for docker, and a way to clean up this temp dir.

    // Based on the indexContents passed in on index.js we have
    // a tmpDir string and a tmpDirCreate function which returns a Promise:
    //   tmpDir: `/tmp/${randomName}` --> path to the directory used to build the docker image
    //   tmpDirCreate: () => Promise.all(promises) --> Function that returns an array of promises. Each promise in the array is an invocation of fse.outputFile. fse.outputFile takes a file and text we want to write to that file. When fse.outputFile resolves, this means that the text we passed in has been written to the filename we passed in.
    const { tmpDir, tmpDirCreate } = makeTempDir({ dockerSnippetId, indexContents });
    cleanUpFunc = () => rimraf(tmpDir, () => console.warn(`Deleted temporary directory ${tmpDir}.`));
    // equivalent to `rm -rf tmpDir/` from the command line; i.e., recursively "force remove" all files from this directory
    // Wait for the temporary directory to be created
    await tmpDirCreate();


    // (2) go from directory to streamed file, build the image for that file, and set up logging for that image.

    // Pack the temporary directory into a tar (like zip) stream
    // Docker best practice is to "archive" the directory like so.
    // "Archive a directory" = pack everything into a single file, so we can unpack later.
    // Analogy: a casette tape being wound up.
    const tarStream = await tar.pack(tmpDir);
    // Build the image (blueprint/configuration) from the tar stream
    const imageName = 'node_docker_' + dockerSnippetId;

    container = await buildImageAndCreateContainer(tarStream, imageName, snippetId);


    // console.log('(1) telling docker to create a container');
    // Start that container - this is how user code is run:
    container = await container.start();
    // console.log('(2) telling docker container to execute code');
    // Get a stream (promise) for the container's logs
    const containerStream = await container.logs({ follow: true, stdout: true, stderr: true });


    // Create a promise for the container stream
    // And delete temp dir, container and image
    // when container ends
    promisifyStream(containerStream, 'container', snippetId)
      // .then(() => {
      //   console.log('(4) code is done')
      // })
      .finally(async () => {
        if (cleanUpFunc) cleanUpFunc();
        if (container) {
          containers.delete(snippetId);
          await deleteContainerAndRemoveImage(container, imageName);
        }
      });

    // Since we don't await the previous promise
    // we execute the return statement synchronously here
    // and return the container in a Promise
    return container;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

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
