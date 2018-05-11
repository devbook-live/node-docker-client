/* eslint-disable id-length */

const rimraf = require('rimraf');
const fse = require('fs-extra');
const tar = require('tar-fs');
const { makeTempDir, promisifyStream, IMAGE_NAME, CONTAINER_NAME } = require('./utils');

const createImageAndRunContainer = async ({ id, docker, indexContents, containers }) => {
  let cleanUpFunc;
  let container;

  const origId = id;
  id = id.toLowerCase();

  try {
    // Based on the index.js contents we have
    // a tmpDir string and a tmpDirCreate function which returns a Promise
    const { tmpDir, tmpDirCreate } = makeTempDir({ id, indexContents });
    const name = 'node_docker_' + id;
    cleanUpFunc = () => rimraf(tmpDir, () => console.warn(`Deleted temporary directory ${tmpDir}.`));

    // Wait for the temporary directory to be created
    await tmpDirCreate();
    // Pack the temporary directory into a tar (like zip) stream
    const tarStream = await tar.pack(tmpDir);
    // Build the image (blueprint/configuration) from the tar stream
    const imgStream = await docker.image.build(tarStream, { t: name });

    // Create a promise for the image build stream
    // And wait until the image build finishes
    await promisifyStream(imgStream, 'image', origId);

    // Create a container (running instance) based on the image
    container = await docker.container.create({ Image: name, name });
    // Start that container
    container = await container.start();
    // Get a stream for the container's logs
    const containerStream = await container.logs({ follow: true, stdout: true, stderr: true });
    // Create a promise for the container stream
    // And delete temp dir, container and image
    // when container ends
    promisifyStream(containerStream, 'container', origId)
      .finally(() => {
        if (cleanUpFunc) cleanUpFunc();
        if (container) {
          containers.delete(id);
          container.delete({ force: true })
            .then(() => docker.image.get(name).remove());
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

const updateContainer = async ({ id, indexContents, container }) => {
  const indexjs = `/tmp/docker-${id}/index.js`;
  console.warn('container: ', container);
  await fse.outputFile(indexjs, indexContents);
  await container.fs.put(indexjs, { path: '/usr/src/app' });
  await container.restart();
  return undefined;
};

module.exports = { createImageAndRunContainer, updateContainer };
