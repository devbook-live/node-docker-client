/* global describe before after it expect */
/* eslint-disable func-names */
const { Docker } = require('node-docker-api');
const { expect } = require('chai');
const { makeTempDir } = require('../utils');
const tar = require('tar-fs');
const { buildImage, streamImage, createContainer, buildImageAndCreateContainer, deleteContainerAndRemoveImage } = require('../docker');

// Docker Inits ------ //
const host = process.env.DOCKER_HOST;
const port = process.env.DOCKER_PORT;
const dockerConfigurationObject = host && port ? { host, port: Number(port) } : { socketPath: '/var/run/docker.sock' };
const docker = new Docker(dockerConfigurationObject);


describe('Building an image and creating a container via `buildImageAndCreateContainer`', () => {
  const dockerSnippetId = 'test-snippet-id';
  const imageName = 'node_docker_' + dockerSnippetId;
  const indexContents = 'console.log("Hello, world!")';
  let tempDirObj;
  let tarStream;
  let container;

  before(async function () {
    this.timeout(20000); // upping timeout as setup may take awhile
    tempDirObj = makeTempDir({ dockerSnippetId, indexContents }); // { tmpDir, tmpDirCreate }
    await tempDirObj.tmpDirCreate();
    tarStream = await tar.pack(tempDirObj.tmpDir);
    container = await buildImageAndCreateContainer(tarStream, imageName, dockerSnippetId, docker);
  });

  after(async () => {
    if (!container) return;
    await deleteContainerAndRemoveImage(container, imageName, docker);
  });

  describe('Building an image', () => {
    it('`buildImageAndCreateContainer` should build a Docker image from a tarStream and imageName, whose status can be accessed off of node-docker-api\'s `docker.image.get`', async () => {
      const status = await docker.image.get(imageName).status();
      expect(status).to.be.an('object');
      expect(status).to.include.all.keys('data', 'modem', 'id');
      expect(status).to.have.own.property('id');
      expect(status.id).to.equal(imageName);
    });
  });

  describe('Creating a container', () => {
    it('`buildImageAndCreateContainer` should create a Docker container associated with an image via the name of that image', async () => {
      const status = await container.status();
      expect(status).to.be.an('object');
      expect(status).to.include.all.keys('Warnings', 'data', 'modem', 'id', 'fs', 'exec');
      expect(status).to.have.own.property('data');
      expect(status.data.Config.Image).to.equal(imageName);
    });
  });
});
