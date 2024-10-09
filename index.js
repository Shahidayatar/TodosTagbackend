const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const swaggerUi = require('swagger-ui-koa');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Database setup
const db = require('./db'); // Import the database

// Load Swagger YAML file
const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, 'swagger_todos_v1 5.yaml'), 'utf8'));

const app = new Koa();
const router = new Router();

// Todo Routes
require('./routes/todoRoutes')(router, db);

// Tag Routes
require('./routes/tagRoutes')(router, db);

// Middleware setup
app
  .use(bodyParser())
  .use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

// Serve Swagger UI
app.use(swaggerUi.serve);
app.use(swaggerUi.setup(swaggerDocument));

// Start the server
app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
