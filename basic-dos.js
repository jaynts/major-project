const {
	Worker, isMainThread, parentPort, workerData,
  } = require('node:worker_threads');
  const axios = require('axios');
  const http = require('http');
  const https = require('https'); // Import the https module
  const { setTimeout } = require('timers/promises');
  
  // Create an HTTP Agent to reuse TCP connections
  const agent = new http.Agent({ keepAlive: true });
  
  const WORKER_COUNT = 20; // Increased number of workers
  const API_CALLS_PER_WORKER = 500; // Increased number of calls per worker
  const API_URL = 'https://who.is/'; // Replace with your actual URL
  const MAX_RETRIES = 3; // Maximum number of retries for failed requests
  const INITIAL_DELAY_BETWEEN_REQUESTS = 50; // Delay between individual requests (in milliseconds)
  const DELAY_BETWEEN_BATCHES = 2000; // Delay between batches (in milliseconds)
  
  if (isMainThread) {
	console.log('Main thread: Starting workers...');
  
	for (let i = 0; i < WORKER_COUNT; i++) {
	  const worker = new Worker(__filename, {
		workerData: { workerId: i + 1 }
	  });
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
	const { workerId } = workerData;
  
	async function makeRequestWithRetry(url, retries = MAX_RETRIES, delay = 1000) {
	  try {
		const response = await axios.get(url, {
		  httpAgent: agent,
		  httpsAgent: new https.Agent({ rejectUnauthorized: false }) // Ignore SSL errors
		});
		return response;
	  } catch (error) {
		if (retries > 0) {
		  await setTimeout(delay); // Wait before retrying
		  return makeRequestWithRetry(url, retries - 1, delay * 2); // Exponential backoff
		}
		throw error; // No retries left
	  }
	}

	
  
	async function callApiRepeatedly() {
	  let batchCount = 0;
	  while (batchCount < 10) { // Limit the number of batches to 10
		const promises = [];
		for (let i = 0; i < API_CALLS_PER_WORKER; i++) {
		  // Add a small delay between individual requests
		  await setTimeout(INITIAL_DELAY_BETWEEN_REQUESTS); // Delay between requests
		  promises.push(
			makeRequestWithRetry(API_URL)
			  .catch(error => {
				parentPort.postMessage(`Worker ${workerId}: Request failed: ${error.message}`);
				return null; // Return null for failed requests
			  })
		  );
		}
  
		try {
		  const results = await Promise.all(promises);
		  const successfulCalls = results.filter(result => result !== null).length;
		  parentPort.postMessage(`Worker ${workerId}: Batch of ${API_CALLS_PER_WORKER} calls completed (${successfulCalls} successful)`);
		} catch (error) {
		  parentPort.postMessage(`Worker ${workerId}: Batch call failed: ${error.message}`);
		}
  
		batchCount++;
		await setTimeout(DELAY_BETWEEN_BATCHES); // Add a delay between batches
	  }
	  parentPort.postMessage(`Worker ${workerId}: Finished all batches`);
	}
  
	callApiRepeatedly();
  }