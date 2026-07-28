// Vercel serverless entrypoint — @vercel/node compiles src/ automatically
const app = require('../dist/src/index');
module.exports = app.default || app;
