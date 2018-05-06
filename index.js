const Docker = require('node-docker-api').Docker;
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

docker.container.create({
  Image: 'hello-world',
  name: 'test'
})
  .then((container) => container.start())
  .then((container) => container.logs({
    follow: true,
    stdout: true,
    stderr: true
  }))
  .then((stream) => {
    stream.on('data', (info) => console.log(info.toString()));
    stream.on('error', (err) => console.log(err));
  })
  .catch((error) => console.log(error));
