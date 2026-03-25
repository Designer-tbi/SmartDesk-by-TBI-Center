import app from '../server';
export default app;
// Also export as module.exports for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}
