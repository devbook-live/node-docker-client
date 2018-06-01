/* global describe before it expect */
const expect = require('chai').expect;
const { makeTempDir } = require('../utils');

// Dummy data
const data = {
  dockerSnippetId: 'test-snippet-id',
  indexContents: 'console.log("Hello, world!")',
};

describe('Utility functions', () => {

  describe('The `makeTempDir` utility', () => {
    let tmpDirObj;
    before(async () => tmpDirObj = await makeTempDir(data));

    it('Should return an object with `tmpDir` and `tmpDirCreate` entries', () => {
      expect(tmpDirObj).to.be.an('object');
      expect(tmpDirObj).to.have.own.property('tmpDir');
      expect(tmpDirObj).to.have.own.property('tmpDirCreate');
    });

    describe('The `tempDir` entry output by `makeTempDir`', () => {
      it('Should be a path to the temporary directory for Docker to access', () => {
        expect(tmpDirObj.tmpDir).to.include(data.dockerSnippetId);
      });
    });

    describe('The `tempDirCreate` entry output by `makeTempDir`', () => {
      it('Should be a function that returns an array of promises', async () => {
        expect(tmpDirObj.tmpDirCreate).to.be.a('function');
        const pendingPromiseObj = tmpDirObj.tmpDirCreate();
        expect(pendingPromiseObj).to.be.an('object');
        const resolvedPromiseArr = await Promise.resolve(pendingPromiseObj);
        expect(resolvedPromiseArr).to.be.an('array');
        expect(resolvedPromiseArr).to.have.lengthOf(4);
      });
    });

  });
});
