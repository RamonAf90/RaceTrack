// server/config.js
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function must(name) {
  const val = (process.env[name] || '').trim();
  if (!val) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return val;
}

module.exports = {
  receptionistKey: must('RECEPTIONIST_KEY'),
  observerKey: must('OBSERVER_KEY'),
  safetyKey: must('SAFETY_KEY'),
  port: Number(process.env.PORT || 5000),
};
