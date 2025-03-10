const { parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const http = require('http');

// Create an HTTP Agent to reuse TCP connections
const agent = new http.Agent({ keepAlive: true });

const API_URL = 'https://postup-chi.vercel.app/login'; // Replace with your actual URL
const API_CALLS = 500; // Number of API calls per worker

async function callApiRepeatedly() {
  for (let i = 0; i < API_CALLS; i++) {
    try {
      await axios.get(API_URL, { httpAgent: agent });
      if (i % 100 === 0) {
        parentPort.postMessage(`Worker ${workerData.id}: ${i} requests completed`);
      }
    } catch (error) {
      parentPort.postMessage(`Worker ${workerData.id} error: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50)); // Delay to prevent overwhelming the server
  }
  parentPort.postMessage(`Worker ${workerData.id} finished`);
}

callApiRepeatedly();
