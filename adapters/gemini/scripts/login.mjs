import { launchInteractive } from './gemini.mjs';
try { process.exitCode = await launchInteractive(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
