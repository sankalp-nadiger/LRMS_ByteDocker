// src/swagger.js
import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Land Records Upload API',
      version: '1.0.0',
      description: 'API to accept bulk land record JSON uploads, validate, process and persist to Supabase'
    }
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;