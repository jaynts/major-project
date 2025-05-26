const express = require("express");
const bodyParser = require("body-parser");
const _ = require("lodash");

const app = express();
app.use(bodyParser.json());

// Store user behavior data
const userBehavior = {};

// Define normal behavior thresholds
const NORMAL_THRESHOLD = {
  avgTimeBetweenActions: 500, // Average time between user actions (in ms)
  mouseMovements: 10, // Expected number of mouse movements in a session
  typingSpeed: 150, // Expected typing speed (characters per minute)
};



// Function to calculate anomaly score
const calculateAnomalyScore = (behavior) => {
  let score = 0;

  if (behavior.avgTimeBetweenActions < NORMAL_THRESHOLD.avgTimeBetweenActions / 2) score += 1;
  if (behavior.mouseMovements < NORMAL_THRESHOLD.mouseMovements / 2) score += 1;
  if (behavior.typingSpeed > NORMAL_THRESHOLD.typingSpeed * 2) score += 1;

  return score; // Higher score means more suspicious
};

// Middleware to track user behavior
app.post("/track", (req, res) => {
  const { sessionId, eventType, timestamp } = req.body;
  
  if (!userBehavior[sessionId]) {
    userBehavior[sessionId] = { actions: [], mouseMovements: 0, keystrokes: 0 };
  }

  let session = userBehavior[sessionId];
  
  // Track events
  if (eventType === "mousemove") {
    session.mouseMovements += 1;
  } else if (eventType === "keypress") {
    session.keystrokes += 1;
  }

  session.actions.push(timestamp);
  
  // Calculate time between actions
  if (session.actions.length > 1) {
    let times = _.sortBy(session.actions);
    let intervals = _.zip(times.slice(1), times.slice(0, -1)).map(([cur, prev]) => cur - prev);
    session.avgTimeBetweenActions = _.mean(intervals);
  } else {
    session.avgTimeBetweenActions = 1000; // Default value
  }

  session.typingSpeed = session.keystrokes * 60 / (session.actions.length || 1);

  // Calculate anomaly score
  const anomalyScore = calculateAnomalyScore(session);

  res.json({ sessionId, anomalyScore, isSuspicious: anomalyScore > 1 });
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
