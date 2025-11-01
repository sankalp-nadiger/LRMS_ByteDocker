// src/validators/landRecordValidator.js
// Mirrors validation logic used in the frontend component
const NONDH_TYPES = [
  "Kabjedaar",
  "Ekatrikaran",
  "Varsai",
  "Hayati_ma_hakh_dakhal",
  "Hakkami",
  "Vechand",
  "Durasti",
  "Promulgation",
  "Hukam",
  "Vehchani",
  "Bojo",
  "Other",
];

const TENURE_TYPES = [
  "Navi",
  "Juni",
  "Kheti_Kheti_ma_Juni",
  "NA",
  "Bin_Kheti_Pre_Patra",
  "Prati_bandhit_satta_prakar"
];

const HUKAM_TYPES = [
  "SSRD",
  "Collector",
  "Collector_ganot",
  "Prant",
  "Mamlajdaar",
  "GRT",
  "Jasu",
  "ALT Krushipanch",
  "DILR"
];

const GANOT_OPTIONS = ["1st Right", "2nd Right"];

export const validateJSON = (data) => {
  const validationErrors = [];

  if (!data || typeof data !== 'object') {
    validationErrors.push('Payload must be a JSON object');
    return validationErrors;
  }

  if (!data.basicInfo) {
    validationErrors.push("Missing 'basicInfo' section");
  } else {
    const required = ['district', 'taluka', 'village'];
    required.forEach(field => {
      if (!data.basicInfo[field]) {
        validationErrors.push(`Missing required field in basicInfo: ${field}`);
      }
    });

    if (!data.basicInfo.blockNo && !data.basicInfo.reSurveyNo) {
      validationErrors.push("Basic info must have either 'blockNo' or 'reSurveyNo'");
    }
  }

  // if (!data.yearSlabs || !Array.isArray(data.yearSlabs) || data.yearSlabs.length === 0) {
  //   validationErrors.push("At least one year slab is required");
  // }

  // if (data.panipatraks && Array.isArray(data.panipatraks)) {
  //   data.panipatraks.forEach((panip, i) => {
  //     if (!panip.year) {
  //       validationErrors.push(`Panipatrak ${i + 1}: Missing year`);
  //     } else {
  //       const matchingSlab = findSlabForYear(panip.year, data.yearSlabs);
  //       if (!matchingSlab) {
  //         validationErrors.push(
  //           `Panipatrak ${i + 1}: Year ${panip.year} does not fall within any year slab range`
  //         );
  //       }
  //     }

  //     if (!panip.farmers || panip.farmers.length === 0) {
  //       validationErrors.push(`Panipatrak ${i + 1}: Must have at least one farmer`);
  //     }

  //     panip.farmers?.forEach((farmer, j) => {
  //       if (!farmer.name) {
  //         validationErrors.push(`Panipatrak ${i + 1}, Farmer ${j + 1}: Missing name`);
  //       }

  //       if (farmer.paikyNumber !== undefined && farmer.ekatrikaranNumber !== undefined) {
  //         validationErrors.push(`Panipatrak ${i + 1}, Farmer ${j + 1}: Cannot have both paikyNumber and ekatrikaranNumber`);
  //       }

  //       if (farmer.paikyNumber !== undefined && farmer.paikyNumber < 0) {
  //         validationErrors.push(`Panipatrak ${i + 1}, Farmer ${j + 1}: paikyNumber must be 0 or positive`);
  //       }
  //       if (farmer.ekatrikaranNumber !== undefined && farmer.ekatrikaranNumber < 0) {
  //         validationErrors.push(`Panipatrak ${i + 1}, Farmer ${j + 1}: ekatrikaranNumber must be 0 or positive`);
  //       }
  //     });
  //   });
  // }

  return validationErrors;
};

export const validateNondhDetail = (detail) => {
  const errors = [];
  if (!detail) {
    errors.push('Detail missing');
    return errors;
  }

  if (!detail.nondhNumber) errors.push('Missing nondh number');
  if (!detail.type) errors.push('Missing type');
  else if (!NONDH_TYPES.includes(detail.type)) {
    errors.push(`Invalid nondh type '${detail.type}'. Must be one of: ${NONDH_TYPES.join(', ')}`);
  }
  if (!detail.date) errors.push('Missing date');
  else if (detail.date.length !== 8) errors.push('Date must be in ddmmyyyy format (e.g., 15012020)');
  if (!detail.vigat) errors.push('Missing vigat');
  
  // CHANGED: Remove required validation for tenure, only validate if provided
  if (detail.tenure && !TENURE_TYPES.includes(detail.tenure)) {
    errors.push(`Invalid tenure type '${detail.tenure}'. Must be one of: ${TENURE_TYPES.join(', ')}`);
  }

  if (detail.type === 'Hukam') {
    // CHANGED: Remove required validation for hukamType, only validate if provided
    if (detail.hukamType && !HUKAM_TYPES.includes(detail.hukamType)) {
      errors.push(`Invalid hukam type '${detail.hukamType}'. Must be one of: ${HUKAM_TYPES.join(', ')}`);
    }
    if (detail.hukamType === 'ALT Krushipanch' && detail.ganotType) {
      if (!GANOT_OPTIONS.includes(detail.ganotType)) {
        errors.push(`Invalid ganot type '${detail.ganotType}'. Must be one of: ${GANOT_OPTIONS.join(', ')}`);
      }
    }
  }

  return errors;
};

// helper used in validator
export const mapStatusFromJSON = (jsonStatus) => {
  switch (jsonStatus) {
    case "Pramaanik": return "valid";
    case "Radd": return "invalid";
    case "Na Manjoor": return "nullified";
    default: return "valid";
  }
};

export const findSlabForYear = (year, yearSlabs) => {
  if (!Array.isArray(yearSlabs)) return null;
  return yearSlabs.find(slab => year >= slab.startYear && year < slab.endYear);
};