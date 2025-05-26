const { Worker } = require('worker_threads');

const WORKER_COUNT = 5; // Number of workers to create

console.log('Main thread: Starting workers...');

for (let i = 0; i < WORKER_COUNT; i++) {
  const worker = new Worker('./worker.js', { workerData: { id: i } });

  worker.on('message', (msg) => {
    console.log(`Worker ${worker.threadId}: ${msg}`);
  });

  worker.on('error', (err) => {
    console.error(`Worker ${worker.threadId} error:`, err);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker ${worker.threadId} stopped with exit code ${code}`);
    } else {
      console.log(`Worker ${worker.threadId} completed successfully.`);
    }
  });
}

