/* global describe beforeEach afterEach it expect */

const { expect } = require('chai');
const { makeTempDir } = require('../utils');
const tar = require('tar-fs');
const { buildImageAndCreateContainer, deleteContainerAndRemoveImage } = require('../docker');

describe('Building an image and creating a container via `buildImageAndCreateContainer`', () => {

  const dockerSnippetId = 'test-snippet-id';
  const imageName = 'node_docker_' + dockerSnippetId;
  const indexContents = 'console.log("Hello, world!")';
  let tempDirObj, container;

  before(async () => {
    tempDirObj = makeTempDir({ dockerSnippetId, indexContents }); // { tmpDir, tmpDirCreate }
    await tempDirObj.tmpDirCreate();
    const tarStream = await tar.pack(tempDirObj.tmpDir);
  });

  afterEach(async () => {
    await deleteContainerAndRemoveImage(container, imageName);
  });

  describe('Building an image', () => {
    it('Should build a Docker image from a tarStream and imageName')
    container = await buildImageAndCreateContainer(tarStream, imageName, snippetId);

  });

  describe('Creating a container', () => {
      it('Should create a container associated with an image via the name of that image')
  });

});
