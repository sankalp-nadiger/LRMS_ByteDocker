import express from 'express';
import cors from 'cors'; // ADD THIS
import dotenv from 'dotenv';
dotenv.config();
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import landRecordRouter from './routes/landRecord.js';

const app = express();

// CORS configuration - ADD THIS BEFORE OTHER MIDDLEWARE
app.use(cors({
  origin: '*', // Allow all origins for testing (restrict in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/land-records', landRecordRouter);

app.get('/', (req, res) => res.send({ status: 'ok', message: 'Land record API' }));

// basic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}. Swagger: http://localhost:${PORT}/api-docs`);
});

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: err.message
    });
  }
  next(err);
});