import * as landRecordService from '../services/landRecordService.js';
import fs from 'fs/promises';

// Lightweight validation - only check critical structure
const validateBasicStructure = (data) => {
  const errors = [];

  if (!data.basicInfo) {
    errors.push("Missing 'basicInfo' section");
  } else {
    const required = ['district', 'taluka', 'village'];
    required.forEach(field => {
      if (!data.basicInfo[field]) {
        errors.push(`Missing required field in basicInfo: ${field}`);
      }
    });

    if (!data.basicInfo.blockNo && !data.basicInfo.reSurveyNo) {
      errors.push("Basic info must have either 'blockNo' or 'reSurveyNo'");
    }
  }

  if (data.nondhDetails && data.nondhDetails.length > 0) {
    if (!data.nondhs || data.nondhs.length === 0) {
      errors.push("nondhDetails require corresponding nondhs array");
    }
  }

  return errors;
};

// Handler for JSON body upload
export const uploadHandler = async (req, res) => {
  try {
    const jsonData = req.body;

    const structuralErrors = validateBasicStructure(jsonData);
    if (structuralErrors.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid JSON structure', 
        errors: structuralErrors 
      });
    }

    const result = await landRecordService.processUpload(jsonData);
    
    if (result.success) {
  return res.status(200).json(result);
} else if (result.duplicateRecord) {
  // Handle duplicate record case
  return res.status(409).json({
    success: false,
    message: 'Duplicate land record found',
    duplicateRecord: result.duplicateRecord,
    error: result.error
  });
} else {
  return res.status(500).json(result);
}
  } catch (err) {
    console.error('uploadHandler error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Upload failed', 
      error: err.message 
    });
  }
};

// Handler for JSON file upload
export const uploadFileHandler = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a JSON file.'
      });
    }

    // Check if it's a JSON file
    if (req.file.mimetype !== 'application/json') {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload a JSON file.'
      });
    }

    // Read and parse the JSON file
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    let jsonData;
    
    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in file',
        error: parseError.message
      });
    }

    // Clean up uploaded file after parsing
    await fs.unlink(req.file.path);

    // Validate structure
    const structuralErrors = validateBasicStructure(jsonData);
    if (structuralErrors.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid JSON structure', 
        errors: structuralErrors 
      });
    }

    // Process the upload
    const result = await landRecordService.processUpload(jsonData);
    
    if (result.success) {
  return res.status(200).json(result);
} else if (result.duplicateRecord) {
  // Handle duplicate record case
  return res.status(409).json({
    success: false,
    message: 'Duplicate land record found',
    duplicateRecord: result.duplicateRecord,
    error: result.error
  });
} else {
  return res.status(500).json(result);
}
  } catch (err) {
    console.error('uploadFileHandler error:', err);
    
    // Try to clean up file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Upload failed', 
      error: err.message 
    });
  }
};