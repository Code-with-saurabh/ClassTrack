const app = require('./app');
const env = require('./config/env');

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`ClassTrack server running on port ${PORT}`);
});
