"use client"
import React, { useState, Suspense } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, FileJson, Loader2 } from 'lucide-react';
import { LandRecordService } from '@/lib/supabase';
import { AuthProvider } from '@/components/auth-provider';
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Card, 
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Area {
  sqm?: number;
  acre?: number;
  guntha?: number;
}

interface NondhOwner {
  name: string;
  area: Area;
  surveyNumber?: string;
  surveyNumberType?: string;
}

interface NondhDetail {
  nondhNumber: string;
  type: string;
  date: string;
  vigat: string;
  tenure: string;
  status?: string;
  invalidReason?: string;
  showInOutput?: boolean;
  oldOwner?: string;
  owners?: NondhOwner[];
  newOwners?: NondhOwner[];
  sdDate?: string;
  amount?: number;
  hukamType?: string;
  hukamDate?: string;
  restrainingOrder?: string;
  ganotType?: string;
  affectedNondhDetails?: Array<{ nondhNo: string; status: string; invalidReason: string; }>;
  validationErrors?: string[];
}

interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    yearSlabs: number;
    panipatraks: number;
    farmers: number;
    nondhs: number;
    nondhDetails: number;
    totalOwners: number;
    skippedNondhDetails: number;
  };
  landRecordId?: string;
}

interface JsonData {
  basicInfo: {
    district: string;
    taluka: string;
    village: string;
    blockNo?: string;
    reSurveyNo?: string;
    isPromulgation?: boolean;
  };
  yearSlabs?: Array<any>;
  panipatraks?: Array<any>;
  nondhs?: Array<any>;
  nondhDetails?: NondhDetail[];
}

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
] as const;

const TENURE_TYPES = [
  "Navi",
  "Juni",
  "Kheti_Kheti_ma_Juni",
  "NA",
  "Bin_Kheti_Pre_Patra",
  "Prati_bandhit_satta_prakar"
] as const;

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
] as const;

const GANOT_OPTIONS = ["1st Right", "2nd Right"] as const;

// Area conversion utilities
const convertToSquareMeters = (value, unit) => {
  switch (unit) {
    case "acre":
      return value * 4046.86;
    case "guntha":
      return value * 101.17;
    case "sq_m":
      return value;
    default:
      return value;
  }
};

const LandRecordJSONUploadContent = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const searchParams = useSearchParams()
  const router = useRouter()
  const fromEdit = searchParams.get('fromEdit') === 'true'
  const fromView = searchParams.get('fromView') === 'true'
  const existingLandRecordId = searchParams.get('landRecordId')
  const [duplicateRecord, setDuplicateRecord] = useState<any>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const sampleJSON = {
    basicInfo: {
  district: "Ahmedabad",
  taluka: "Mandal",
  village: "Ukardi",
  blockNo: "123",
  reSurveyNo: "245/2",
  isPromulgation: true,
  area: {
    acre: 5,
    guntha: 20
  }
  // OR alternatively:
  // area: {
  //   sqm: 22257.3
  // }
},
    // yearSlabs: [
    //   {
    //     startYear: 2010,
    //     endYear: 2015,
    //     sNo: "123",
    //     sNoType: "block_no",
    //     area: {
    //       sqm: 22257.3
    //     }
    //   },
    //   {
    //     startYear: 2016,
    //     endYear: 2020,
    //     paiky: true,
    //     paikyEntries: [
    //       {
    //         sNo: "124/1",
    //         sNoType: "s_no",
    //         area: {
    //           sqm: 5058.5
    //         }
    //       }
    //     ]
    //   }
    // ],
    // panipatraks: [
    //   {
    //     year: 2012,
    //     farmers: [
    //       {
    //         name: "Farmer Name 1",
    //         area: {
    //           acre: 3,
    //           guntha: 0
    //         }
    //       },
    //       {
    //         name: "Farmer Name 2",
    //         area: {
    //           sqm: 10117
    //         }
    //       }
    //     ]
    //   },
    //   {
    //     year: 2018,
    //     farmers: [
    //       {
    //         name: "Main Land Owner",
    //         area: {
    //           sqm: 8000
    //         }
    //       },
    //       {
    //         name: "Paiky Owner 1",
    //         area: {
    //           sqm: 5058.5
    //         },
    //         paikyNumber: 1
    //       },
    //       {
    //         name: "Ekatrikaran Owner 1",
    //         area: {
    //           sqm: 3000
    //         },
    //         ekatrikaranNumber: 1
    //       }
    //     ]
    //   }
    // ],
    nondhs: [
      {
        number: "1",
        affectedSNos: [
          { number: "123", type: "block_no" },
          { number: "124/1", type: "s_no" }
        ]
      },
      {
        number: "2",
        affectedSNos: [
          { number: "234/2", type: "re_survey_no" }
        ]
      }
    ],
    nondhDetails: [
      {
        nondhNumber: "4",
        type: "Kabjedaar",
        date: "15012015",
        vigat: "Initial possession entry",
        tenure: "Navi",
        status: "Pramaanik",
        showInOutput: true,
        owners: [
          {
            name: "Owner 1",
            area: {
              acre: 3,
              guntha: 0
            }
          },
          {
            name: "Owner 2",
            area: {
              sqm: 10117
            }
          }
        ]
      },
      {
        nondhNumber: "3",
        type: "Varsai",
        date: "20052018",
        vigat: "Transfer from Owner 1 to new owners",
        tenure: "Navi",
        status: "Pramaanik",
        oldOwner: "Owner 1",
        showInOutput: true,
        newOwners: [
          {
            name: "New Owner 1",
            area: {
              acre: 1,
              guntha: 20
            }
          },
          {
            name: "New Owner 2",
            area: {
              acre: 1,
              guntha: 20
            }
          }
        ]
      },
      {
        nondhNumber: "1",
        type: "Hukam",
        date: "10032019",
        hukamDate: "05032019",
        hukamType: "SSRD",
        restrainingOrder: "no",
        vigat: "Court order regarding land dispute",
        status: "Radd",
        invalidReason: "Plain",
        showInOutput: true,
        affectedNondhDetails: [
          {
            nondhNo: "1",
            status: "Radd",
            invalidReason: "Superseded by court order"
          }
        ],
        owners: [
          {
            name: "Court Appointed Owner",
            area: {
              sqm: 20234
            }
          }
        ]
      },
      {
        nondhNumber: "4",
        type: "Vechand",
        date: "15062020",
        sdDate: "10062020",
        amount: 500000,
        vigat: "Sale transaction",
        tenure: "Navi",
        status: "Pramaanik",
        oldOwner: "Owner 2",
        showInOutput: true,
        newOwners: [
          {
            name: "Buyer Name",
            area: {
              acre: 2,
              guntha: 20
            }
          }
        ]
      },
      {
        nondhNumber: "5",
        type: "Hakkami",
        date: "20082021",
        vigat: "Possession transfer",
        tenure: "Navi",
        status: "Pramaanik",
        oldOwner: "New Owner 1",
        showInOutput: true,
        newOwners: [
          {
            name: "Hakkami Recipient 1",
            area: {
              sqm: 4046.86
            }
          },
          {
            name: "Hakkami Recipient 2",
            area: {
              sqm: 4046.86
            }
          }
        ]
      },
      {
        nondhNumber: "6",
        type: "Durasti",
        date: "10012022",
        vigat: "Correction entry",
        tenure: "Navi",
        status: "Pramaanik",
        showInOutput: true,
        owners: [
          {
            name: "Corrected Owner Name",
            surveyNumber: "126",
            surveyNumberType: "block_no",
            area: {
              acre: 4,
              guntha: 0
            }
          }
        ]
      },
      {
        nondhNumber: "1",
        type: "Bojo",
        date: "25052022",
        vigat: "Load entry",
        tenure: "Navi",
        status: "Na Manjoor",
        invalidReason: "Entry canceled due to documentation error",
        showInOutput: false,
        owners: [
          {
            name: "Bojo Owner",
            area: {
              sqm: 5058.5
            }
          }
        ]
      }
    ]
  };

  const downloadSampleJSON = () => {
    const dataStr = JSON.stringify(sampleJSON, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'land_record_sample.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseDate = (dateStr) => {
    if (dateStr && dateStr.length === 8) {
      const day = dateStr.substring(0, 2);
      const month = dateStr.substring(2, 4);
      const year = dateStr.substring(4, 8);
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const parseArea = (areaObj) => {
    if (!areaObj) return { value: 0, unit: 'sq_m' };

    if (areaObj.sqm !== undefined) {
      return {
        value: areaObj.sqm,
        unit: 'sq_m'
      };
    }

    if (areaObj.acre !== undefined || areaObj.guntha !== undefined) {
      const acres = areaObj.acre || 0;
      const gunthas = areaObj.guntha || 0;
      
      const acreInSqm = convertToSquareMeters(acres, 'acre');
      const gunthaInSqm = convertToSquareMeters(gunthas, 'guntha');
      const totalSqm = acreInSqm + gunthaInSqm;

      return {
        value: totalSqm,
        unit: 'sq_m'
      };
    }

    return { value: 0, unit: 'sq_m' };
  };

  const mapStatusFromJSON = (jsonStatus: string): "valid" | "invalid" | "nullified" => {
    switch (jsonStatus) {
      case "Pramaanik": return "valid";
      case "Radd": return "invalid";
      case "Na Manjoor": return "nullified";
      default: return "valid";
    }
  };

const handleCloseDuplicateDialog = () => {
  setShowDuplicateDialog(false);
  setDuplicateRecord(null);
  setFile(null); // Clear the file so user can upload a new one
};

const handleNavigateToDuplicate = (mode: 'edit' | 'view') => {
  if (!duplicateRecord) return;
  
  router.push(`/land-master/forms?mode=${mode}&id=${duplicateRecord.id}`);
  setShowDuplicateDialog(false);
  setDuplicateRecord(null);
};

  const validateJSON = (data) => {
    const validationErrors = [];

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

    // if (data.panipatraks) {
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

  const validateNondhDetail = (detail: NondhDetail, index: number): string[] => {
  const errors: string[] = [];

  if (!detail.nondhNumber) {
    errors.push(`Missing nondh number`);
  }
  if (!detail.type) {
    errors.push(`Missing type`);
  } else if (!NONDH_TYPES.includes(detail.type as any)) {
    errors.push(`Invalid nondh type '${detail.type}'. Must be one of: ${NONDH_TYPES.join(', ')}`);
  }
  if (!detail.date) {
    errors.push(`Missing date`);
  } else if (detail.date.length !== 8) {
    errors.push(`Date must be in ddmmyyyy format (e.g., 15012020)`);
  }
  if (!detail.vigat) {
    errors.push(`Missing vigat`);
  }
  
  // CHANGED: Remove required validation for tenure, set default in processing
  if (detail.tenure && !TENURE_TYPES.includes(detail.tenure as any)) {
    errors.push(`Invalid tenure type '${detail.tenure}'. Must be one of: ${TENURE_TYPES.join(', ')}`);
  }

  // CHANGED: Remove required validation for hukamType, set default in processing
  if (detail.type === "Hukam" && detail.hukamType && !HUKAM_TYPES.includes(detail.hukamType as any)) {
    errors.push(`Invalid hukam type '${detail.hukamType}'. Must be one of: ${HUKAM_TYPES.join(', ')}`);
  }
  
  if (detail.type === "Hukam" && detail.hukamType === "ALT Krushipanch" && detail.ganotType) {
    if (!GANOT_OPTIONS.includes(detail.ganotType as any)) {
      errors.push(`Invalid ganot type '${detail.ganotType}'. Must be one of: ${GANOT_OPTIONS.join(', ')}`);
    }
  }

  return errors;
};

  const getPrimarySNoType = (affectedSNos: any[], landBasicInfo: any): string => {
  if (!affectedSNos || affectedSNos.length === 0) return 's_no';
  
  // Get valid S.Nos from land basic info
  const validSNos = new Set<string>();
  
  // Add S.Nos from basic info
  if (landBasicInfo) {
    // Survey Numbers from basic info
    if (landBasicInfo.sNo && landBasicInfo.sNo.trim() !== "") {
      const surveyNos = landBasicInfo.sNo.split(',').map(s => s.trim()).filter(s => s !== "");
      surveyNos.forEach(sNo => validSNos.add(sNo));
    }
    
    // Block Number from basic info
    if (landBasicInfo.blockNo && landBasicInfo.blockNo.trim() !== "") {
      validSNos.add(landBasicInfo.blockNo);
    }
    
    // Re-survey Number from basic info
    if (landBasicInfo.reSurveyNo && landBasicInfo.reSurveyNo.trim() !== "") {
      validSNos.add(landBasicInfo.reSurveyNo);
    }
  }
  
  // Filter affected S.Nos to only include valid ones
  const validTypes = affectedSNos
    .map(sNo => {
      try {
        let sNoNumber, sNoType;
        if (typeof sNo === 'string') {
          const parsed = JSON.parse(sNo);
          sNoNumber = parsed.number;
          sNoType = parsed.type;
        } else if (typeof sNo === 'object' && sNo.number) {
          sNoNumber = sNo.number;
          sNoType = sNo.type;
        } else {
          return null;
        }
        
        // Only include if this S.No is in basic info
        return validSNos.has(sNoNumber) ? sNoType || 's_no' : null;
      } catch (e) {
        return null;
      }
    })
    .filter(type => type !== null);
  
  if (validTypes.length === 0) return 's_no';
  
  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  
  // Find the highest priority type present
  for (const type of priorityOrder) {
    if (validTypes.includes(type)) {
      return type;
    }
  }
  
  return 's_no';
};

  const sortNondhs = (nondhs: any[], landBasicInfo: any) => {
  return [...nondhs].sort((a, b) => {
    const aType = getPrimarySNoType(a.affectedSNos, landBasicInfo);
    const bType = getPrimarySNoType(b.affectedSNos, landBasicInfo);

    const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
    const aPriority = priorityOrder.indexOf(aType);
    const bPriority = priorityOrder.indexOf(bType);

    if (aPriority !== bPriority) return aPriority - bPriority;

    const aNum = parseInt(a.number.toString()) || 0;
    const bNum = parseInt(b.number.toString()) || 0;
    return aNum - bNum;
  });
};

  const processValidityChain = (
    validDetails: any[],
    sortedNondhs: any[]
  ) => {
    const nondhDetailMap = new Map();
    validDetails.forEach(detail => {
      nondhDetailMap.set(detail.nondhNumber, detail);
    });

    const affectingCounts = new Map<string, number>();
    
    sortedNondhs.forEach((nondh, index) => {
      let count = 0;
      
      for (let i = index + 1; i < sortedNondhs.length; i++) {
        const affectingNondh = sortedNondhs[i];
        const affectingDetail = nondhDetailMap.get(affectingNondh.number);
        if (affectingDetail?.mappedStatus === 'invalid') {
          count++;
        }
      }
      
      affectingCounts.set(nondh.number, count);
    });

    validDetails.forEach(detail => {
      const affectingCount = affectingCounts.get(detail.nondhNumber) || 0;
      const shouldBeValid = affectingCount % 2 === 0;
      detail.isValid = shouldBeValid;
    });

    return validDetails;
  };

  const processUpload = async (jsonData) => {
    try {
    setLoading(true);
    setErrors([]);
    
    const validationErrors = validateJSON(jsonData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setResult({ success: false, message: 'Validation failed' });
      return;
    }

    // Step 1: Check for duplicate land record (only for new records, not when editing)
    let landRecordId;

    if ((fromEdit || fromView) && existingLandRecordId) {
      // Skip duplicate check for edit mode - we're updating existing record
      landRecordId = existingLandRecordId;
    } else {
      // Check for duplicate records for new uploads
      const duplicateCheckData = {
        district: jsonData.basicInfo.district,
        taluka: jsonData.basicInfo.taluka,
        village: jsonData.basicInfo.village,
        block_no: jsonData.basicInfo.blockNo || '',
        re_survey_no: jsonData.basicInfo.reSurveyNo || undefined
      }

      const { data: duplicate, error: duplicateError } = await LandRecordService.checkDuplicateLandRecord(duplicateCheckData);
      
      if (duplicateError) {
        console.error('Error checking duplicate:', duplicateError);
        // Continue with save if duplicate check fails
      }

      // If duplicate found
      if (duplicate) {
        setDuplicateRecord(duplicate);
        setShowDuplicateDialog(true);
        setLoading(false);
        return; // Stop the upload process
      }
    }

    // Step 2: Save land record basic info (only for new records)
    if (!fromEdit && !fromView) {
      const basicInfoArea = parseArea(jsonData.basicInfo.area);
      
      const landRecordData = {
        district: jsonData.basicInfo.district,
        taluka: jsonData.basicInfo.taluka,
        village: jsonData.basicInfo.village,
        block_no: jsonData.basicInfo.blockNo || null,
        re_survey_no: jsonData.basicInfo.reSurveyNo || null,
        is_promulgation: jsonData.basicInfo.isPromulgation || false,
        s_no_type: jsonData.basicInfo.blockNo ? 'block_no' : 're_survey_no',
        s_no: jsonData.basicInfo.blockNo || jsonData.basicInfo.reSurveyNo,
        area_value: basicInfoArea.value,
        area_unit: basicInfoArea.unit,
        json_uploaded: true,
        status: 'draft',
        current_step: 1
      };

      const { data: savedRecord, error: recordError } = await LandRecordService.saveLandRecord(landRecordData);
      
      if (recordError) {
        throw new Error(`Failed to save land record: ${recordError.message}`);
      }

      landRecordId = savedRecord.id;
    } else {
      // For edit mode, use existing record ID
      landRecordId = existingLandRecordId;
      
      // Validate that the JSON basic info matches the existing record
      const { data: existingRecord, error: fetchError } = await LandRecordService.getLandRecord(existingLandRecordId);
      
      if (fetchError || !existingRecord) {
        throw new Error('Could not find the existing land record');
      }
      
      // Validate matching criteria
      const matches = 
        existingRecord.district === jsonData.basicInfo.district &&
        existingRecord.taluka === jsonData.basicInfo.taluka &&
        existingRecord.village === jsonData.basicInfo.village &&
        (existingRecord.block_no === jsonData.basicInfo.blockNo || 
         existingRecord.re_survey_no === jsonData.basicInfo.reSurveyNo);
      
      if (!matches) {
        throw new Error('JSON basic info does not match the existing land record. Please verify district, taluka, village, and survey numbers.');
      }
    }


      // Step 2: Save nondhs
      let savedNondhs = [];
      if (jsonData.nondhs && jsonData.nondhs.length > 0) {
        const nondhsData = jsonData.nondhs.map(nondh => ({
          id: crypto.randomUUID(),
          land_record_id: landRecordId,
          number: nondh.number,
          affected_s_nos: nondh.affectedSNos
        }));

        const { data: nondhsResult, error: nondhError } = await LandRecordService.upsertNondhs(nondhsData);
        
        if (nondhError) {
          throw new Error(`Failed to save nondhs: ${nondhError.message}`);
        }
        savedNondhs = nondhsResult || [];
      }

      const sortedNondhs = sortNondhs(savedNondhs, jsonData.basicInfo);
      
      let validNondhDetails = [];
      let skippedNondhDetails = [];
      let totalOwnersInserted = 0;
      let savedNondhDetailsWithIds = [];

      // Step 3: Process and save nondh details (with individual validation)
      if (jsonData.nondhDetails && jsonData.nondhDetails.length > 0) {
        for (const detail of jsonData.nondhDetails) {
          const detailValidationErrors = validateNondhDetail(detail, validNondhDetails.length);
          
          if (detailValidationErrors.length > 0) {
            skippedNondhDetails.push(
              `Nondh ${detail.nondhNumber || 'unknown'}: ${detailValidationErrors.join(', ')}`
            );
            continue;
          }

          const correspondingNondh = savedNondhs.find(
            n => n.number.toString() === detail.nondhNumber.toString()
          );

          if (!correspondingNondh) {
            skippedNondhDetails.push(
              `Nondh ${detail.nondhNumber}: No matching nondh found in nondhs array`
            );
            continue;
          }

          const mappedStatus = detail.status ? mapStatusFromJSON(detail.status) : "valid";

          const nondhDetailData = {
            nondh_id: correspondingNondh.id,
            type: detail.type,
            date: parseDate(detail.date),
            sd_date: detail.sdDate ? parseDate(detail.sdDate) : null,
            hukam_date: detail.hukamDate ? parseDate(detail.hukamDate) : null,
            hukam_type: detail.type === "Hukam" ? (detail.hukamType || "SSRD") : null,
            restraining_order: detail.restrainingOrder || null,
            amount: detail.amount || null,
            vigat: detail.vigat,
            tenure: detail.tenure || 'Navi',
            status: mappedStatus,
            invalid_reason: detail.invalidReason || null,
            show_in_output: detail.showInOutput !== false,
            old_owner: detail.oldOwner || null,
            affected_nondh_details: detail.affectedNondhDetails && detail.affectedNondhDetails.length > 0
              ? JSON.stringify(detail.affectedNondhDetails.map(a => ({
                  nondhNo: a.nondhNo,
                  status: mapStatusFromJSON(a.status),
                  invalidReason: a.invalidReason || "NA"
                })))
              : null,
            ganot: detail.hukamType === "ALT Krushipanch" ? detail.ganotType : null,
          };

          const { data: nondhDetailResult, error: nondhDetailsError } = await LandRecordService.createNondhDetail(nondhDetailData);
          
          if (nondhDetailsError) {
            skippedNondhDetails.push(`Nondh ${detail.nondhNumber || 'unknown'}: Database error - ${nondhDetailsError.message}`);
            continue;
          }

          if (nondhDetailResult) {
            const savedDetail = Array.isArray(nondhDetailResult) ? nondhDetailResult[0] : nondhDetailResult;
            
            savedNondhDetailsWithIds.push({
              ...savedDetail,
              originalDetail: detail,
              nondhNumber: detail.nondhNumber,
              mappedStatus: mappedStatus,
              isValid: true
            });
            
            validNondhDetails.push(savedDetail);
          }
        }

        // Apply validity chain to saved details
        const detailsWithValidityChain = processValidityChain(
          savedNondhDetailsWithIds,
          sortedNondhs
        );

        // Step 4: Save owner relations with validity chain applied
        for (const nondhDetail of detailsWithValidityChain) {
          const originalDetail = nondhDetail.originalDetail;
          if (!originalDetail) continue;

          // Process regular owners
          if (originalDetail.owners && originalDetail.owners.length > 0) {
            for (const owner of originalDetail.owners) {
              const area = parseArea(owner.area);
              const { error } = await LandRecordService.createNondhOwnerRelation({
                nondh_detail_id: nondhDetail.id,
                owner_name: owner.name,
                square_meters: area.value,
                area_unit: area.unit,
                survey_number: owner.surveyNumber || null,
                survey_number_type: owner.surveyNumberType || null,
                is_valid: nondhDetail.isValid
              });
              
              if (!error) totalOwnersInserted++;
            }
          }

          // Process new owners for transfer types
          if (originalDetail.newOwners && originalDetail.newOwners.length > 0) {
            for (const newOwner of originalDetail.newOwners) {
              const area = parseArea(newOwner.area);
              const { error } = await LandRecordService.createNondhOwnerRelation({
                nondh_detail_id: nondhDetail.id,
                owner_name: newOwner.name,
                square_meters: area.value,
                area_unit: area.unit,
                survey_number: newOwner.surveyNumber || null,
                survey_number_type: newOwner.surveyNumberType || null,
                is_valid: nondhDetail.isValid
              });
              
              if (!error) totalOwnersInserted++;
            }
          }
        }
      }

      const stats = {
        yearSlabs: 0, // Not implemented in this upload flow
        panipatraks: 0, // Not implemented in this upload flow
        farmers: 0, // Not implemented in this upload flow
        nondhs: savedNondhs.length,
        nondhDetails: validNondhDetails.length,
        totalOwners: totalOwnersInserted,
        skippedNondhDetails: skippedNondhDetails.length
      };

      if (skippedNondhDetails.length > 0) {
        setErrors(["Skipped nondh details:", ...skippedNondhDetails]);
      }

      setResult({
  success: true,
  message: (fromEdit || fromView)
    ? 'Nondh data added successfully to existing record' 
    : 'Land record uploaded and processed successfully',
  stats,
  landRecordId
});

// Route back to edit page if coming from edit mode
if (fromEdit && landRecordId) {
  setTimeout(() => {
    router.push(`/land-master/forms?mode=edit&id=${landRecordId}&step=4`);
  }, 2000); // Give user time to see success message
}

// Route back to view page if coming from view mode
if (fromView && landRecordId) {
  setTimeout(() => {
    router.push(`/land-master/forms?mode=view&id=${landRecordId}&step=4`);
  }, 2000); // Give user time to see success message
}

    } catch (error) {
      console.error('Upload error:', error);
      setErrors([error.message || 'An unexpected error occurred']);
      setResult({ success: false, message: 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') {
        setErrors(['Please upload a valid JSON file']);
        return;
      }
      setFile(selectedFile);
      setErrors([]);
      setResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          processUpload(jsonData);
        } catch (error) {
          setErrors(['Invalid JSON format. Please check your file and try again.']);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileJson className="w-6 h-6" />
            Bulk Land Record Upload
          </h2>
          <button
            onClick={downloadSampleJSON}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Sample JSON
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Instructions
          </h3>
          <ul className="space-y-1 text-sm">
            {/* <li>• <strong>Year Matching:</strong> Panipatrak year is automatically matched to correct year slab</li>
            <li>• <strong>Farmer Types:</strong> 
              <ul className="ml-4 mt-1">
                <li>- Regular farmers: No paikyNumber or ekatrikaranNumber needed</li>
                <li>- Paiky farmers: Provide only paikyNumber (positive integer)</li>
                <li>- Ekatrikaran farmers: Provide only ekatrikaranNumber (positive integer)</li>
                <li>- Cannot have both numbers for same farmer</li>
              </ul>
            </li> */}
            <li>• <strong>Status Mapping:</strong> Use "Pramaanik" for valid, "Radd" for invalid, "Na Manjoor" for nullified</li>
            <li>• <strong>Validation:</strong> Each nondh detail validated individually - failures are skipped with reason shown</li>
            <li>• <strong>Validity Chain:</strong> Automatically applied based on sorted nondh order and invalid status</li>
            <li>• <strong>Nondh Types:</strong> Supports all types with type-specific fields</li>
            <li>• <strong>Foreign Keys:</strong> All relationships are automatically set</li>
            <li>• <strong>Area format:</strong> Provide either sqm OR acre + guntha</li>
            <li>• <strong>Date format:</strong> All dates must be in ddmmyyyy format</li>
          </ul>
          {(fromEdit || fromView) && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
    <h3 className="font-semibold mb-2">Edit Mode Active</h3>
    <p className="text-sm">
      You're uploading to an existing land record. Only nondhs and nondh details from the JSON will be added.
      The JSON's basic info must match the existing record (district, taluka, village, survey numbers).
    </p>
  </div>
)}
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            id="json-upload"
            disabled={loading}
          />
          <label
            htmlFor="json-upload"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <Upload className="w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium">
                {file ? file.name : 'Click to upload JSON file'}
              </p>
              <p className="text-sm text-gray-500">or drag and drop</p>
            </div>
          </label>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-lg mb-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing land record with validity chain and individual nondh detail validation...</span>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Validation Errors ({errors.length})
            </h3>
            <ul className="space-y-1 max-h-60 overflow-y-auto">
              {errors.map((error, index) => (
                <li key={index} className="text-sm text-red-700">
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result?.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {result.message}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm mb-3">
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Year Slabs</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.yearSlabs}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Panipatraks</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.panipatraks}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Total Farmers</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.farmers}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Nondhs</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.nondhs}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Nondh Details</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.nondhDetails}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-gray-500 text-xs">Total Owners</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.stats.totalOwners}
                </div>
              </div>
            </div>
            <div className="bg-white rounded p-3 mb-3">
              <div className="text-gray-500 text-xs">Skipped Nondh Details</div>
              <div className="text-2xl font-bold text-amber-600">
                {result.stats.skippedNondhDetails}
              </div>
            </div>
            <div className="text-xs text-gray-600 bg-white p-2 rounded">
              <strong>Land Record ID:</strong> {result.landRecordId}
            </div>
          </div>
        )}

        <div className="mt-6">
          <details className="bg-gray-50 rounded-lg p-4">
            <summary className="cursor-pointer font-semibold mb-2">
              View Complete Sample JSON Structure (All Nondh Types)
            </summary>
            <pre className="mt-3 text-xs overflow-x-auto bg-white p-3 rounded border max-h-96">
              {JSON.stringify(sampleJSON, null, 2)}
            </pre>
          </details>
        </div>
{/* 
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-amber-800">Database Relationships</h3>
          <div className="text-sm space-y-2">
            <p><strong>Foreign Key Mapping:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• <code>yearslab_id</code> in panipatraks → year_slabs table</li>
              <li>• <code>nondh_id</code> in nondh_details → nondhs table</li>
              <li>• <code>nondh_detail_id</code> in nondh_owner_relations → nondh_details table</li>
              <li>• <code>land_record_id</code> in all tables → land_records table</li>
            </ul>
            <p className="text-xs text-amber-700 mt-2">
              All foreign keys are automatically populated during the upload process.
            </p>
          </div>
        </div>

        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-purple-800">Validity Chain Processing</h3>
          <div className="text-sm space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• Nondhs are sorted by S.No type priority (s_no → block_no → re_survey_no) then by nondh number</li>
              <li>• For each nondh, counts how many subsequent nondhs have "Radd" (invalid) status</li>
              <li>• If affected by ODD number of invalid nondhs → owners marked as invalid</li>
              <li>• If affected by EVEN number (or zero) of invalid nondhs → owners marked as valid</li>
              <li>• Owner validity is automatically set based on this chain calculation</li>
            </ul>
            <p className="text-xs text-purple-700 mt-2">
              Example: If Nondh 1 and 2 are Pramaanik, but Nondh 3 (which comes after them) is Radd, then BOTH Nondh 1 and Nondh 2's owners will be marked invalid due to the validity chain (1 invalid nondh = odd count = invalid). If Nondh 4 is also Radd, then Nondh 1 and 2's owners become valid again (2 invalid nondhs = even count = valid).
            </p>
          </div>
        </div> */}
      </div>
      {/* Duplicate Record Dialog */}
{showDuplicateDialog && duplicateRecord && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-yellow-600">Duplicate Land Record Found</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>A land record with the same details already exists:</p>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p><strong>District:</strong> {duplicateRecord.district}</p>
            <p><strong>Taluka:</strong> {duplicateRecord.taluka}</p>
            <p><strong>Village:</strong> {duplicateRecord.village}</p>
            <p><strong>Block No:</strong> {duplicateRecord.block_no}</p>
            {duplicateRecord.re_survey_no && (
              <p><strong>Re-Survey No:</strong> {duplicateRecord.re_survey_no}</p>
            )}
          </div>
          <p className="mt-3">Please modify your JSON file with different land information and upload again.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleNavigateToDuplicate('view')}
          >
            View Existing Record
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleNavigateToDuplicate('edit')}
          >
            Edit Existing Record
          </Button>
        </div>

        <div className="pt-2">
          <Button
            variant="default"
            className="w-full"
            onClick={handleCloseDuplicateDialog}
          >
            Close & Upload New JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)}
    </div>
  );
};

const LandRecordJSONUpload = () => {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center gap-3 p-8">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span>Loading...</span>
            </div>
          </div>
        </div>
      }>
        <LandRecordJSONUploadContent />
      </Suspense>
    </AuthProvider>
  );
};

export default LandRecordJSONUpload;
