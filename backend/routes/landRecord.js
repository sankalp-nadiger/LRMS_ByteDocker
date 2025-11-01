import express from 'express';
import { uploadHandler, uploadFileHandler } from '../controllers/landRecordController.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

/**
 * @openapi
 * /api/land-records/upload:
 *   post:
 *     summary: Upload bulk land record JSON (raw JSON body)
 *     tags:
 *       - LandRecords
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The JSON structure matching the frontend sample
 *     responses:
 *       200:
 *         description: Processing successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     nondhs:
 *                       type: number
 *                     nondhDetails:
 *                       type: number
 *                     totalOwners:
 *                       type: number
 *                     skippedNondhDetails:
 *                       type: number
 *                 landRecordId:
 *                   type: string
 *       400:
 *         description: Validation errors or invalid JSON structure
 *       409:
 *         description: Duplicate land record found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Duplicate land record found
 *                 duplicateRecord:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     district:
 *                       type: string
 *                     taluka:
 *                       type: string
 *                     village:
 *                       type: string
 *                     block_no:
 *                       type: string
 *                     re_survey_no:
 *                       type: string
 *                 error:
 *                   type: string
 *                   example: A land record with the same details already exists. Modify json file & upload again or visit the LRMS platform to edit existing record.
 *       500:
 *         description: Server error
 */
router.post('/upload', uploadHandler);

/**
 * @openapi
 * /api/land-records/upload-file:
 *   post:
 *     summary: Upload bulk land record JSON file
 *     tags:
 *       - LandRecords
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: JSON file containing land record data
 *     responses:
 *       200:
 *         description: File uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     nondhs:
 *                       type: number
 *                     nondhDetails:
 *                       type: number
 *                     totalOwners:
 *                       type: number
 *                     skippedNondhDetails:
 *                       type: number
 *                 landRecordId:
 *                   type: string
 *       400:
 *         description: Invalid file or JSON structure
 *       409:
 *         description: Duplicate land record found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Duplicate land record found
 *                 duplicateRecord:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     district:
 *                       type: string
 *                     taluka:
 *                       type: string
 *                     village:
 *                       type: string
 *                     block_no:
 *                       type: string
 *                     re_survey_no:
 *                       type: string
 *                 error:
 *                   type: string
 *                   example: A land record with the same details already exists. Modify json file & upload again or visit the LRMS platform to edit existing record.
 *       500:
 *         description: Server error
 */
router.post('/upload-file', upload.single('file'), uploadFileHandler);

export default router;