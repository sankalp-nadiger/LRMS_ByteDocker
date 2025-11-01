"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Upload
} from "lucide-react";
import {
  useLandRecord,
  YearSlab,
  SlabEntry,
} from "@/contexts/land-record-context";
import { useToast } from "@/hooks/use-toast";
import { convertToSquareMeters, convertFromSquareMeters, createActivityLog } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/supabase";
import { LandRecordService } from "@/lib/supabase";
import { useStepFormData } from "@/hooks/use-step-form-data";
import { useUser } from "@clerk/nextjs";

// ---------- UI-only Types ----------
type SNoTypeUI = "survey_no" | "block_no" | "re_survey_no";
type AreaTypeUI = "acre_guntha" | "sq_m";

interface AreaUI {
  areaType: AreaTypeUI;
  acre?: number;
  guntha?: number;
  sq_m?: number;
}
interface SlabEntryUI {
  sNoTypeUI: SNoTypeUI;
  sNo: string;
  areaUI: AreaUI;
  integrated712?: string;
}
interface YearSlabUI {
  id: string;
    startYear: number | "";  
  endYear: number;
  sNoTypeUI: SNoTypeUI;
  sNo: string;
  areaUI: AreaUI;
  integrated712?: string;
  paiky: boolean;
  paikyCount: number;
  paikyEntries: SlabEntryUI[];
  ekatrikaran: boolean;
  ekatrikaranCount: number;
  ekatrikaranEntries: SlabEntryUI[];
  collapsed: boolean;
}

// ---------- End Types ----------

const SNO_TYPES = [
  { key: "survey_no", label: "Survey No." },
  { key: "block_no", label: "Block No." },
  { key: "re_survey_no", label: "Re-Survey No." },
] as const;
const AREA_TYPES = [
  { key: "acre_guntha", label: "Acre - Guntha" },
  { key: "sq_m", label: "Sq. Mtr." },
] as const;

// ---------- TYPE MAPPINGS ----------

// Explicit mapping from UI to context type
function mapSNoTypeUIToContext(
  s: SNoTypeUI
): "s_no" | "block_no" | "re_survey_no" {
  switch (s) {
    case "survey_no":
      return "s_no";
    case "block_no":
      return "block_no";
    case "re_survey_no":
      return "re_survey_no";
  }
}

// Explicit mapping from context to UI type
function mapSNoTypeContextToUI(s: "s_no" | "block_no" | "re_survey_no"): SNoTypeUI {
  switch (s) {
    case "s_no":
      return "survey_no";
    case "block_no":
      return "block_no";
    case "re_survey_no":
      return "re_survey_no";
  }
}

// Helper to determine which field to use from landBasicInfo
function getAutoPopulatedSNoData(landBasicInfo: any, selectedType: SNoTypeUI): string {
  if (!landBasicInfo) return "";
  
  switch(selectedType) {
    case "survey_no":
      // Only return sNo for survey_no, no fallback to blockNo
      return landBasicInfo.sNo || "";
    case "block_no":
      // Only return blockNo for block_no
      return landBasicInfo.blockNo || "";
    case "re_survey_no":
      // Only return reSurveyNo for re_survey_no
      return landBasicInfo.reSurveyNo || "";
    default:
      return "";
  }
}
// Convert from UI-area to context-area
function fromAreaUI(areaUI: AreaUI): { value: number; unit: "sq_m" | "acre" | "guntha" } {
  if (areaUI.areaType === "sq_m") {
    return {
      value: areaUI.sq_m || 0,
      unit: "sq_m"
    };
  } else {
    // For acre_guntha, we need to store them separately
    if (areaUI.acre && areaUI.acre > 0) {
      return {
        value: areaUI.acre,
        unit: "acre"
      };
    } else if (areaUI.guntha && areaUI.guntha > 0) {
      return {
        value: areaUI.guntha,
        unit: "guntha"
      };
    }
    return { value: 0, unit: "sq_m" }; // Default fallback
  }
}

function toAreaUI(area?: { value: number; unit: "sq_m" | "acre" | "guntha" }): AreaUI {
  if (!area) {
    return { areaType: "acre_guntha", acre: 0, guntha: 0 };
  }

  if (area.unit === "sq_m") {
    return {
      areaType: "sq_m",
      sq_m: area.value,
      acre: convertFromSquareMeters(area.value, "acre"),
      guntha: convertFromSquareMeters(area.value, "guntha") % 40
    };
  } else if (area.unit === "acre") {
    return {
      areaType: "acre_guntha",
      acre: area.value,
      guntha: 0,
      sq_m: convertToSquareMeters(area.value, "acre")
    };
  } else { // guntha
    return {
      areaType: "acre_guntha",
      acre: 0,
      guntha: area.value,
      sq_m: convertToSquareMeters(area.value, "guntha")
    };
  }
}
function fromSlabEntryUI(e: SlabEntryUI): SlabEntry {
  return {
    sNo: e.sNo,
    sNoType: mapSNoTypeUIToContext(e.sNoTypeUI),
    area: fromAreaUI(e.areaUI),
    integrated712: e.integrated712,
  };
}
function toSlabEntryUI(e: SlabEntry): SlabEntryUI {
  return {
    sNo: e.sNo,
    sNoTypeUI: mapSNoTypeContextToUI(e.sNoType),
    areaUI: toAreaUI(e.area),
    integrated712: e.integrated712,
  };
}
function fromYearSlabUI(s: YearSlabUI): YearSlab {
  return {
    ...s,
    sNo: s.sNo,
    sNoType: mapSNoTypeUIToContext(s.sNoTypeUI),
    area: fromAreaUI(s.areaUI),
    paikyEntries: (s.paikyEntries || []).map(fromSlabEntryUI),
    ekatrikaranEntries: (s.ekatrikaranEntries || []).map(fromSlabEntryUI),
  };
}
function toYearSlabUI(s: YearSlab): YearSlabUI {
  return {
    ...s,
    sNoTypeUI: mapSNoTypeContextToUI(s.sNoType),
    areaUI: toAreaUI(s.area),
    paikyEntries: (s.paikyEntries ?? []).map(toSlabEntryUI),
    ekatrikaranEntries: (s.ekatrikaranEntries ?? []).map(toSlabEntryUI),
  };
}

// ---------- MAIN COMPONENT ----------
export default function YearSlabs() {
  const { 
    yearSlabs, 
    setYearSlabs, 
    setCurrentStep, 
    landBasicInfo, 
    currentStep 
  } = useLandRecord();
  const { toast } = useToast();
  const { user } = useUser();
  
  // Add this hook
  const { 
    getStepData, 
    updateStepData, 
    markAsSaved,
    hasUnsavedChanges
  } = useStepFormData(2);
  const [loading, setLoading] = useState(false);
  const [currentPaikyPage, setCurrentPaikyPage] = useState<Record<string, number>>({});
const PAIKY_PER_PAGE = 5;
  const [slabs, setSlabs] = useState<YearSlabUI[]>([]);
   const [uploadedFileName, setUploadedFileName] = useState<string>("");
   const [currentEkatrikaranPage, setCurrentEkatrikaranPage] = useState<Record<string, number>>({});
const EKATRIKARAN_PER_PAGE = 5;
const [activeTab, setActiveTab] = useState<Record<string, 'main' | 'paiky' | 'ekatrikaran'>>({});
const [slabUploadedFileNames, setSlabUploadedFileNames] = useState<Record<string, string>>({});
const [entryUploadedFileNames, setEntryUploadedFileNames] = useState<Record<string, string>>({});
const [initialLoading, setInitialLoading] = useState(true);
interface ValidationErrors {
  [slabId: string]: {
    startYear?: string
    sNo?: string
    integrated712?: string
    paikyEntries?: { [index: number]: { sNo?: string; integrated712?: string } }
    ekatrikaranEntries?: { [index: number]: { sNo?: string; integrated712?: string } }
  }
}

const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

// Helper function
const extractFilenameFromUrl = (url: string): string => {
  if (!url) return '';
  try {
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    // Remove timestamp prefix if it exists (timestamp_originalfilename)
    const match = filename.match(/^\d+_(.+)$/);
    return match ? match[1] : filename;
  } catch {
    return '';
  }
};

 const handleEntryFileUpload = async (
  file: File,
  slabId: string,
  entryType?: 'paiky' | 'ekatrikaran',
  entryIndex?: number
) => {
  if (!file) return;
  
  try {
    setLoading(true);
    
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
    
    const path = `year-slabs/${timestamp}_${sanitizedFileName}`;
    const url = await uploadFile(file, "land-documents", path);
    
    if (!url) throw new Error("Upload failed");
    
    if (entryType && entryIndex !== undefined) {
      // Update specific entry
      updateSlabEntry(slabId, entryType, entryIndex, {
        integrated712: url
      });
      
      // Track filename for this specific entry
      setEntryUploadedFileNames(prev => ({
        ...prev,
        [`${slabId}_${entryType}_${entryIndex}`]: file.name
      }));
    } else {
      // Update main slab
      updateSlab(slabId, {
        integrated712: url
      });
      
      // Track filename for main slab
      setSlabUploadedFileNames(prev => ({
        ...prev,
        [slabId]: file.name
      }));
    }
    
    toast({ 
      title: "File uploaded successfully",
      description: "Document saved"
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    toast({ 
      title: "Upload failed", 
      description: error.message,
      variant: "destructive" 
    });
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  const loadData = async () => {
    try {
      setInitialLoading(true);
      if (!slabs.length) {
        setSlabs([{
          id: "1",
          startYear: 1900,
          endYear: 2004,
          sNoTypeUI: "block_no",
          sNo: getAutoPopulatedSNoData(landBasicInfo, "block_no"),
          areaUI: landBasicInfo?.area ? toAreaUI(landBasicInfo.area) : { 
            areaType: "acre_guntha", 
            acre: 0, 
            guntha: 0 
          },
          integrated712: "",
          paiky: false,
          paikyCount: 0,
          paikyEntries: [],
          ekatrikaran: false,
          ekatrikaranCount: 0,
          ekatrikaranEntries: [],
          collapsed: false
        }]);
        
      }
      const stepData = getStepData();
      
      if (stepData?.slabUploadedFileNames) {
        setSlabUploadedFileNames(stepData.slabUploadedFileNames);
      }
      if (stepData?.entryUploadedFileNames) {
        setEntryUploadedFileNames(stepData.entryUploadedFileNames);
      }
      
      if (landBasicInfo?.id) {
        const { data: dbSlabs, error } = await LandRecordService.getYearSlabs(landBasicInfo.id);
        
        if (!error && dbSlabs) {
          const uiSlabs = dbSlabs.map(s => ({
            ...toYearSlabUI(s),
            collapsed: false
          }));
          
          setSlabs(uiSlabs);
          
          // Extract filenames from database data
const newSlabFileNames = {};
const newEntryFileNames = {};

uiSlabs.forEach(slab => {
  // Extract filename for main slab document
  if (slab.integrated712) {
    const filename = extractFilenameFromUrl(slab.integrated712);
    if (filename) {
      newSlabFileNames[slab.id] = filename;
    }
  }
  
  // Extract filenames for paiky entries
  slab.paikyEntries?.forEach((entry, index) => {
    if (entry.integrated712) {
      const filename = extractFilenameFromUrl(entry.integrated712);
      if (filename) {
        newEntryFileNames[`${slab.id}_paiky_${index}`] = filename;
      }
    }
  });
  
  // Extract filenames for ekatrikaran entries
  slab.ekatrikaranEntries?.forEach((entry, index) => {
    if (entry.integrated712) {
      const filename = extractFilenameFromUrl(entry.integrated712);
      if (filename) {
        newEntryFileNames[`${slab.id}_ekatrikaran_${index}`] = filename;
      }
    }
  });
});

// Merge with existing filename states
setSlabUploadedFileNames(prev => ({ ...newSlabFileNames, ...prev }));
setEntryUploadedFileNames(prev => ({ ...newEntryFileNames, ...prev }));
        }
      }
    } finally {
      setInitialLoading(false);
    }
  };

  loadData();
}, [landBasicInfo]);

useEffect(() => {
  if (slabs.length > 0) {
    const hasContent = slabs.some(slab => 
      (slab.sNo && slab.sNo.trim() !== "") || 
      slab.startYear !== "" ||
      slab.paikyEntries.length > 0 ||
      slab.ekatrikaranEntries.length > 0
    );
    
    if (hasContent || slabs.length > 1) {
      const timeoutId = setTimeout(() => {
        updateStepData({ 
          yearSlabs: slabs.map(fromYearSlabUI),
          slabUploadedFileNames, // Save slab filenames
          entryUploadedFileNames // Save entry filenames
        });
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }
}, [slabs, slabUploadedFileNames, entryUploadedFileNames, updateStepData]);

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges[currentStep]) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [hasUnsavedChanges, currentStep]);

  // --- UI rendering helpers ---
const areaFields = ({ area, onChange }: { area?: AreaUI; onChange: (a: AreaUI) => void }) => {
  const workingArea = area || { areaType: "acre_guntha", acre: 0, guntha: 0, sq_m: 0 };
  
  const SQM_PER_GUNTHA = 101.17;
  const SQM_PER_ACRE = 4046.86;

  const convertToSquareMeters = (value: number, unit: string) => {
    if (unit === "acre") return value * SQM_PER_ACRE;
    if (unit === "guntha") return value * SQM_PER_GUNTHA;
    return value;
  };

  const convertFromSquareMeters = (sqm: number, unit: string) => {
    if (unit === "acre") return sqm / SQM_PER_ACRE;
    if (unit === "guntha") return sqm / SQM_PER_GUNTHA;
    return sqm;
  };

  // Always derive from sq_m
  const sqmValue = workingArea.sq_m || 0;
  const displayValues = {
    sq_m: Math.round(sqmValue * 100) / 100,
    acre: Math.floor(convertFromSquareMeters(sqmValue, "acre")),
    guntha: Math.round(convertFromSquareMeters(sqmValue, "guntha") % 40)
  };

  const handleSqmChange = (value: string) => {
    if (value === "") {
      onChange({
        ...workingArea,
        sq_m: 0,
        acre: 0,
        guntha: 0
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const totalAcres = convertFromSquareMeters(num, "acre");
      const acres = Math.floor(totalAcres);
      const remainingGuntha = Math.round((totalAcres - acres) * 40);
      
      onChange({
        ...workingArea,
        sq_m: num,
        acre: acres,
        guntha: remainingGuntha
      });
    }
  };

  const handleAcreChange = (value: string) => {
    if (value === "") {
      const remainingSqm = displayValues.guntha ? Math.round(convertToSquareMeters(displayValues.guntha, "guntha") * 100) / 100 : 0;
      onChange({
        ...workingArea,
        sq_m: remainingSqm,
        acre: 0,
        guntha: displayValues.guntha
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const guntha = displayValues.guntha || 0;
      const totalSqm = Math.round((convertToSquareMeters(num, "acre") + 
                      convertToSquareMeters(guntha, "guntha")) * 100) / 100;
      onChange({ 
        ...workingArea, 
        sq_m: totalSqm,
        acre: num,
        guntha: guntha
      });
    }
  };

  const handleGunthaChange = (value: string) => {
    if (value === "") {
      const remainingSqm = displayValues.acre ? Math.round(convertToSquareMeters(displayValues.acre, "acre") * 100) / 100 : 0;
      onChange({
        ...workingArea,
        sq_m: remainingSqm,
        guntha: 0,
        acre: displayValues.acre
      });
      return;
    }

    let num = parseFloat(value);
    if (!isNaN(num)) {
      if (num >= 40) {
        num = 39;
      }
      
      const acre = displayValues.acre || 0;
      const totalSqm = Math.round((convertToSquareMeters(acre, "acre") + 
                      convertToSquareMeters(num, "guntha")) * 100) / 100;
      onChange({ 
        ...workingArea, 
        sq_m: totalSqm,
        guntha: num,
        acre: acre
      });
    }
  };

  const formatValue = (value: number | undefined): string => {
    return value === undefined ? "" : value.toString();
  };

  return (
    <div className="space-y-4">
      {/* Area Type selector commented out */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Content commented out */}
      </div>

      {workingArea.areaType === "sq_m" ? (
        <div className="space-y-2">
          <Label>Square Meters</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={formatValue(displayValues.sq_m)}
            onChange={(e) => handleSqmChange(e.target.value)}
            placeholder="Enter sq. meters"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Acres</Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={formatValue(displayValues.acre)}
              onChange={(e) => handleAcreChange(e.target.value)}
              placeholder="Enter acres"
            />
          </div>
          <div className="space-y-2">
            <Label>Guntha</Label>
            <Input
              type="number"
              min={0}
              max={39.99}
              step="1"
              value={formatValue(displayValues.guntha)}
              onChange={(e) => handleGunthaChange(e.target.value)}
              placeholder="Enter guntha (≤40)"
              onKeyDown={(e) => {
                const target = e.target as HTMLInputElement;
                if (e.key === 'e' || 
                    (e.key === '.' && target.value.includes('.')) ||
                    (parseFloat(target.value + e.key) >= 40)) {
                  e.preventDefault();
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {workingArea.areaType === "sq_m" ? (
          <>
            <div className="space-y-2">
              <Label>Acres</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={formatValue(displayValues.acre)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter or view acres"
                className="bg-blue-50 border-blue-200"
              />
            </div>
            <div className="space-y-2">
              <Label>Guntha</Label>
              <Input
                type="number"
                min={0}
                max={39.99}
                step="1"
                value={formatValue(displayValues.guntha)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter guntha (≤40)"
                className="bg-blue-50 border-blue-200"
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === 'e' || 
                      (e.key === '.' && target.value.includes('.')) ||
                      (parseFloat(target.value + e.key) >= 40)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter or view sq. meters"
              className="bg-blue-50 border-blue-200"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const validateForm = (): boolean => {
  const errors: ValidationErrors = {};
  let isValid = true;
  const errorMessages: string[] = [];

  slabs.forEach((slab, slabIndex) => {
    const slabErrors: any = {};
    const slabNumber = slabIndex + 1;

    if (slab.startYear === "" || slab.startYear === undefined) {
      slabErrors.startYear = "Please enter start year";
      errorMessages.push(`Slab ${slabNumber}: Missing start year`);
      isValid = false;
    }

    if (!slab.sNo.trim()) {
      slabErrors.sNo = "Please enter S.No/Block No/Re-Survey No";
      errorMessages.push(`Slab ${slabNumber}: Missing S.No/Block No/Re-Survey No`);
      isValid = false;
    }

    // Validate main slab document upload - ONLY if no paiky/ekatrikaran
    if (!slab.paiky && !slab.ekatrikaran && !slab.integrated712) {
      slabErrors.integrated712 = "Please upload 7/12 document for this slab";
      errorMessages.push(`Slab ${slabNumber}: Missing 7/12 document`);
      isValid = false;
    }

    // Validate paiky entries
    if (slab.paiky && slab.paikyEntries && slab.paikyEntries.length > 0) {
      const paikyErrors: { [index: number]: { sNo?: string; integrated712?: string } } = {};
      slab.paikyEntries.forEach((entry, index) => {
        const entryErrors: any = {};
        const entryNumber = index + 1;
        
        if (!entry || !entry.sNo || !entry.sNo.trim()) {
          entryErrors.sNo = "Please enter S.No";
          errorMessages.push(`Slab ${slabNumber}, Paiky Entry ${entryNumber}: Missing S.No`);
          isValid = false;
        }
        if (!entry || !entry.integrated712) {
          entryErrors.integrated712 = "Please upload 7/12 document";
          errorMessages.push(`Slab ${slabNumber}, Paiky Entry ${entryNumber}: Missing 7/12 document`);
          isValid = false;
        }
        if (Object.keys(entryErrors).length > 0) {
          paikyErrors[index] = entryErrors;
        }
      });
      if (Object.keys(paikyErrors).length > 0) {
        slabErrors.paikyEntries = paikyErrors;
      }
    }

    // Validate ekatrikaran entries
    if (slab.ekatrikaran && slab.ekatrikaranEntries && slab.ekatrikaranEntries.length > 0) {
      const ekatrikaranErrors: { [index: number]: { sNo?: string; integrated712?: string } } = {};
      slab.ekatrikaranEntries.forEach((entry, index) => {
        const entryErrors: any = {};
        const entryNumber = index + 1;
        
        if (!entry || !entry.sNo || !entry.sNo.trim()) {
          entryErrors.sNo = "Please enter S.No";
          errorMessages.push(`Slab ${slabNumber}, Ekatrikaran Entry ${entryNumber}: Missing S.No`);
          isValid = false;
        }
        if (!entry || !entry.integrated712) {
          entryErrors.integrated712 = "Please upload 7/12 document";
          errorMessages.push(`Slab ${slabNumber}, Ekatrikaran Entry ${entryNumber}: Missing 7/12 document`);
          isValid = false;
        }
        if (Object.keys(entryErrors).length > 0) {
          ekatrikaranErrors[index] = entryErrors;
        }
      });
      if (Object.keys(ekatrikaranErrors).length > 0) {
        slabErrors.ekatrikaranEntries = ekatrikaranErrors;
      }
    }

    if (Object.keys(slabErrors).length > 0) {
      errors[slab.id] = slabErrors;
    }
  });

  setValidationErrors(errors);
  
  // Show detailed error message in toast
  if (!isValid && errorMessages.length > 0) {
    const detailedMessage = errorMessages.slice(0, 3).join('; ') + 
      (errorMessages.length > 3 ? `; and ${errorMessages.length - 3} more issues` : '');
    
    setTimeout(() => {
      toast({
        title: "Validation Failed",
        description: detailedMessage,
        variant: "destructive"
      });
    }, 100);
  }
  
  return isValid;
};

const validateYearOrder = (slabs: YearSlabUI[]) => {
  for (let i = 1; i < slabs.length; i++) {
    // Current slab's end year must be ≤ previous slab's start year
    if (slabs[i].endYear > slabs[i-1].startYear) {
      return {
        valid: false,
        message: `Slab ${i+1} (${slabs[i].startYear}-${slabs[i].endYear}) must end before Slab ${i} (${slabs[i-1].startYear}-${slabs[i-1].endYear}) starts`
      };
    }
    
    // Within each slab, start year should be ≥ end year
    if (slabs[i].startYear > slabs[i].endYear) {
      return {
        valid: false,
        message: `Slab ${i+1}: Start year (${slabs[i].startYear}) must be ≥ end year (${slabs[i].endYear})`
      };
    }
  }
  return { valid: true };
};

const updateSlab = (id: string, updates: Partial<YearSlabUI>) => {
  setSlabs(prev => {
    const newSlabs = [...prev];
    const index = newSlabs.findIndex(s => s.id === id);
    
    if (index === -1) return newSlabs;

    // Handle S.No type changes
    if (updates.sNoTypeUI && updates.sNoTypeUI !== newSlabs[index].sNoTypeUI) {
      const autoPopulatedSNo = getAutoPopulatedSNoData(landBasicInfo, updates.sNoTypeUI);
      updates = {
        ...updates,
        sNo: autoPopulatedSNo
      };
    }

    // Update current slab
    newSlabs[index] = { ...newSlabs[index], ...updates };

// Clear validation errors for updated fields
if (updates.startYear !== undefined || updates.sNo !== undefined || updates.integrated712 !== undefined) {
  setValidationErrors(prev => {
    const newErrors = { ...prev };
    if (newErrors[id]) {
      if (updates.startYear !== undefined) delete newErrors[id].startYear;
      if (updates.sNo !== undefined) delete newErrors[id].sNo;
      if (updates.integrated712 !== undefined) delete newErrors[id].integrated712;
    }
    return newErrors;
  });
}

    // If start year changed, update NEXT slab's end year
    if (updates.startYear !== undefined && index < newSlabs.length - 1) {
      newSlabs[index + 1] = {
        ...newSlabs[index + 1],
        endYear: updates.startYear
      };
    }

    return newSlabs;
  });
};

const addSlab = () => {
  // Determine default area based on previous slab
let defaultArea;
if (yearSlabs.length === 0) {
  // First slab - use landBasicInfo area or default to 0
  defaultArea = landBasicInfo?.area ? toAreaUI(landBasicInfo.area) : { areaType: "sq_m" as AreaTypeUI, sq_m: 0 };
} else {
  const previousSlab = toYearSlabUI(yearSlabs[yearSlabs.length - 1]);
  
  // Check if previous slab has paiky or ekatrikaran entries
  const hasPaikyEntries = previousSlab.paiky && previousSlab.paikyEntries && previousSlab.paikyEntries.length > 0;
  const hasEkatrikaranEntries = previousSlab.ekatrikaran && previousSlab.ekatrikaranEntries && previousSlab.ekatrikaranEntries.length > 0;
  
  if (hasPaikyEntries || hasEkatrikaranEntries) {
    // Previous slab has sub-entries, so don't copy area - use default 0
    defaultArea = { areaType: "sq_m" as AreaTypeUI, sq_m: 0 };
  } else {
    // Previous slab has no sub-entries, copy its area
    defaultArea = previousSlab.areaUI;
  }
}

  let startYear, endYear;
  
  // Calculate years based on existing slabs
  if (slabs.length === 0) {
    startYear = 1900;
    endYear = 2004;
  } else {
    const previousSlab = slabs[slabs.length - 1];
    endYear = previousSlab.startYear;
    startYear = "";
  }

  const newSlabId = Date.now().toString();
  
  // Check if previous slab has ekatrikaran entries to copy
  const previousSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null;
  const shouldCopyEkatrikaran = previousSlab?.ekatrikaran && previousSlab?.ekatrikaranEntries?.length > 0;
  
  const newSlab: YearSlabUI = {
    id: newSlabId,
    startYear,
    endYear,
    sNoTypeUI: "block_no",
    sNo: getAutoPopulatedSNoData(landBasicInfo, "block_no"),
    areaUI: defaultArea,
    integrated712: "",
    paiky: false,
    paikyCount: 0,
    paikyEntries: [],
    // Copy ekatrikaran settings from previous slab
    ekatrikaran: shouldCopyEkatrikaran,
    ekatrikaranCount: shouldCopyEkatrikaran ? previousSlab.ekatrikaranCount : 0,
    ekatrikaranEntries: shouldCopyEkatrikaran 
      ? previousSlab.ekatrikaranEntries.map(entry => ({
          ...entry,
          integrated712: "" // Reset document upload
        }))
      : [],
    collapsed: false,
  };

  setSlabs([...slabs, newSlab]);
  
  // Set active tab if ekatrikaran was copied
  if (shouldCopyEkatrikaran) {
    setActiveTab(prev => ({ ...prev, [newSlabId]: 'ekatrikaran' }));
  }
};

  const removeSlab = (id: string) => {

    setSlabs(slabs.filter((slab) => slab.id !== id));
  };

  // "Count" updating helpers
  const updatePaikyCount = (slabId: string, count: number) => {
  setSlabs(prev => prev.map(slab => {
    if (slab.id !== slabId) return slab;
    
    const defaultEntry = {
      sNo: getAutoPopulatedSNoData(landBasicInfo, "block_no"),
      sNoTypeUI: "block_no" as SNoTypeUI,
      areaUI: { areaType: "sq_m" as AreaTypeUI, sq_m: 0 }, // Changed to sq_m default
      integrated712: ""
    };

    return {
      ...slab,
      paikyCount: count,
      paiky: slab.paiky,
      paikyEntries: Array.from({ length: count }, (_, i) => {
        return slab.paikyEntries?.[i] || { ...defaultEntry };
      })
    };
  }));
};

const updateEkatrikaranCount = (slabId: string, count: number) => {
  setSlabs(prev => prev.map(slab => {
    if (slab.id !== slabId) return slab;
    
    const defaultEntry = {
      sNo: getAutoPopulatedSNoData(landBasicInfo, "block_no"),
      sNoTypeUI: "block_no" as SNoTypeUI,
      areaUI: { areaType: "sq_m" as AreaTypeUI, sq_m: 0 }, // Changed to sq_m default
      integrated712: ""
    };

    return {
      ...slab,
      ekatrikaranCount: count,
      ekatrikaran: slab.ekatrikaran,
      ekatrikaranEntries: Array.from({ length: count }, (_, i) => {
        return slab.ekatrikaranEntries?.[i] || { ...defaultEntry };
      })
    };
  }));
};
  
const updateSlabEntry = (
  slabId: string,
  type: "paiky" | "ekatrikaran",
  index: number,
  updates: Partial<SlabEntryUI>
) => {
  setSlabs(prev => prev.map(slab => {
    if (slab.id !== slabId) return slab;
    
    // Handle S.No type change for entries
    if (updates.sNoTypeUI) {
      const entries = type === 'paiky' ? slab.paikyEntries : slab.ekatrikaranEntries;
      const currentEntry = entries[index] || {};
      
      if (updates.sNoTypeUI !== currentEntry.sNoTypeUI) {
        const autoPopulatedSNo = getAutoPopulatedSNoData(landBasicInfo, updates.sNoTypeUI);
        updates = {
          ...updates,
          sNo: autoPopulatedSNo
        };
      }
    }

   // Clear validation errors for updated entry fields
if (updates.sNo !== undefined || updates.integrated712 !== undefined) {
  setValidationErrors(prev => {
    const newErrors = { ...prev };
    if (newErrors[slabId]?.[`${type}Entries`]?.[index]) {
      if (updates.sNo !== undefined) delete newErrors[slabId][`${type}Entries`][index].sNo;
      if (updates.integrated712 !== undefined) delete newErrors[slabId][`${type}Entries`][index].integrated712;
      
      // Clean up empty objects
      if (Object.keys(newErrors[slabId][`${type}Entries`][index]).length === 0) {
        delete newErrors[slabId][`${type}Entries`][index];
      }
      if (Object.keys(newErrors[slabId][`${type}Entries`]).length === 0) {
        delete newErrors[slabId][`${type}Entries`];
      }
      if (Object.keys(newErrors[slabId]).length === 0) {
        delete newErrors[slabId];
      }
    }
    return newErrors;
  });
}

    if (type === "paiky") {
      const updatedEntries = [...(slab.paikyEntries || [])];
      updatedEntries[index] = { 
        ...(updatedEntries[index] || {}), 
        ...updates 
      };
      return { ...slab, paikyEntries: updatedEntries };
    } else {
      const updatedEntries = [...(slab.ekatrikaranEntries || [])];
      updatedEntries[index] = { 
        ...(updatedEntries[index] || {}), 
        ...updates 
      };
      return { ...slab, ekatrikaranEntries: updatedEntries };
    }
  }));
};

const handleSaveAndNext = async () => {
  setLoading(true);
  
  try {
    // Add debugging
    console.log('Current slabs:', slabs);
    
    if (!validateForm()) {
  console.log('Validation errors:', validationErrors);
  console.log('Current slabs state:', slabs);
  setLoading(false);
  return;
}
    
    // Check for empty start years first
    const emptyStartYears = slabs.filter(slab => slab.startYear === "" || slab.startYear === undefined);
    if (emptyStartYears.length > 0) {
      console.log('Empty start years found:', emptyStartYears);
      toast({ 
        title: "Missing start year", 
        description: "Please fill in start year for all slabs", 
        variant: "destructive" 
      });
      setLoading(false); // Add this missing line
      return;
    }

    // Validate year ordering
    const { valid, message } = validateYearOrder(slabs);
    if (!valid) {
      toast({ title: "Invalid year sequence", description: message, variant: "destructive" });
      return;
    }

    // Convert to database format - Fixed version
    const dbSlabs = slabs.map(slab => ({
      start_year: slab.startYear,
      end_year: slab.endYear,
      s_no: slab.sNo,
      s_no_type: mapSNoTypeUIToContext(slab.sNoTypeUI),
      area_value: slab.areaUI.areaType === "sq_m" 
        ? slab.areaUI.sq_m || 0
        : convertToSquareMeters(slab.areaUI.acre || 0, "acre") +
          convertToSquareMeters(slab.areaUI.guntha || 0, "guntha"),
      area_unit: "sq_m",
      integrated_712: slab.integrated712,
      paiky: slab.paiky,
      paiky_count: slab.paikyCount,
      ekatrikaran: slab.ekatrikaran,
      ekatrikaran_count: slab.ekatrikaranCount,
      
      // Properly structuring the entries arrays
      paiky_entries: slab.paikyEntries?.map(entry => ({
        s_no: entry.sNo,
        s_no_type: mapSNoTypeUIToContext(entry.sNoTypeUI),
        area_value: entry.areaUI.areaType === "sq_m"
          ? entry.areaUI.sq_m || 0
          : convertToSquareMeters(entry.areaUI.acre || 0, "acre") +
            convertToSquareMeters(entry.areaUI.guntha || 0, "guntha"),
        area_unit: "sq_m",
        integrated_712: entry.integrated712
      })) || [], // Ensure it's always an array
      
      ekatrikaran_entries: slab.ekatrikaranEntries?.map(entry => ({
        s_no: entry.sNo,
        s_no_type: mapSNoTypeUIToContext(entry.sNoTypeUI),
        area_value: entry.areaUI.areaType === "sq_m"
          ? entry.areaUI.sq_m || 0
          : convertToSquareMeters(entry.areaUI.acre || 0, "acre") +
            convertToSquareMeters(entry.areaUI.guntha || 0, "guntha"),
        area_unit: "sq_m",
        integrated_712: entry.integrated712
      })) || [] // Ensure it's always an array
    }));

    if (!landBasicInfo?.id) {
      toast({ title: "Land record not found", variant: "destructive" });
      return;
    }

    // Save to database
    const { data: savedData, error } = await LandRecordService.saveYearSlabs(
      landBasicInfo.id,
      dbSlabs
    );
    
    if (error) {
      console.error('Save error details:', error);
      throw error;
    }

    await createActivityLog({
      user_email: user?.primaryEmailAddress?.emailAddress || "",
      land_record_id: landBasicInfo.id,
      step: currentStep,
      chat_id: null,
      description: `Added year slabs: ${dbSlabs.length} slabs configured`
    });

    // Update context
    const { data: fetchedSlabs } = await LandRecordService.getYearSlabs(landBasicInfo.id);
    if (fetchedSlabs) {
      setYearSlabs(fetchedSlabs);
    }

    setCurrentStep(3);
    toast({ title: "Year slabs saved successfully" });
    
  } catch (error) {
    console.error('Save error:', error);
    toast({ 
      title: "Save failed", 
      description: error?.message || "Unknown error occurred",
      variant: "destructive" 
    });
  } finally {
    setLoading(false);
  }
};

const toggleCollapse = (id: string) => {
  setSlabs(prev => prev.map(slab => 
    slab.id === id ? { ...slab, collapsed: !slab.collapsed } : slab
  ));
};

  // --- Render ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Add Year Slabs</CardTitle>
        {landBasicInfo && (
          <div className="text-sm text-muted-foreground">
            Auto-populated from Step 1: {landBasicInfo.district}, {landBasicInfo.taluka}, {landBasicInfo.village}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {initialLoading ? (
          <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {slabs.map((slab, slabIndex) => (
            <Card key={slab.id} className="p-4">
              <div className="flex justify-between items-center mb-4">
  <div className="flex items-center space-x-4">
    <h3 className="text-lg font-semibold">Slab {slabIndex + 1}</h3>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{slab.startYear || '?'}</span>
      <span>-</span>
      <span>{slab.endYear}</span>
    </div>
    <Button 
      variant="ghost" 
      size="sm"
      onClick={() => toggleCollapse(slab.id)}
    >
      {slab.collapsed ? 'Expand' : 'Collapse'}
    </Button>
  </div>
  {slabs.length > 1 && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => removeSlab(slab.id)}
      className="text-red-600"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )}
</div>
    {!slab.collapsed && (
      <>
            {/* Start/End year */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Start Year Field */}
<div className="space-y-2">
  <Label>Start Year *</Label>
<Input
  type="number"
  value={slab.startYear === "" ? "" : slab.startYear}
  onChange={(e) => {
    const value = e.target.value;
    if (value === "") {
      updateSlab(slab.id, { startYear: "" });
    } else {
      const newYear = parseInt(value);
      if (!isNaN(newYear)) {
        updateSlab(slab.id, { startYear: newYear });
      }
    }
  }}
  onWheel={(e) => e.currentTarget.blur()}
  max={slab.endYear}
  className={validationErrors[slab.id]?.startYear ? "border-red-500" : ""}
/>
{validationErrors[slab.id]?.startYear && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].startYear}</p>
)}
  <p className="text-xs text-muted-foreground">
    Must be ≤ end year ({slab.endYear})
  </p>
</div>

{/* End Year Field */}
<div className="space-y-2">
  <Label>End Year *</Label>
  <Input
    type="number"
    value={slab.endYear}
    onChange={(e) => {
      const newYear = parseInt(e.target.value);
      if (!isNaN(newYear)) {
        updateSlab(slab.id, { endYear: newYear });
      }
    }}
    min={slab.startYear}  // Corrected: end ≥ start
    max={
      slabIndex > 0
        ? slabs[slabIndex - 1].startYear  // Must end before previous slab starts
        : undefined
    }
  />
  <div className="flex flex-col gap-1">
    <p className="text-xs text-muted-foreground">
      Must be ≥ start year ({slab.startYear})
    </p>
    {slabIndex > 0 && (
      <p className="text-xs text-muted-foreground">
        Must end before Slab {slabIndex}'s start ({slabs[slabIndex - 1].startYear})
      </p>
    )}
  </div>
</div>
            </div>
            
            {/* S.No and Area and Document - hide if any sub-slab active */}
            {(!slab.paiky && !slab.ekatrikaran) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>S.No Type</Label>
                  <Select
                    value={slab.sNoTypeUI}
                    onValueChange={(value) =>
                      updateSlab(slab.id, { sNoTypeUI: value as SNoTypeUI })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SNO_TYPES.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>S.No / Block No / Re-Survey No *</Label>
                  <Input
  value={slab.sNo}
  onChange={(e) => updateSlab(slab.id, { sNo: e.target.value })}
  placeholder="Enter number"
  className={validationErrors[slab.id]?.sNo ? "border-red-500" : ""}
/>
{validationErrors[slab.id]?.sNo && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].sNo}</p>
)}
                </div>
                <div className="space-y-2">
                  <Label>Area Type</Label>
                  <Select
                    value={slab.areaUI.areaType}
                    onValueChange={(val) =>
                      updateSlab(slab.id, {
                        areaUI: { ...slab.areaUI, areaType: val as AreaTypeUI },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AREA_TYPES.map((a) => (
                        <SelectItem key={a.key} value={a.key}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
        {areaFields({ 
  area: slab.areaUI, 
  onChange: (areaUI) => updateSlab(slab.id, { areaUI }) 
})}

                </div>
                <div className="space-y-2">
  <Label>7/12 Document *</Label>
  <div className="space-y-2">
    <div className="relative">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleEntryFileUpload(file, slab.id);
            e.target.value = '';
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={loading}
      />
      <Button 
        type="button" 
        variant="outline" 
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 w-full"
      >
        <Upload className="w-4 h-4" />
        {loading ? "Uploading..." : "Choose File"}
      </Button>
      {validationErrors[slab.id]?.integrated712 && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].integrated712}</p>
)}
    </div>
    
    {slabUploadedFileNames[slab.id] && (
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-md">
        <span className="text-sm text-green-800 truncate flex-1" title={slabUploadedFileNames[slab.id]}>
          {slabUploadedFileNames[slab.id]}
        </span>
        <button
          type="button"
          onClick={() => {
            updateSlab(slab.id, { integrated712: "" });
            setSlabUploadedFileNames(prev => {
              const newState = { ...prev };
              delete newState[slab.id];
              return newState;
            });
          }}
          className="ml-2 text-green-600 hover:text-green-800 text-lg leading-none flex-shrink-0"
          title="Remove file"
        >
          ×
        </button>
      </div>
    )}
    
    {slab.integrated712 && (
      <a 
        href={slab.integrated712} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        View Document
      </a>
    )}
  </div>
  <p className="text-xs text-gray-500">
    Supported formats: PDF, JPG, JPEG, PNG 
  </p>
</div>
              </div>
            )}
            
            {/* Paiky Section */}
            <div className="border-t pt-6 mb-4">
  <div className="flex justify-center items-center gap-8">
              {/* Paiky Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={slab.paiky}
                  onCheckedChange={(checked) => {
  updateSlab(slab.id, {
    paiky: !!checked,
    paikyCount: checked ? slab.paikyCount : 0,
    paikyEntries: checked ? slab.paikyEntries : []
  });
  setCurrentPaikyPage(prev => ({ ...prev, [slab.id]: 0 }));
  // Set active tab when paiky is enabled
  if (checked) {
    setActiveTab(prev => ({ ...prev, [slab.id]: 'paiky' }));
  } else if (slab.ekatrikaran) {
    setActiveTab(prev => ({ ...prev, [slab.id]: 'ekatrikaran' }));
  }
}}
                />
                <Label>Paiky</Label>
              </div>

              {/* Ekatrikaran Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={slab.ekatrikaran}
                  onCheckedChange={(checked) => {
  updateSlab(slab.id, {
    ekatrikaran: !!checked,
    ekatrikaranCount: checked ? slab.ekatrikaranCount : 0,
    ekatrikaranEntries: checked ? slab.ekatrikaranEntries : []
  });
  setCurrentEkatrikaranPage(prev => ({ ...prev, [slab.id]: 0 }));
  // Set active tab when ekatrikaran is enabled
  if (checked) {
    setActiveTab(prev => ({ ...prev, [slab.id]: 'ekatrikaran' }));
  } else if (slab.paiky) {
    setActiveTab(prev => ({ ...prev, [slab.id]: 'paiky' }));
  }
}}
                />
                <Label>Ekatrikaran</Label>
              </div>
            </div>
            </div>

            {/* Tab Navigation - Show when both are enabled */}
            {slab.paiky && slab.ekatrikaran && (
  <div className="flex space-x-2 border-b">
    <Button
      variant={activeTab[slab.id] === 'paiky' || !activeTab[slab.id] ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveTab(prev => ({ ...prev, [slab.id]: 'paiky' }))}
    >
      Paiky ({slab.paikyCount})
    </Button>
    <Button
      variant={activeTab[slab.id] === 'ekatrikaran' ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveTab(prev => ({ ...prev, [slab.id]: 'ekatrikaran' }))}
    >
      Ekatrikaran ({slab.ekatrikaranCount})
    </Button>
  </div>
)}

            {/* Paiky Section Content */}
            {slab.paiky && (activeTab[slab.id] === 'paiky' || (!slab.ekatrikaran && slab.paiky)) && (
              <div className="space-y-4 pt-4 relative">
                <div className="space-y-4 pl-6 pr-16"> {/* Added right padding for floating controls */}
                  <div className="space-y-2">
                    <Label>Number of Paiky Entries</Label>
                    <Input
  type="number"
  value={slab.paikyCount === 0 ? '' : slab.paikyCount}
  onChange={(e) => {
  const value = e.target.value;
  
  // Allow empty string (will be converted to 0)
  if (value === '') {
    updatePaikyCount(slab.id, 0);
    return;
  }
  
  // Only allow numbers >= 0
  const numValue = parseInt(value);
  if (!isNaN(numValue) && numValue >= 0) {
    updatePaikyCount(slab.id, numValue);
  }
}}
  min="0"
  placeholder="0"
/>
                  </div>

                  {/* Horizontal Pagination at Top */}
                  {slab.paikyCount > PAIKY_PER_PAGE && (
                    <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
  Page {(currentPaikyPage[slab.id] || 0) + 1} of {Math.ceil(slab.paikyCount / PAIKY_PER_PAGE)}
</div>
                    <div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-4"
    disabled={(currentPaikyPage[slab.id] || 0) === 0}
    onClick={() => setCurrentPaikyPage(prev => ({
      ...prev,
      [slab.id]: (prev[slab.id] || 0) - 1
    }))}
  >
    <ChevronLeft className="h-4 w-4 block sm:hidden" />
    <span className="hidden sm:block">Previous</span>
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-4"
    disabled={(currentPaikyPage[slab.id] || 0) >= Math.ceil(slab.paikyCount / PAIKY_PER_PAGE) - 1}
    onClick={() => setCurrentPaikyPage(prev => ({
      ...prev,
      [slab.id]: (prev[slab.id] || 0) + 1
    }))}
  >
    <span className="hidden sm:block">Next</span>
    <ChevronRight className="h-4 w-4 block sm:hidden" />
  </Button>
</div>
                    </div>
                  )}

                  {/* Floating Vertical Pagination - Fixed positioning within this section */}
                  {slab.paikyCount > PAIKY_PER_PAGE && (
                    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 z-50 bg-white/95 backdrop-blur-sm p-2 rounded-lg border shadow-lg max-h-96 overflow-y-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        disabled={(currentPaikyPage[slab.id] || 0) === 0}
                        onClick={() => setCurrentPaikyPage(prev => ({
                          ...prev,
                          [slab.id]: (prev[slab.id] || 0) - 1
                        }))}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                        {Array.from({ length: Math.ceil(slab.paikyCount / PAIKY_PER_PAGE) }).map((_, index) => (
                          <Button
                            key={index}
                            variant={(currentPaikyPage[slab.id] || 0) === index ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 w-8 p-0 rounded-full flex-shrink-0 ${
                              (currentPaikyPage[slab.id] || 0) === index 
                                ? "bg-primary text-primary-foreground" 
                                : "hover:bg-accent"
                            }`}
                            onClick={() => setCurrentPaikyPage(prev => ({
                              ...prev,
                              [slab.id]: index
                            }))}
                          >
                            {index + 1}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        disabled={(currentPaikyPage[slab.id] || 0) >= Math.ceil(slab.paikyCount / PAIKY_PER_PAGE) - 1}
                        onClick={() => setCurrentPaikyPage(prev => ({
                          ...prev,
                          [slab.id]: (prev[slab.id] || 0) + 1
                        }))}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Paginated Entries */}
                  {slab.paikyEntries
                    .slice(
                      (currentPaikyPage[slab.id] || 0) * PAIKY_PER_PAGE,
                      ((currentPaikyPage[slab.id] || 0) + 1) * PAIKY_PER_PAGE
                    )
                    .map((entry, entryIndex) => {
                      const globalIndex = (currentPaikyPage[slab.id] || 0) * PAIKY_PER_PAGE + entryIndex;
                      return (
                        <Card key={globalIndex} className="p-3 mt-2">
                          <h4 className="text-sm font-medium mb-3">Paiky Entry {globalIndex + 1}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label>S.No Type</Label>
                              <Select
                                value={entry.sNoTypeUI}
                                onValueChange={(val) =>
                                  updateSlabEntry(slab.id, "paiky", globalIndex, {
                                    sNoTypeUI: val as SNoTypeUI,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SNO_TYPES.map((item) => (
                                    <SelectItem key={item.key} value={item.key}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Number</Label>
                              <Input
  value={entry.sNo}
  onChange={(e) =>
    updateSlabEntry(slab.id, "paiky", globalIndex, {
      sNo: e.target.value,
    })
  }
  placeholder="Enter number"
  className={validationErrors[slab.id]?.paikyEntries?.[globalIndex]?.sNo ? "border-red-500" : ""}
/>
{validationErrors[slab.id]?.paikyEntries?.[globalIndex]?.sNo && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].paikyEntries[globalIndex].sNo}</p>
)}
                            </div>
                            <div>
                              <Label>Area Type</Label>
                              <Select
                                value={entry.areaUI.areaType}
                                onValueChange={(val) =>
                                  updateSlabEntry(slab.id, "paiky", globalIndex, {
                                    areaUI: { ...entry.areaUI, areaType: val as AreaTypeUI },
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AREA_TYPES.map((a) => (
                                    <SelectItem key={a.key} value={a.key}>
                                      {a.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="md:col-span-2">
                              <Label>Area</Label>
                          

  {areaFields({ 
    area: entry.areaUI, 
    onChange: (area) => updateSlabEntry(slab.id, "paiky", globalIndex, {
      areaUI: area
    })
  })}

                            </div>
                           <div className="space-y-2">
            <Label>7/12 Document *</Label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleEntryFileUpload(
                        file, 
                        slab.id, 
                        'paiky',
                        globalIndex // Using the properly calculated index
                      );
                      e.target.value = '';
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 w-full"
                >
                  <Upload className="w-4 h-4" />
                  {loading ? "Uploading..." : "Choose File"}
                </Button>
                {validationErrors[slab.id]?.paikyEntries?.[globalIndex]?.integrated712 && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].paikyEntries[globalIndex].integrated712}</p>
)}
              </div>
              
              {entryUploadedFileNames[`${slab.id}_paiky_${globalIndex}`] && (
                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800 truncate flex-1">
                    {entryUploadedFileNames[`${slab.id}_paiky_${globalIndex}`]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateSlabEntry(slab.id, 'paiky', globalIndex, {
                        integrated712: ""
                      });
                      setEntryUploadedFileNames(prev => {
                        const newState = {...prev};
                        delete newState[`${slab.id}_paiky_${globalIndex}`];
                        return newState;
                      });
                    }}
                    className="ml-2 text-green-600 hover:text-green-800 text-lg leading-none flex-shrink-0"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {entry.integrated712 && (
                <a 
                  href={entry.integrated712} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  View Document
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, JPG, JPEG, PNG 
            </p>
          </div>
        </div>
      </Card>
    );
  })
}
                </div>
              </div>
            )}


            {/* Ekatrikaran Section Content */}
            {slab.ekatrikaran && (activeTab[slab.id] === 'ekatrikaran' || (!slab.paiky && slab.ekatrikaran)) && (
              <div className="space-y-4 pt-4 relative">
                <div className="space-y-4 pl-6 pr-16"> {/* Added right padding for floating controls */}
                  <div className="space-y-2">
                    <Label>Number of Ekatrikaran Entries</Label>
                    <Input
  type="number"
  value={slab.ekatrikaranCount === 0 ? '' : slab.ekatrikaranCount}
  onChange={(e) => {
  const value = e.target.value;
  
  // Allow empty string (will be converted to 0)
  if (value === '') {
    updateEkatrikaranCount(slab.id, 0);
    return;
  }
  
  // Only allow numbers >= 0
  const numValue = parseInt(value);
  if (!isNaN(numValue) && numValue >= 0) {
    updateEkatrikaranCount(slab.id, numValue);
  }
}}
  min="0"
  placeholder="0"
/>
                  </div>

                  {/* Horizontal Pagination at Top */}
                  {slab.ekatrikaranCount > EKATRIKARAN_PER_PAGE && (
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
                        Page {(currentEkatrikaranPage[slab.id] || 0) + 1} of {Math.ceil(slab.ekatrikaranCount / EKATRIKARAN_PER_PAGE)}
                      </div>
                     <div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-4"
    disabled={(currentEkatrikaranPage[slab.id] || 0) === 0}
    onClick={() => setCurrentEkatrikaranPage(prev => ({
      ...prev,
      [slab.id]: (prev[slab.id] || 0) - 1
    }))}
  >
    <ChevronLeft className="h-4 w-4 block sm:hidden" />
    <span className="hidden sm:block">Previous</span>
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-4"
    disabled={(currentEkatrikaranPage[slab.id] || 0) >= Math.ceil(slab.ekatrikaranCount / EKATRIKARAN_PER_PAGE) - 1}
    onClick={() => setCurrentEkatrikaranPage(prev => ({
      ...prev,
      [slab.id]: (prev[slab.id] || 0) + 1
    }))}
  >
    <span className="hidden sm:block">Next</span>
    <ChevronRight className="h-4 w-4 block sm:hidden" />
  </Button>
</div>
                    </div>
                  )}

                  {/* Floating Vertical Pagination - Fixed positioning within this section */}
                  {slab.ekatrikaranCount > EKATRIKARAN_PER_PAGE && (
                    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 z-50 bg-white/95 backdrop-blur-sm p-2 rounded-lg border shadow-lg max-h-96 overflow-y-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        disabled={(currentEkatrikaranPage[slab.id] || 0) === 0}
                        onClick={() => setCurrentEkatrikaranPage(prev => ({
                          ...prev,
                          [slab.id]: (prev[slab.id] || 0) - 1
                        }))}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                        {Array.from({ length: Math.ceil(slab.ekatrikaranCount / EKATRIKARAN_PER_PAGE) }).map((_, index) => (
                          <Button
                            key={index}
                            variant={(currentEkatrikaranPage[slab.id] || 0) === index ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 w-8 p-0 rounded-full flex-shrink-0 ${
                              (currentEkatrikaranPage[slab.id] || 0) === index 
                                ? "bg-primary text-primary-foreground" 
                                : "hover:bg-accent"
                            }`}
                            onClick={() => setCurrentEkatrikaranPage(prev => ({
                              ...prev,
                              [slab.id]: index
                            }))}
                          >
                            {index + 1}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        disabled={(currentEkatrikaranPage[slab.id] || 0) >= Math.ceil(slab.ekatrikaranCount / EKATRIKARAN_PER_PAGE) - 1}
                        onClick={() => setCurrentEkatrikaranPage(prev => ({
                          ...prev,
                          [slab.id]: (prev[slab.id] || 0) + 1
                        }))}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Paginated Entries */}
                  {slab.ekatrikaranEntries
  .slice(
    (currentEkatrikaranPage[slab.id] || 0) * EKATRIKARAN_PER_PAGE,
    ((currentEkatrikaranPage[slab.id] || 0) + 1) * EKATRIKARAN_PER_PAGE
  )
  .map((entry, entryIndex) => {
    const globalIndex = (currentEkatrikaranPage[slab.id] || 0) * EKATRIKARAN_PER_PAGE + entryIndex;
    
    return (
      <Card key={globalIndex} className="p-3 mt-2">
        <h4 className="text-sm font-medium mb-3">Ekatrikaran Entry {globalIndex + 1}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label>S.No Type</Label>
                              <Select
                                value={entry.sNoTypeUI}
                                onValueChange={(val) =>
                                  updateSlabEntry(slab.id, "ekatrikaran", globalIndex, {
                                    sNoTypeUI: val as SNoTypeUI,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SNO_TYPES.map((item) => (
                                    <SelectItem key={item.key} value={item.key}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Number</Label>
                              <Input
  value={entry.sNo}
  onChange={(e) =>
    updateSlabEntry(slab.id, "ekatrikaran", globalIndex, {
      sNo: e.target.value,
    })
  }
  placeholder="Enter number"
  className={validationErrors[slab.id]?.ekatrikaranEntries?.[globalIndex]?.sNo ? "border-red-500" : ""}
/>
{validationErrors[slab.id]?.ekatrikaranEntries?.[globalIndex]?.sNo && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].ekatrikaranEntries[globalIndex].sNo}</p>
)}
                            </div>
                            <div>
                              <Label>Area Type</Label>
                              <Select
                                value={entry.areaUI.areaType}
                                onValueChange={(val) =>
                                  updateSlabEntry(slab.id, "ekatrikaran", globalIndex, {
                                    areaUI: { ...entry.areaUI, areaType: val as AreaTypeUI },
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AREA_TYPES.map((a) => (
                                    <SelectItem key={a.key} value={a.key}>
                                      {a.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="md:col-span-2">
                              <Label>Area</Label>
                              {areaFields({ 
    area: entry.areaUI, 
    onChange: (area) => updateSlabEntry(slab.id, "ekatrikaran", globalIndex, {
      areaUI: area
    })
  })}
                            </div>
                            <div className="space-y-2">
            <Label>7/12 Document *</Label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleEntryFileUpload(
                        file, 
                        slab.id, 
                        'ekatrikaran',
                        globalIndex
                      );
                      e.target.value = '';
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 w-full"
                >
                  <Upload className="w-4 h-4" />
                  {loading ? "Uploading..." : "Choose File"}
                </Button>
                {validationErrors[slab.id]?.ekatrikaranEntries?.[globalIndex]?.integrated712 && (
  <p className="text-sm text-red-600">{validationErrors[slab.id].ekatrikaranEntries[globalIndex].integrated712}</p>
)}
              </div>
              
              {entryUploadedFileNames[`${slab.id}_ekatrikaran_${globalIndex}`] && (
                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800 truncate flex-1">
                    {entryUploadedFileNames[`${slab.id}_ekatrikaran_${globalIndex}`]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateSlabEntry(slab.id, 'ekatrikaran', globalIndex, {
                        integrated712: ""
                      });
                      setEntryUploadedFileNames(prev => {
                        const newState = {...prev};
                        delete newState[`${slab.id}_ekatrikaran_${globalIndex}`];
                        return newState;
                      });
                    }}
                    className="ml-2 text-green-600 hover:text-green-800 text-lg leading-none flex-shrink-0"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {entry.integrated712 && (
                <a 
                  href={entry.integrated712} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  View Document
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, JPG, JPEG, PNG 
            </p>
          </div>
        </div>
      </Card>
                      );
                    })
                  }
                </div>
              </div>
            )}
            </>
    )}
          </Card>
        ))}
        <Button onClick={addSlab} variant="outline" className="w-full bg-transparent">
          <Plus className="w-4 h-4 mr-2" /> Add Another Slab
        </Button>
        <div className="flex justify-center pt-6">
         
          <Button
            onClick={handleSaveAndNext}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save & Continue"}{" "}
          </Button>
        </div>
         </>
      )}
      </CardContent>
    </Card>
  );
}