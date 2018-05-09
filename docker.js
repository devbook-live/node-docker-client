/* eslint-disable id-length */

const rimraf = require('rimraf');
const tar = require('tar-fs');
const { makeTempDir, promisifyStream } = require('./utils');

const createImageAndRunContainer = async ({ indexContents, docker }) => {
  let cleanUpFunc;
  let container;

  try {
    // Based on the index.js contents we have
    // a tmpDir string and a tmpDirCreate function which returns a Promise
    const { tmpDir, tmpDirCreate } = makeTempDir(indexContents);
    cleanUpFunc = () => rimraf(tmpDir, () => console.log(`Deleted temporary directory ${tmpDir}.`));

    // Wait for the temporary directory to be created
    await tmpDirCreate();
    // Pack the temporary directory into a tar (like zip) stream
    const tarStream = await tar.pack(tmpDir);
    // Build the image (blueprint/configuration) from the tar stream
    const imgStream = await docker.image.build(tarStream, { t: 'testimg' });

    // Create a promise for the image build stream
    // And wait until the image build finishes
    await promisifyStream(imgStream);

    // Create a container (running instance) based on the image
    container = await docker.container.create({ Image: 'testimg', name: 'test' });
    // Start that container
    await container.start();
    // Get a stream for the container's logs
    const containerStream = await container.logs({ follow: true, stdout: true, stderr: true });
    // Create a promise for the container stream
    // And delete temp dir, container and image
    // when container ends
    promisifyStream(containerStream)
      .finally(() => {
        cleanUpFunc && cleanUpFunc();
        container && container.delete({ force: true }).then(() => docker.image.get('testimg').remove());
      });

    // Since we don't await the previous promise
    // we execute the return statement synchronously here
    // and return the container in a Promise
    return container;
  } catch (err) {
    console.log(err);
  }
};

module.exports = { createImageAndRunContainer };
