/* eslint-disable id-length */

const rimraf = require('rimraf');
const tar = require('tar-fs');
const { makeTempDir, promisifyStream } = require('./utils');

const createImageAndRunContainer = async ({ indexContents, docker }) => {
  let cleanUpFunc;
  try {
    const { tmpDir, tmpDirCreate } = makeTempDir(indexContents);
    console.log(indexContents);
    cleanUpFunc = () => rimraf(tmpDir, () => console.log(`Deleted temporary directory ${tmpDir}.`));

    await tmpDirCreate();
    const tarStream = await tar.pack(tmpDir);
    const imgStream = await docker.image.build(tarStream, { t: 'testimg' });

    await promisifyStream(imgStream);

    const container = await docker.container.create({ Image: 'testimg', name: 'test' });
    await container.start();
    const containerStream = await container.logs({ follow: true, stdout: true, stderr: true });
    await containerStream.on('data', (info) => console.log(info.toString()));
    await containerStream.on('error', (err) => console.log(err));
    await containerStream.on('end', () => {
      console.log('Container ending...');
      container.delete({ force: true }).
        then(() => docker.image.get('testimg').remove());
      cleanUpFunc();
    });
  } catch (err) {
    if (cleanUpFunc) cleanUpFunc();
  }
};

module.exports = { createImageAndRunContainer };
