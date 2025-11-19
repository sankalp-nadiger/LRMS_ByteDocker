"use client"
import React from 'react'
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, Upload, Eye, Loader2, ChevronDown, ChevronUp, Badge, Save } from "lucide-react"
import { useLandRecord, type NondhDetail } from "@/contexts/land-record-context"
import { supabase, uploadFile } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { LandRecordService } from "@/lib/supabase"
import { useStepFormData } from "@/hooks/use-step-form-data";
import { useUser } from "@clerk/nextjs";
import { createActivityLog } from "@/lib/supabase";

const nondhTypes = [
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
]

const tenureTypes = ["Navi", "Juni", "Kheti_Kheti_ma_Juni", "NA", "Bin_Kheti_Pre_Patra", "Prati_bandhit_satta_prakar"]

const hukamTypes = ["SSRD", "Collector", "Collector_ganot", "Prant", "Mamlajdaar", "GRT", "Jasu", "ALT Krushipanch", "DILR"]

const ganotOptions = ["1st Right", "2nd Right"]

// Nondh type translations
const nondhTypeTranslations: Record<string, string> = {
  "Kabjedaar": "કબજેદાર",
  "Ekatrikaran": "એકત્રીકરણ",
  "Varsai": "વારસાઈ",
  "Hayati_ma_hakh_dakhal": "હયાતીમા હક દાખલ",
  "Hakkami": "હક કમી",
  "Vechand": "વેચાણ",
  "Durasti": "દુરસ્તી",
  "Promulgation": "પ્રમોલગેશન",
  "Hukam": "હુકમથી",
  "Vehchani": "વેંચાણી",
  "Bojo": "બોજો દાખલ",
  "Other": "વસિયત"
};

// Function to get display text with Gujarati translation
const getNondhTypeDisplay = (type: string): string => {
  const gujaratiText = nondhTypeTranslations[type];
  return gujaratiText ? `${type} (${gujaratiText})` : type;
};

interface AreaFieldsProps {
  area: { 
    value: number; 
    unit: 'acre_guntha' | 'sq_m';
    acres?: number;
    gunthas?: number;
    square_meters?: number;
  };
  onChange: (area: { 
    value: number; 
    unit: 'acre_guntha' | 'sq_m';
    acres?: number;
    gunthas?: number;
    square_meters?: number;
  }) => void;
  disabled?: boolean;
  maxValue?: number;
}

const statusTypes = [
  { value: "valid", label: "Pramanik (પ્રમાણિત)" },
  { value: "invalid", label: "Radd (રદ)" },
  { value: "nullified", label: "Na manjoor (નામંજૂર)" }
]

const GUNTHAS_PER_ACRE = 40;
const SQM_PER_GUNTHA = 101.1714;
const SQM_PER_ACRE = SQM_PER_GUNTHA * GUNTHAS_PER_ACRE;

const areaFields = ({ area, onChange, disabled = false, maxValue }: AreaFieldsProps) => {
  // Define constants
  const SQM_PER_GUNTHA = 101.17;
  const SQM_PER_ACRE = 4046.86;
  const GUNTHAS_PER_ACRE = 40;

  // Add validation function that uses maxValue
  const validateAreaInput = (newValue: number, currentArea: any): number => {
    // Prevent negative values
    if (newValue < 0) return 0;
    
    // Prevent exceeding maximum if maxValue is provided
    if (maxValue !== undefined && maxValue !== null && newValue > maxValue) {
      return maxValue;
    }
    
    return newValue;
  };

  // Helper functions for conversions
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

  // Define workingArea at component level
  const workingArea = area || { unit: "acre_guntha", value: 0, acres: 0, gunthas: 0 };

  // Calculate display values based on current state
  const displayValues = (() => {
    if (workingArea.unit === "sq_m") {
      return {
        sq_m: workingArea.value,
        acres: workingArea.value ? Math.floor(convertFromSquareMeters(workingArea.value, "acre")) : undefined,
        gunthas: workingArea.value ? Math.round(convertFromSquareMeters(workingArea.value, "guntha") % 40) : undefined
      };
    } else {
      const calculatedSqm = workingArea.sq_m || ((workingArea.acres || 0) * SQM_PER_ACRE + (workingArea.gunthas || 0) * SQM_PER_GUNTHA);
      return {
        sq_m: calculatedSqm ? parseFloat(calculatedSqm.toFixed(2)) : calculatedSqm,
        acres: workingArea.acres ? Math.floor(workingArea.acres) : workingArea.acres,
        gunthas: workingArea.gunthas ? Math.round(workingArea.gunthas) : workingArea.gunthas
      };
    }
  })();

  const handleSqmChange = (value: string) => {
    if (value === "") {
      onChange({
        ...workingArea,
        value: undefined,
        acres: undefined,
        gunthas: undefined,
        sq_m: undefined
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const validatedValue = validateAreaInput(num, workingArea);
      const totalAcres = convertFromSquareMeters(validatedValue, "acre");
      const acres = Math.floor(totalAcres);
      const remainingGuntha = Math.round((totalAcres - acres) * 40);
      
      if (workingArea.unit === "sq_m") {
        onChange({
          ...workingArea,
          value: validatedValue,
          acres,
          gunthas: remainingGuntha
        });
      } else {
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          acres,
          gunthas: remainingGuntha,
          sq_m: parseFloat(validatedValue.toFixed(2))
        });
      }
    }
  };

  const handleAcreChange = (value: string) => {
    if (value === "") {
      onChange({
        ...workingArea,
        acres: undefined,
        gunthas: workingArea.gunthas,
        value: workingArea.unit === "sq_m" ? (workingArea.gunthas ? convertToSquareMeters(workingArea.gunthas, "guntha") : undefined) : workingArea.value,
        sq_m: workingArea.gunthas ? convertToSquareMeters(workingArea.gunthas, "guntha") : undefined
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      const validatedValue = validateAreaInput(num, workingArea);
      
      if (workingArea.unit === "sq_m") {
        const newSqm = convertToSquareMeters(validatedValue, "acre") + 
                      (displayValues.gunthas ? convertToSquareMeters(displayValues.gunthas, "guntha") : 0);
        onChange({
          ...workingArea,
          value: newSqm,
          acres: validatedValue,
          gunthas: displayValues.gunthas
        });
      } else {
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          acres: validatedValue,
          sq_m: parseFloat((convertToSquareMeters(validatedValue, "acre") + 
               (workingArea.gunthas ? convertToSquareMeters(workingArea.gunthas, "guntha") : 0)).toFixed(2))
        });
      }
    }
  };

  const handleGunthaChange = (value: string) => {
    if (value === "") {
      onChange({
        ...workingArea,
        gunthas: undefined,
        acres: workingArea.acres,
        value: workingArea.unit === "sq_m" ? (workingArea.acres ? convertToSquareMeters(workingArea.acres, "acre") : undefined) : workingArea.value,
        sq_m: workingArea.acres ? convertToSquareMeters(workingArea.acres, "acre") : undefined
      });
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num)) {
      if (num >= 40) {
        return;
      }
      
      const validatedValue = validateAreaInput(num, workingArea);
      
      if (workingArea.unit === "sq_m") {
        const newSqm = (displayValues.acres ? convertToSquareMeters(displayValues.acres, "acre") : 0) + 
                      convertToSquareMeters(validatedValue, "guntha");
        onChange({
          ...workingArea,
          value: newSqm,
          acres: displayValues.acres,
          gunthas: validatedValue
        });
      } else {
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          gunthas: validatedValue,
          sq_m: parseFloat(((workingArea.acres ? convertToSquareMeters(workingArea.acres, "acre") : 0) +
               convertToSquareMeters(validatedValue, "guntha")).toFixed(2))
        });
      }
    }
  };

  const formatValue = (value: number | undefined): string => {
    return value === undefined ? "" : value.toString();
  };

  // Add max value indicator
  const showMaxValueWarning = maxValue !== undefined && maxValue !== null && area.value > maxValue;

  return (
    <div className="space-y-4">
      {/* Max Value Warning */}
      {showMaxValueWarning && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="text-red-700 text-sm">
            ⚠️ Area exceeds maximum allowed value: {maxValue}
          </p>
        </div>
      )}

      {/* On mobile: Stack all fields vertically */}
      <div className="md:hidden space-y-4">
        {/* Unit Selector */}
        <div className="space-y-2 w-full">
          <Label>Unit</Label>
          <Select
            value={workingArea.unit}
            onValueChange={(unit) => {
              const newUnit = unit as AreaUnit;
              if (newUnit === "sq_m") {
                const sqmValue = displayValues.sq_m || 0;
                onChange({ 
                  ...workingArea, 
                  unit: "sq_m",
                  value: sqmValue,
                  acres: displayValues.acres,
                  gunthas: displayValues.gunthas
                });
              } else {
                onChange({ 
                  ...workingArea, 
                  unit: "acre_guntha",
                  acres: displayValues.acres || 0,
                  gunthas: displayValues.gunthas || 0,
                  sq_m: displayValues.sq_m
                });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acre_guntha">Acre-Guntha</SelectItem>
              <SelectItem value="sq_m">Square Meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* All fields are now editable */}
        {workingArea.unit === "sq_m" ? (
          <>
            <div className="space-y-2 w-full">
              <Label>Square Meters</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formatValue(displayValues.sq_m)}
                onChange={(e) => handleSqmChange(e.target.value)}
                placeholder="Enter square meters"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.gunthas)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 w-full">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.gunthas)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Square Meters</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formatValue(displayValues.sq_m)}
                onChange={(e) => handleSqmChange(e.target.value)}
                placeholder="Enter square meters"
                className="w-full"
                disabled={disabled}
              />
            </div>
          </>
        )}
      </div>

      {/* On desktop: All fields editable in single row */}
      <div className="hidden md:flex items-end gap-6">
        {/* Unit Selector */}
        <div className="space-y-2 w-[140px] flex-shrink-0">
          <Label>Unit</Label>
          <Select
            value={workingArea.unit}
            onValueChange={(unit) => {
              const newUnit = unit as AreaUnit;
              if (newUnit === "sq_m") {
                const sqmValue = displayValues.sq_m || 0;
                onChange({ 
                  ...workingArea, 
                  unit: "sq_m",
                  value: sqmValue,
                  acres: displayValues.acres,
                  gunthas: displayValues.gunthas
                });
              } else {
                onChange({ 
                  ...workingArea, 
                  unit: "acre_guntha",
                  acres: displayValues.acres || 0,
                  gunthas: displayValues.gunthas || 0,
                  sq_m: displayValues.sq_m
                });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-[140px] px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acre_guntha">Acre-Guntha</SelectItem>
              <SelectItem value="sq_m">Square Meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* All fields are now editable */}
        {workingArea.unit === "sq_m" ? (
          <>
            <div className="space-y-2 min-w-[150px] flex-1">
              <Label>Square Meters</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formatValue(displayValues.sq_m)}
                onChange={(e) => handleSqmChange(e.target.value)}
                placeholder="Enter square meters"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-[120px] flex-1">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-[100px] flex-1">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.gunthas)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 min-w-[120px] flex-1">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter acres"
                className="w-full"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-[100px] flex-1">
              <Label>Gunthas</Label>
              <Input
                type="number"
                min="0"
                max="39"
                step="1"
                value={formatValue(displayValues.gunthas)}
                onChange={(e) => handleGunthaChange(e.target.value)}
                placeholder="Enter gunthas (0-39)"
                className="w-full"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-2 min-w-[150px] flex-1">
              <Label>Square Meters</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formatValue(displayValues.sq_m)}
                onChange={(e) => handleSqmChange(e.target.value)}
                placeholder="Enter square meters"
                className="w-full"
                disabled={disabled}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function NondhDetailsEdit() {
  const { landBasicInfo, yearSlabs, nondhs: contextNondhs, setNondhs, recordId, setCurrentStep, refreshStatus } = useLandRecord()
  const { toast } = useToast()
  const { user } = useUser()
const { getStepData, updateStepData, markAsSaved, hasUnsavedChanges } = useStepFormData(5)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false);
 const getStepFormData = () => {
  const stepData = getStepData();
  return {
    nondhs: stepData.nondhs || [],
    nondhDetails: stepData.nondhDetails || [],
    originalDetails: stepData.originalDetails || [],
    collapsedNondhs: new Set(stepData.collapsedNondhs || []),
    equalDistribution: stepData.equalDistribution || {},
    documents712: stepData.documents712 || [],
    ownerTransfers: stepData.ownerTransfers || {},
    transferEqualDistribution: stepData.transferEqualDistribution || {},
    affectedNondhDetails: stepData.affectedNondhDetails || {},
    originalAffectedNondhDetails: stepData.originalAffectedNondhDetails || {}
  };
};

const [localState, setLocalState] = useState(() => ({
  nondhs: [],
  nondhDetails: [],
  originalDetails: [],
  collapsedNondhs: new Set(),
  equalDistribution: {},
  documents712: [],
  ownerTransfers: {},
  transferEqualDistribution: {},
  affectedNondhDetails: {},
  originalAffectedNondhDetails: {}
}));

// Get values from localState
const nondhs = Array.isArray(localState.nondhs) ? localState.nondhs : [];
const nondhDetails = localState.nondhDetails;
const originalDetails = localState.originalDetails;
const collapsedNondhs = localState.collapsedNondhs;
const equalDistribution = localState.equalDistribution;
const documents712 = localState.documents712;
const ownerTransfers = localState.ownerTransfers;
const transferEqualDistribution = localState.transferEqualDistribution;
const affectedNondhDetails = localState.affectedNondhDetails;
const originalAffectedNondhDetails = localState.originalAffectedNondhDetails;

const updateLocalState = (field: string, value: any) => {
  setLocalState(prev => {
    const newState = { ...prev, [field]: value };
    
    // Sync immediately without setTimeout
    const currentData = getStepData();
    updateStepData({ 
      ...currentData, 
      [field]: value 
    });
    
    return newState;
  });
};

useEffect(() => {
  console.log('nondhDetails updated:', nondhDetails);
  console.log('nondhs:', nondhs);
}, [nondhDetails, nondhs]);

const setLocalNondhs = (nondhs: any[]) => updateLocalState('nondhs', nondhs);
const setNondhDetails = (details: NondhDetail[]) => updateLocalState('nondhDetails', details);
const setOriginalDetails = (details: NondhDetail[]) => updateLocalState('originalDetails', details);
const setCollapsedNondhs = (collapsed: Set<string>) => updateLocalState('collapsedNondhs', Array.from(collapsed));
const setEqualDistribution = (distribution: Record<string, boolean>) => updateLocalState('equalDistribution', distribution);
const setDocuments712 = (docs: any[]) => updateLocalState('documents712', docs);
const setOwnerTransfers = (transfers: Record<string, Array<any>>) => updateLocalState('ownerTransfers', transfers);
const setTransferEqualDistribution = (distribution: Record<string, Record<string, boolean>>) => updateLocalState('transferEqualDistribution', distribution);
const setAffectedNondhDetails = (details: Record<string, Array<any>>) => updateLocalState('affectedNondhDetails', details);
const setOriginalAffectedNondhDetails = (details: Record<string, Array<any>>) => updateLocalState('originalAffectedNondhDetails', details);

useEffect(() => {
  const initializeData = async () => {
  const stepData = getStepData();
  console.log('Step data on mount/return:', stepData);
  
  if (stepData) {
    try {
      setLoading(true);
      
      // ALWAYS load nondhs from database to get the numbers (1, 2, 3, etc.)
      const { data: nondhData, error: nondhError } = await LandRecordService.getNondhsforDetails(recordId);
      
      if (!nondhError && nondhData) {
        const formattedNondhs = nondhData.map(nondh => ({
          ...nondh,
          affectedSNos: Array.isArray(nondh.affected_s_nos) 
            ? nondh.affected_s_nos 
            : nondh.affectedSNos 
              ? [nondh.affectedSNos] 
              : [],
          nondhDoc: nondh.nondh_doc_url || ''
        }));
        
        console.log('Nondh numbers from DB:', formattedNondhs.map(n => n.number));
        
        // FIX: Always load fresh data from database when returning to step
        // This ensures we have the real IDs from the database
        const { allDetails, dbDetails } = await loadDataFromDatabase(formattedNondhs);
        
        // CRITICAL FIX: After loading from DB, update originalDetails with real IDs
        const updatedOriginalDetails = stepData.originalDetails?.map(od => {
          // Find the corresponding DB detail by nondhId
          const dbDetail = dbDetails.find(dbd => dbd.nondhId === od.nondhId);
          // If found and the original has a temp ID, replace it with real ID
          if (dbDetail && od.id.toString().startsWith('temp_')) {
            console.log(`Replacing temp ID ${od.id} with real ID ${dbDetail.id} for nondhId: ${od.nondhId}`);
            return { ...od, id: dbDetail.id };
          }
          return od;
        }) || allDetails;

        setLocalState(prev => ({
          ...prev,
          nondhs: formattedNondhs,
          nondhDetails: allDetails,
          originalDetails: updatedOriginalDetails
        }));
        
        updateStepData({
          ...stepData,
          nondhs: formattedNondhs,
          nondhDetails: allDetails,
          originalDetails: updatedOriginalDetails
        });
      }
      
      const { data: docs712Data, error: docs712Error } = await LandRecordService.get712Documents(recordId);
      if (!docs712Error && docs712Data) {
        setDocuments712(docs712Data);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error in initializeData:', error);
    } finally {
      setLoading(false);
    }
  } else {
    setLoading(false);
  }
};

  if (recordId) {
    initializeData();
  } else {
    setLoading(false);
  }
}, [recordId]);

const loadDataFromDatabase = async (providedNondhs?: any[]): Promise<{ allDetails: any[], dbDetails: any[] }> => {
  console.log('Loading data from database...');
  if (!recordId) return { allDetails: [], dbDetails: [] };

  try {
    setLoading(true);
    
    // Use provided nondhs or load from database
    let formattedNondhs = providedNondhs;
    if (!formattedNondhs) {
      const { data: nondhData, error: nondhError } = await LandRecordService.getNondhsforDetails(recordId);
      if (nondhError) throw nondhError;
      
      formattedNondhs = (nondhData || []).map(nondh => ({
        ...nondh,
        affectedSNos: Array.isArray(nondh.affected_s_nos) 
          ? nondh.affected_s_nos 
          : nondh.affectedSNos 
            ? [nondh.affectedSNos] 
            : [],
        nondhDoc: nondh.nondh_doc_url || ''
      }));
    }
    
    setLocalNondhs(formattedNondhs);

    // Load nondh details from database
    const { data: detailData, error: detailError } = await LandRecordService.getNondhDetailsWithRelations(recordId);
    if (detailError) throw detailError;

    const transformedDetails = (detailData || []).map((detail: any) => ({
        id: detail.id,
        nondhId: detail.nondh_id,
        sNo: detail.s_no,
        type: detail.type,
        reason: detail.reason || "",
        date: detail.date || "",
        vigat: detail.vigat || "",
        status: detail.status || "valid",
        invalidReason: detail.invalid_reason || "",
        showInOutput: detail.show_in_output !== false,
        hasDocuments: detail.has_documents || false,
        docUpload: detail.doc_upload_url || "",
        oldOwner: detail.old_owner?.includes('|') 
          ? detail.old_owner.split('|')[1] 
          : detail.old_owner,
        hukamDate: detail.hukam_date || "",
        hukamType: detail.hukam_type || "SSRD",
        hukamStatus: detail.hukam_status || "valid",
        hukamInvalidReason: detail.hukam_invalid_reason || "",
        ganot: detail.ganot || "",
        restrainingOrder: detail.restraining_order || "no",
        sdDate: detail.sd_date || "",
        tenure: detail.tenure || "Navi",
        amount: detail.amount || null,
        affectedNondhDetails: Array.isArray(detail.affected_nondh_details)
  ? detail.affected_nondh_details
  : (detail.affected_nondh_details ? JSON.parse(detail.affected_nondh_details) : []),
        ownerRelations: (detail.owner_relations || []).map((rel: any) => ({
          id: rel.id,
          ownerName: rel.owner_name,
          sNo: rel.s_no,
          area: {
            value: rel.square_meters || (rel.acres * SQM_PER_ACRE + rel.gunthas * SQM_PER_GUNTHA),
            unit: rel.area_unit as 'acre_guntha' | 'sq_m',
            acres: rel.acres,
            gunthas: rel.gunthas
          },
          isValid: rel.is_valid !== false,
          surveyNumber: rel.survey_number || "",
          surveyNumberType: rel.survey_number_type || "s_no"
        }))
      }));

    const existingDetailNondhIds = new Set(transformedDetails.map(detail => detail.nondhId));
    const allDetails = [...transformedDetails];

    // Add missing details ONLY for nondhs that don't have details yet
    formattedNondhs
      .filter(nondh => !existingDetailNondhIds.has(nondh.id))
      .forEach(nondh => {
        console.log('Adding missing detail for nondh:', nondh.id);
        // Determine if we should initialize with an empty owner relation
        const shouldInitializeOwner = !["Hakkami", "Vehchani"].includes(nondh.type || '');
        // ✅ Mark as temporary - will be created on save
        const newDetail = {
          id: `temp_${nondh.id}`, // Temporary ID marker
          nondhId: nondh.id,
          sNo: nondh.affectedSNos?.[0] || '',
          type: nondh.type || 'Kabjedaar',
          reason: "",
          date: "",
          vigat: "",
          status: "valid",
          invalidReason: "",
          showInOutput: true,
          hasDocuments: false,
          docUpload: "",
          oldOwner: "",
          hukamDate: "",
          hukamType: "SSRD",
          hukamStatus: "valid",
          hukamInvalidReason: "",
          affectedNondhNo: "",
          ganot: "",
          restrainingOrder: "no",
          sdDate: "",
          tenure: "Navi",
          amount: null,
          affectedNondhDetails: [],
          ownerRelations: shouldInitializeOwner ? [{
            id: `temp_rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ownerName: "",
            sNo: nondh.affectedSNos?.[0] || '',
            area: { value: 0, unit: "sq_m" },
            isValid: true,
            surveyNumber: "",
            surveyNumberType: "s_no"
          }] : [] // Empty array for Hakkami and Vehchani
        };

        allDetails.push(newDetail);
      });

    setNondhDetails(allDetails);
    setOriginalDetails(allDetails);
    
    const extractedAffectedDetails = {};
allDetails.forEach(detail => {
  if (detail.affectedNondhDetails && detail.affectedNondhDetails.length > 0) {
    // Ensure it's an array before setting
    extractedAffectedDetails[detail.id] = Array.isArray(detail.affectedNondhDetails)
      ? detail.affectedNondhDetails
      : JSON.parse(detail.affectedNondhDetails);
  }
});
  
  setAffectedNondhDetails(extractedAffectedDetails);
  setOriginalAffectedNondhDetails(JSON.parse(JSON.stringify(extractedAffectedDetails)));

    // Update step data with the loaded data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      nondhs: formattedNondhs,
      nondhDetails: allDetails,
      originalDetails: allDetails,
      affectedNondhDetails: extractedAffectedDetails,
    originalAffectedNondhDetails: JSON.parse(JSON.stringify(extractedAffectedDetails))  
    });

    return { allDetails, dbDetails: transformedDetails };

  } catch (error) {
    console.error('Error loading data:', error);
    toast({
      title: "Error loading data",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive"
    });
    return { allDetails: [], dbDetails: [] };
  } finally {
    setLoading(false);
  }
};

  // Check for changes
useEffect(() => {
  // Skip check until data is fully initialized
  if (!isInitialized) return;
  
  const currentStepData = getStepFormData();
  if (currentStepData.nondhDetails && currentStepData.originalDetails) {
    const dbChanged = !deepEqual(currentStepData.nondhDetails, currentStepData.originalDetails) || 
                     !deepEqual(currentStepData.affectedNondhDetails, currentStepData.originalAffectedNondhDetails);
    setHasChanges(dbChanged);
  }
}, [nondhDetails, originalDetails, affectedNondhDetails, originalAffectedNondhDetails, isInitialized]); 

useEffect(() => {
  Object.entries(affectedNondhDetails).forEach(([detailId, affectedList]) => {
    affectedList.forEach(affected => {
      if (affected.status === "invalid" && affected.invalidReason) {
        propagateReasonToAffectedNondh(affected.nondhNo, affected.invalidReason);
      }
    });
  });
}, [affectedNondhDetails]);

  // Deep equality check
  const deepEqual = (a: any, b: any) => {
    return JSON.stringify(a) === JSON.stringify(b)
  }

 const propagateReasonToAffectedNondh = (affectedNondhNo: string, reason: string) => {
  const allSortedNondhs = [...localState.nondhs].sort(sortNondhs);
  const affectedNondh = allSortedNondhs.find(n => n.number.toString() === affectedNondhNo);
  
  if (!affectedNondh) return;

  setLocalState(prev => {
    const updatedNondhDetails = prev.nondhDetails.map(detail => 
      detail.nondhId === affectedNondh.id && detail.status === "invalid"
        ? { ...detail, invalidReason: reason }
        : detail
    );
    
    const newState = {
      ...prev,
      nondhDetails: updatedNondhDetails
    };
    
    // Sync with step data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      nondhDetails: updatedNondhDetails
    });
    
    return newState;
  });
};

  const validateAreaInput = (newValue: number, currentArea: any, maxAllowed: number): number => {
  // Prevent negative values
  if (newValue < 0) return 0;
  
  // Prevent exceeding maximum
  if (newValue > maxAllowed) return maxAllowed;
  
  return newValue;
};

  const getNondhNumber = (nondh: any): number => {
    if (typeof nondh.number === 'number') return nondh.number;
    const num = parseInt(nondh.number, 10);
    return isNaN(num) ? 0 : num;
  };

  const safeNondhNumber = (nondh: any): number => {
    const numberValue = typeof nondh.number === 'string' 
      ? parseInt(nondh.number, 10) 
      : nondh.number;
    return isNaN(numberValue) ? 0 : numberValue;
  };

const getPrimarySNoType = (affectedSNos: string[]): string => {
  if (!affectedSNos || affectedSNos.length === 0) return 's_no';
  
  // Get valid S.Nos from basic info and year slabs
  const validSNos = getSNoTypesFromSlabs();
  
  // Filter and parse affected S.Nos
  const validTypes = affectedSNos
    .map(sNoStr => {
      try {
        const parsed = JSON.parse(sNoStr);
        return {
          type: parsed.type || 's_no',
          number: parsed.number || sNoStr
        };
      } catch (e) {
        return {
          type: 's_no',
          number: sNoStr
        };
      }
    })
    .filter(({ number }) => validSNos.has(number))
    .map(({ type }) => type);
  
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

  const sortNondhs = (a: any, b: any): number => {
  // Get valid S.Nos from basic info and year slabs
  const validSNos = getSNoTypesFromSlabs();
  
  // Filter affected S.Nos to only include valid ones
  const filterValidSNos = (affectedSNos: any[]) => {
    return affectedSNos
      .map(sNoItem => {
        try {
          const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
          return {
            number: parsed.number || sNoItem,
            type: parsed.type || 's_no'
          };
        } catch (e) {
          return {
            number: sNoItem,
            type: 's_no'
          };
        }
      })
      .filter(({ number }) => validSNos.has(number));
  };
  
  const aValidSNos = filterValidSNos(a.affected_s_nos || a.affectedSNos || []);
  const bValidSNos = filterValidSNos(b.affected_s_nos || b.affectedSNos || []);
  
  // If no valid S.Nos, put at the end
  if (aValidSNos.length === 0 && bValidSNos.length === 0) return 0;
  if (aValidSNos.length === 0) return 1;
  if (bValidSNos.length === 0) return -1;
  
  // Get primary types from valid affected S.Nos only
  const getPrimaryTypeFromValid = (validSNos: any[]): string => {
    if (validSNos.length === 0) return 's_no';
    
    // Priority order: s_no > block_no > re_survey_no
    const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
    const types = validSNos.map(sNo => sNo.type || 's_no');
    
    // Find the highest priority type present
    for (const type of priorityOrder) {
      if (types.includes(type)) {
        return type;
      }
    }
    
    return 's_no';
  };

  const aType = getPrimaryTypeFromValid(aValidSNos);
  const bType = getPrimaryTypeFromValid(bValidSNos);

  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  const aPriority = priorityOrder.indexOf(aType);
  const bPriority = priorityOrder.indexOf(bType);

  // First sort by primary type priority
  if (aPriority !== bPriority) return aPriority - bPriority;

  // Within same type group, sort by nondh number (ascending)
  const aNum = parseInt(a.number.toString()) || 0;
  const bNum = parseInt(b.number.toString()) || 0;
  return aNum - bNum;
};

  const handleStatusChange = (detailId: string, newStatus: "valid" | "invalid" | "nullified") => {
  setLocalState(prev => {
    const updatedNondhDetails = prev.nondhDetails.map(detail => 
      detail.id === detailId 
        ? { 
            ...detail, 
            status: newStatus,
            invalidReason: detail.invalidReason || ''
          } 
        : detail
    );
    
    // Process validity chain immediately
    const processedDetails = processValidityChain(updatedNondhDetails);
    
    const newState = {
      ...prev,
      nondhDetails: processedDetails
    };
    
    // Sync with step data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      nondhDetails: processedDetails
    });
    
    return newState;
  });
};

const convertAreaUnits = (value: number, fromUnit: string, toUnit: string): number => {
  if (fromUnit === toUnit) return value;
  
  // Convert to square meters first
  let sqMeters = 0;
  switch (fromUnit) {
    case 'acre':
      sqMeters = value * 4046.86;
      break;
    case 'guntha':
      sqMeters = value * 101.17;
      break;
    default:
      sqMeters = value;
  }
  
  // Convert from square meters to target unit
  switch (toUnit) {
    case 'acre':
      return sqMeters / 4046.86;
    case 'guntha':
      return sqMeters / 101.17;
    default:
      return sqMeters;
  }
};

  const processValidityChain = (details: NondhDetail[]): NondhDetail[] => {
  const sortedNondhs = [...localState.nondhs].sort(sortNondhs); // Use localState.nondhs
  const nondhDetailMap = new Map<string, NondhDetail>();
  details.forEach(detail => {
    nondhDetailMap.set(detail.nondhId, detail);
  });

  const affectingCounts = new Map<string, number>();
  sortedNondhs.forEach((nondh, index) => {
    let count = 0;
    for (let i = index + 1; i < sortedNondhs.length; i++) {
      const affectingNondh = sortedNondhs[i];
      const affectingDetail = nondhDetailMap.get(affectingNondh.id);
      if (affectingDetail?.status === 'invalid') {
        count++;
      }
    }
    affectingCounts.set(nondh.id, count);
  });

  // Create updated details with proper validity
  const updatedDetails = details.map(detail => {
    const affectingCount = affectingCounts.get(detail.nondhId) || 0;
    const shouldBeValid = affectingCount % 2 === 0;
    
    const currentValidity = detail.ownerRelations.every(r => r.isValid);
    if (currentValidity !== shouldBeValid) {
      return {
        ...detail,
        ownerRelations: detail.ownerRelations.map(relation => ({
          ...relation,
          isValid: shouldBeValid
        }))
      };
    }
    return detail;
  });

  return updatedDetails;
};

// function to manage affected nondh details
const addAffectedNondh = (detailId: string) => {
  console.log('➕ Adding affected nondh for detail:', detailId);
  
  setLocalState(prev => {
    const currentAffected = prev.affectedNondhDetails[detailId] || [];
    const newAffected = [
      ...currentAffected,
      {
        id: `affected_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nondhNo: '',
        status: 'valid',
        invalidReason: ''
      }
    ];
    
    const newState = {
      ...prev,
      affectedNondhDetails: {
        ...prev.affectedNondhDetails,
        [detailId]: newAffected
      }
    };
    
    // Sync with step data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      affectedNondhDetails: newState.affectedNondhDetails
    });
    
    return newState;
  });
};

const removeAffectedNondh = (detailId: string, affectedId: string) => {
  setAffectedNondhDetails(prev => ({
    ...prev,
    [detailId]: (prev[detailId] || []).filter(a => a.id !== affectedId)
  }));
};

const updateAffectedNondh = (detailId: string, affectedId: string, updates: any) => {
  setLocalState(prev => {
    const currentAffected = prev.affectedNondhDetails[detailId] || [];
    const updatedAffected = currentAffected.map(affected =>
      affected.id === affectedId ? { ...affected, ...updates } : affected
    );
    
    const newState = {
      ...prev,
      affectedNondhDetails: {
        ...prev.affectedNondhDetails,
        [detailId]: updatedAffected
      }
    };
    
    // Sync with step data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      affectedNondhDetails: newState.affectedNondhDetails
    });
    
    return newState;
  });
};

  const handleGanotChange = (detailId: string, ganot: string) => {
  console.log('=== HANDLE GANOT CHANGE START ===');
  console.log('Detail ID:', detailId);
  console.log('New Ganot:', ganot);
  
  // CRITICAL: Get detail and nondh BEFORE any state updates
  const detail = nondhDetails.find(d => d.id === detailId);
  
  if (!detail) {
    console.log('ERROR: Detail not found for detailId:', detailId);
    return;
  }
  
  // Now update the ganot
  updateNondhDetail(detailId, { ganot });
  
  // Create default transfer for 1st Right if none exists
  if (ganot === "1st Right") {
  console.log('Setting up 1st Right - clearing owner relations');
  updateNondhDetail(detailId, { ownerRelations: [] });
}
  
  // Auto-populate all previous owners for 2nd Right
if (ganot === "2nd Right") {
  console.log('Processing 2nd Right auto-population');
  
  const currentNondh = nondhs.find(n => n.id === detail.nondhId);
  
  if (!currentNondh) {
    console.log('ERROR: Current nondh not found');
    return;
  }
  
  const currentSNos = currentNondh.affectedSNos.map(sNo => 
    typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
  );
  
  const previousOwners = getAvailableOwnersForGanot("2nd Right", currentNondh.id, currentSNos);
  const ownersArray = Array.isArray(previousOwners) ? previousOwners : [];
  
  // Get year slab area limit for validation
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  
  if (!yearSlabArea) {
    // No year slab limit - use actual areas
    const ownerRelations = ownersArray.map((owner, index) => ({
      id: (Date.now() + index).toString(),
      ownerName: owner.name,
      sNo: owner.sNo,
      area: {
        value: owner.area?.value || 0,
        unit: owner.area?.unit || 'sq_m'
      },
      isValid: true,
      surveyNumber: "",
      surveyNumberType: "s_no"
    }));
    
    updateNondhDetail(detailId, { ownerRelations });
  } else {
    // Calculate total area from previous owners
    const totalPreviousArea = ownersArray.reduce((sum, owner) => sum + (owner.area?.value || 0), 0);
    
    // Check if total exceeds year slab limit
    if (totalPreviousArea > yearSlabArea.value) {
      console.warn(`Total area (${totalPreviousArea}) exceeds year slab limit (${yearSlabArea.value})`);
      
      // Clear all areas to 0 and show warning
      const ownerRelations = ownersArray.map((owner, index) => ({
        id: (Date.now() + index).toString(),
        ownerName: owner.name,
        sNo: owner.sNo,
        area: {
          value: 0,  // Set to 0 when exceeds limit
          unit: owner.area?.unit || 'sq_m'
        },
        isValid: true,
        surveyNumber: "",
        surveyNumberType: "s_no"
      }));
      
      updateNondhDetail(detailId, { ownerRelations });
      
      toast({
        title: "Year slab limit exceeded",
        description: `Total previous owner area (${totalPreviousArea.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value.toFixed(2)}). Areas have been cleared to 0. Please enter valid areas manually.`,
        variant: "destructive"
      });
    } else {
      // Within limit - use actual areas
      const ownerRelations = ownersArray.map((owner, index) => ({
        id: (Date.now() + index).toString(),
        ownerName: owner.name,
        sNo: owner.sNo,
        area: {
          value: owner.area?.value || 0,
          unit: owner.area?.unit || 'sq_m'
        },
        isValid: true,
        surveyNumber: "",
        surveyNumberType: "s_no"
      }));
      
      updateNondhDetail(detailId, { ownerRelations });
    }
  }
}
  
  console.log('=== HANDLE GANOT CHANGE END ===\n');
};

const getAvailableOwnersForGanot = (ganotType: string, currentNondhId: string, currentSNos: string[]) => {
  console.log('=== getAvailableOwnersForGanot START ===');
  console.log('Ganot Type:', ganotType);
  console.log('Current Nondh ID:', currentNondhId);
  
  // Get valid S.Nos from basic info and year slabs
  const validSNos = getSNoTypesFromSlabs();
  
  // Get all nondhs sorted using the same logic as display
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  console.log('All sorted nondhs:', allSortedNondhs.map(n => ({ id: n.id, number: n.number })));
  
  const currentIndex = allSortedNondhs.findIndex(n => n.id === currentNondhId);
  console.log('Current nondh index:', currentIndex);
  
  if (ganotType === "2nd Right") {
    console.log('--- Processing 2nd Right ---');
    const previousNondhs = allSortedNondhs.slice(0, currentIndex);
    console.log('Previous nondhs count:', previousNondhs.length);
    
    const allOwners = previousNondhs
      .map((nondh, index) => {
        console.log(`\nProcessing nondh ${nondh.number} (index: ${index})`);
        const detail = nondhDetails.find(d => d.nondhId === nondh.id);
        if (!detail) {
          console.log('  No detail found for this nondh');
          return [];
        }
        
        // Skip if status is invalid/nullified (Radd/Na Manjoor)
        if (detail.status === 'invalid' || detail.status === 'nullified') {
          console.log('  Skipped - Status is Radd/Na Manjoor');
          return [];
        }
        
        console.log('  Detail type:', detail.type);
        console.log('  Owner relations count:', detail.ownerRelations.length);
        
        // Get first valid S.No for display
        const firstSNo = (() => {
          const validAffectedSNos = nondh.affectedSNos
            ?.map(sNoItem => {
              try {
                const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
                return parsed.number || sNoItem;
              } catch (e) {
                return sNoItem;
              }
            })
            .filter(sNo => validSNos.has(sNo)) || [];
          
          return validAffectedSNos[0] || nondh.affectedSNos[0];
        })();
        
        const isTransferType = ["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type);
        console.log('  Is transfer type:', isTransferType);
        
        const owners = [];
        
        // Add old owner with remaining area (if any remaining)
        if (isTransferType && detail.oldOwner && detail.oldOwner.trim() !== "") {
          console.log('  Old owner:', detail.oldOwner);
          
          // Calculate remaining area for old owner
          const newOwnersTotal = detail.ownerRelations
            .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
            .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
          
          // Find old owner's original area
          const oldOwnerOriginalArea = (() => {
            const nondhIndex = allSortedNondhs.findIndex(n => n.id === nondh.id);
            const priorNondhs = allSortedNondhs.slice(0, nondhIndex);
            
            for (let i = priorNondhs.length - 1; i >= 0; i--) {
              const priorDetail = nondhDetails.find(d => d.nondhId === priorNondhs[i].id);
              if (!priorDetail || priorDetail.status === 'invalid' || priorDetail.status === 'nullified') continue;
              
              const ownerRel = priorDetail.ownerRelations.find(rel => rel.ownerName === detail.oldOwner);
              if (ownerRel) {
                return ownerRel.area?.value || 0;
              }
            }
            return 0;
          })();
          
          const remainingArea = Math.max(0, oldOwnerOriginalArea - newOwnersTotal);
          console.log(`  Old owner remaining area: ${remainingArea}`);
          
          // Only include old owner if they have remaining area
          if (remainingArea > 0) {
            owners.push({
              id: `old-${detail.oldOwner}-${nondh.id}`,
              name: detail.oldOwner,
              area: { value: remainingArea, unit: detail.ownerRelations[0]?.area?.unit || 'sq_m' },
              sNo: firstSNo,
              nondhId: nondh.id,
              nondhType: detail.type,
              isOldOwner: true,
              sortIndex: index
            });
          }
        }
        
        // Add new owners (exclude old owner)
        const newOwners = detail.ownerRelations
          .filter(r => {
            if (!isTransferType) return true;
            const isNotOldOwner = r.ownerName !== detail.oldOwner;
            console.log(`    Owner "${r.ownerName}" - isNotOldOwner: ${isNotOldOwner}`);
            return isNotOldOwner;
          })
          .map(r => ({ 
            id: r.id,
            name: r.ownerName, 
            area: r.area,
            sNo: firstSNo,
            nondhId: nondh.id,
            nondhType: detail.type,
            isOldOwner: false,
            sortIndex: index
          }));
        
        owners.push(...newOwners);
        
        console.log('  All owners from this nondh:', owners.map(o => `${o.name} ${o.isOldOwner ? '(old, area: ' + o.area.value + ')' : ''}`));
        return owners;
      })
      .flat()
      .filter(owner => owner.name.trim() !== '');
    
    console.log('\nAll owners before deduplication:', allOwners.map(o => `${o.name} (index: ${o.sortIndex})`));
    
    // Get unique owners - keep only the latest (highest sortIndex) for each name
    const uniqueOwnersMap = new Map();
    allOwners.forEach(owner => {
      const existing = uniqueOwnersMap.get(owner.name);
      if (!existing || existing.sortIndex < owner.sortIndex) {
        uniqueOwnersMap.set(owner.name, owner);
      }
    });
    
    const result = Array.from(uniqueOwnersMap.values());
    console.log('\nFinal unique owners:', result.map(o => `${o.name} (index: ${o.sortIndex})`));
    console.log('=== getAvailableOwnersForGanot END ===\n');
    return result;
      
  } else if (ganotType === "1st Right") {
    console.log('--- Processing 1st Right ---');
    const previousNondhs = allSortedNondhs.slice(0, currentIndex);
    console.log('Previous nondhs count:', previousNondhs.length);
    
    // Get old owners (excluding 2nd Right from Hukam with Radd/Na Manjoor status)
    console.log('\n--- Processing OLD OWNERS ---');
    const allOldOwners = previousNondhs
      .map((nondh, index) => {
        console.log(`\nProcessing nondh ${nondh.number} (index: ${index}) for OLD owners`);
        const detail = nondhDetails.find(d => d.nondhId === nondh.id);
        // Skip if no detail, is Hukam 2nd Right, OR status is invalid/nullified
        if (!detail || 
            (detail.type === "Hukam" && detail.ganot === "2nd Right") ||
            detail.status === 'invalid' || 
            detail.status === 'nullified') {
          console.log('  Skipped (no detail, Hukam 2nd Right, or Radd/Na Manjoor)');
          return [];
        }
        
        console.log('  Detail type:', detail.type);
        const isTransferType = ["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type);
        console.log('  Is transfer type:', isTransferType);
        
        // Get first valid S.No for display
        const firstSNo = (() => {
          const validAffectedSNos = nondh.affectedSNos
            ?.map(sNoItem => {
              try {
                const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
                return parsed.number || sNoItem;
              } catch (e) {
                return sNoItem;
              }
            })
            .filter(sNo => validSNos.has(sNo)) || [];
          
          return validAffectedSNos[0] || nondh.affectedSNos[0];
        })();
        
        const owners = [];
        
        // Add old owner with remaining area (if any remaining)
        if (isTransferType && detail.oldOwner && detail.oldOwner.trim() !== "") {
          console.log('  Old owner:', detail.oldOwner);
          
          // Calculate remaining area for old owner
          const newOwnersTotal = detail.ownerRelations
            .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
            .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
          
          // Find old owner's original area
          const oldOwnerOriginalArea = (() => {
            const nondhIndex = allSortedNondhs.findIndex(n => n.id === nondh.id);
            const priorNondhs = allSortedNondhs.slice(0, nondhIndex);
            
            for (let i = priorNondhs.length - 1; i >= 0; i--) {
              const priorDetail = nondhDetails.find(d => d.nondhId === priorNondhs[i].id);
              if (!priorDetail || priorDetail.status === 'invalid' || priorDetail.status === 'nullified') continue;
              
              const ownerRel = priorDetail.ownerRelations.find(rel => rel.ownerName === detail.oldOwner);
              if (ownerRel) {
                return ownerRel.area?.value || 0;
              }
            }
            return 0;
          })();
          
          const remainingArea = Math.max(0, oldOwnerOriginalArea - newOwnersTotal);
          console.log(`  Old owner remaining area: ${remainingArea}`);

          // Only include old owner if they have remaining area
          if (remainingArea > 0) {
            owners.push({
              id: `old-${detail.oldOwner}-${nondh.id}`,
              name: detail.oldOwner,
              area: { value: remainingArea, unit: detail.ownerRelations[0]?.area?.unit || 'sq_m' },
              sNo: firstSNo,
              nondhId: nondh.id,
              nondhType: detail.type,
              category: 'old',
              isOldOwner: true,
              sortIndex: index
            });
          }
        }
        
        // Add new owners (exclude old owner)
        const newOwners = detail.ownerRelations
          .filter(r => {
            if (!isTransferType) return true;
            const isNotOldOwner = r.ownerName !== detail.oldOwner;
            console.log(`    Owner "${r.ownerName}" - isNotOldOwner: ${isNotOldOwner}`);
            return isNotOldOwner;
          })
          .map(r => ({ 
            id: r.id,
            name: r.ownerName, 
            area: r.area,
            sNo: firstSNo,
            nondhId: nondh.id,
            nondhType: detail.type,
            category: 'old',
            isOldOwner: false,
            sortIndex: index
          }));
        
        owners.push(...newOwners);
        
        console.log('  Filtered OLD owners:', owners.map(r => `${r.name} ${r.isOldOwner ? '(old, area: ' + r.area.value + ')' : ''}`));
        return owners;
      })
      .flat()
      .filter(owner => owner.name.trim() !== '');

    console.log('\nAll OLD owners before deduplication:', allOldOwners.map(o => `${o.name} (index: ${o.sortIndex})`));

    // Get unique old owners
    const oldOwnersMap = new Map();
    allOldOwners.forEach(owner => {
      const existing = oldOwnersMap.get(owner.name);
      if (!existing || existing.sortIndex < owner.sortIndex) {
        console.log(`  Setting OLD owner "${owner.name}" with sortIndex ${owner.sortIndex}${existing ? ` (replacing sortIndex ${existing.sortIndex})` : ' (new)'}`);
        oldOwnersMap.set(owner.name, owner);
      } else {
        console.log(`  Skipping OLD owner "${owner.name}" with sortIndex ${owner.sortIndex} (keeping existing sortIndex ${existing.sortIndex})`);
      }
    });
    const oldOwners = Array.from(oldOwnersMap.values());
    console.log('\nFinal unique OLD owners:', oldOwners.map(o => `${o.name} (index: ${o.sortIndex})`));

    // Get new owners (2nd Right from previous Hukam nondhs) - ONLY if status is Pramanik (valid)
    console.log('\n--- Processing NEW OWNERS ---');
    const allNewOwners = previousNondhs
      .map((nondh, index) => {
        console.log(`\nProcessing nondh ${nondh.number} (index: ${index}) for NEW owners`);
        const detail = nondhDetails.find(d => d.nondhId === nondh.id);
        // Only include if it's Hukam 2nd Right AND status is valid (Pramanik)
        if (!detail || 
            !(detail.type === "Hukam" && detail.ganot === "2nd Right") ||
            detail.status !== 'valid') {
          console.log('  Skipped (not Hukam 2nd Right or not Pramanik status)');
          return [];
        }
        
        console.log('  Is Hukam 2nd Right with Pramanik status - including all owners');
        
        // Get first valid S.No for display
        const firstSNo = (() => {
          const validAffectedSNos = nondh.affectedSNos
            ?.map(sNoItem => {
              try {
                const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
                return parsed.number || sNoItem;
              } catch (e) {
                return sNoItem;
              }
            })
            .filter(sNo => validSNos.has(sNo)) || [];
          
          return validAffectedSNos[0] || nondh.affectedSNos[0];
        })();
        
        const relations = detail.ownerRelations.map(r => ({ 
          id: r.id,
          name: r.ownerName, 
          area: r.area,
          sNo: firstSNo,
          nondhId: nondh.id,
          nondhType: detail.type,
          category: 'new',
          isOldOwner: false,
          sortIndex: index
        }));
        
        console.log('  NEW owners:', relations.map(r => r.name));
        return relations;
      })
      .flat()
      .filter(owner => owner.name.trim() !== '');

    console.log('\nAll NEW owners before deduplication:', allNewOwners.map(o => `${o.name} (index: ${o.sortIndex})`));

    // Get unique new owners
    const newOwnersMap = new Map();
    allNewOwners.forEach(owner => {
      const existing = newOwnersMap.get(owner.name);
      if (!existing || existing.sortIndex < owner.sortIndex) {
        console.log(`  Setting NEW owner "${owner.name}" with sortIndex ${owner.sortIndex}${existing ? ` (replacing sortIndex ${existing.sortIndex})` : ' (new)'}`);
        newOwnersMap.set(owner.name, owner);
      } else {
        console.log(`  Skipping NEW owner "${owner.name}" with sortIndex ${owner.sortIndex} (keeping existing sortIndex ${existing.sortIndex})`);
      }
    });
    const newOwners = Array.from(newOwnersMap.values());
    console.log('\nFinal unique NEW owners:', newOwners.map(o => `${o.name} (index: ${o.sortIndex})`));

    console.log('=== getAvailableOwnersForGanot END ===\n');
    return { oldOwners, newOwners };
  }
  
  console.log('=== getAvailableOwnersForGanot END (no matching ganot type) ===\n');
  return [];
};

const getMinDateForNondh = (nondhId: string): string => {
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  const currentIndex = allSortedNondhs.findIndex(n => n.id === nondhId);
  
  if (currentIndex <= 0) return ''; // First nondh has no minimum date
  
  // Get the date of the previous nondh and add 1 day to prevent same date
  const prevNondhId = allSortedNondhs[currentIndex - 1].id;
  const prevDetail = nondhDetails.find(d => d.nondhId === prevNondhId);
  if (!prevDetail?.date) return '';
  
  const prevDate = new Date(prevDetail.date);
  // Create a new date to avoid modifying the original
  const minDate = new Date(prevDate);
  minDate.setDate(minDate.getDate() + 1);
  
  // Check if the date is valid after modification
  if (isNaN(minDate.getTime())) return '';
  
  return minDate.toISOString().split('T')[0];
};

const getMaxDateForNondh = (nondhId: string): string => {
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  const currentIndex = allSortedNondhs.findIndex(n => n.id === nondhId);
  
  if (currentIndex >= allSortedNondhs.length - 1) return ''; // Last nondh has no maximum date
  
  // Get the date of the next nondh and subtract 1 day to prevent same date
  const nextNondhId = allSortedNondhs[currentIndex + 1].id;
  const nextDetail = nondhDetails.find(d => d.nondhId === nextNondhId);
  if (!nextDetail?.date) return '';
  
  const nextDate = new Date(nextDetail.date);
  // Create a new date to avoid modifying the original
  const maxDate = new Date(nextDate);
  maxDate.setDate(maxDate.getDate() - 1);
  
  // Check if the date is valid after modification
  if (isNaN(maxDate.getTime())) return '';
  
  return maxDate.toISOString().split('T')[0];
};

  const handleHukamTypeChange = (detailId: string, hukamType: string) => {
  updateNondhDetail(detailId, { hukamType });
  
  // Reset ganot when changing hukam type
  if (hukamType !== "ALT Krushipanch") {
    updateNondhDetail(detailId, { ganot: "" });
  }
};

const getYearSlabAreaForDate = (date: string) => {
  if (!date) return null;
  
  const year = new Date(date).getFullYear();
  const matchingYearSlab = yearSlabs.find(slab => 
    year >= slab.startYear && year <= slab.endYear
  );
  
  if (!matchingYearSlab) return null;
  
  // Check if there are any paiky or ekatrikaran entries
const hasPaikyEntries = matchingYearSlab.paikyEntries && matchingYearSlab.paikyEntries.length > 0;
const hasEkatrikaranEntries = matchingYearSlab.ekatrikaranEntries && matchingYearSlab.ekatrikaranEntries.length > 0;

// Start with base area only if there are NO paiky/ekatrikaran entries
let totalArea = (hasPaikyEntries || hasEkatrikaranEntries) ? 0 : (matchingYearSlab.area?.value || 0);
const unit = matchingYearSlab.area?.unit || 'sq_m';
  
  // Sum paiky entries
  matchingYearSlab.paikyEntries?.forEach(entry => {
    if (entry.area?.unit === unit) {
      totalArea += entry.area.value || 0;
    } else {
      totalArea += convertAreaUnits(entry.area?.value || 0, entry.area?.unit || 'sq_m', unit);
    }
  });
  
  // Sum ekatrikaran entries  
  matchingYearSlab.ekatrikaranEntries?.forEach(entry => {
    if (entry.area?.unit === unit) {
      totalArea += entry.area.value || 0;
    } else {
      totalArea += convertAreaUnits(entry.area?.value || 0, entry.area?.unit || 'sq_m', unit);
    }
  });
  
  return { value: totalArea, unit };
};

const getSNoTypesFromSlabs = () => {
  const sNoTypes = new Map<string, "s_no" | "block_no" | "re_survey_no">();
  
  // Add S.Nos from land basic info (step 1)
  if (landBasicInfo) {
    // Survey Numbers from step 1
    if (landBasicInfo.sNo && landBasicInfo.sNo.trim() !== "") {
      const surveyNos = landBasicInfo.sNo.split(',').map(s => s.trim()).filter(s => s !== "");
      surveyNos.forEach(sNo => {
        sNoTypes.set(sNo, "s_no");
      });
    }
    
    // Block Number from step 1
    if (landBasicInfo.blockNo && landBasicInfo.blockNo.trim() !== "") {
      sNoTypes.set(landBasicInfo.blockNo, "block_no");
    }
    
    // Re-survey Number from step 1
    if (landBasicInfo.reSurveyNo && landBasicInfo.reSurveyNo.trim() !== "") {
      sNoTypes.set(landBasicInfo.reSurveyNo, "re_survey_no");
    }
  }
  
  // Add S.Nos from year slabs (step 2)
  yearSlabs.forEach(slab => {
    if (slab.sNo?.trim() !== "") {
      sNoTypes.set(slab.sNo, slab.sNoType);
    }
    
    slab.paikyEntries.forEach(entry => {
      if (entry.sNo?.trim() !== "") {
        sNoTypes.set(entry.sNo, entry.sNoType);
      }
    });
    
    slab.ekatrikaranEntries.forEach(entry => {
      if (entry.sNo?.trim() !== "") {
        sNoTypes.set(entry.sNo, entry.sNoType);
      }
    });
  });
  
  return sNoTypes;
}

const getPreviousOwners = (sNo: string, currentNondhId: string) => {
  // Get all nondhs sorted by priority
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  const currentIndex = allSortedNondhs.findIndex(n => n.id === currentNondhId);
  
  // Only look at nondhs that come BEFORE the current one
  const previousNondhs = allSortedNondhs.slice(0, currentIndex);

  // Track owners by name to keep only the most recent version
  const ownerMap = new Map();

  previousNondhs.forEach(nondh => {
    const detail = nondhDetails.find(d => d.nondhId === nondh.id);
    
    // Skip if no detail OR if status is invalid/nullified (Radd/Na Manjoor)
    if (!detail || detail.status === 'invalid' || detail.status === 'nullified') {
      return;
    }

    // Only include relevant nondh types
    if (!["Varsai", "Hakkami", "Vechand", "Vehchani", "Kabjedaar", "Ekatrikaran", "Hayati_ma_hakh_dakhal"].includes(detail.type)) {
      return;
    }

    // For transfer types, handle old owner specially
    const isTransferType = ["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type);
    
    if (isTransferType && detail.oldOwner) {
      // Calculate if old owner's area was completely distributed
      const newOwnersTotal = detail.ownerRelations
        .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      // Find old owner's original area from previous nondhs
      const oldOwnerOriginalArea = (() => {
        // Look backwards from this nondh to find old owner's area
        const nondhIndex = allSortedNondhs.findIndex(n => n.id === nondh.id);
        const priorNondhs = allSortedNondhs.slice(0, nondhIndex);
        
        for (let i = priorNondhs.length - 1; i >= 0; i--) {
          const priorDetail = nondhDetails.find(d => d.nondhId === priorNondhs[i].id);
          if (!priorDetail) continue;
          
          const ownerRel = priorDetail.ownerRelations.find(rel => rel.ownerName === detail.oldOwner);
          if (ownerRel) {
            return ownerRel.area?.value || 0;
          }
        }
        return 0;
      })();
      
      const remainingArea = oldOwnerOriginalArea - newOwnersTotal;
      
      // Update or add old owner with remaining area (0 if fully distributed)
      ownerMap.set(detail.oldOwner, {
        name: detail.oldOwner,
        area: { 
          value: Math.max(0, remainingArea), 
          unit: detail.ownerRelations[0]?.area?.unit || 'sq_m' 
        },
        type: detail.type,
        nondhId: nondh.id
      });
    }

    // Add/update new owners (for all types including transfer types)
    detail.ownerRelations.forEach(rel => {
      if (rel.ownerName.trim() === "") return;
      
      // For transfer types, skip old owner in relations (already handled above)
      if (isTransferType && rel.ownerName === detail.oldOwner) {
        return;
      }
      
      // Update owner in map (this will overwrite older versions)
      ownerMap.set(rel.ownerName, {
        name: rel.ownerName,
        area: rel.area,
        type: detail.type,
        nondhId: nondh.id
      });
    });
  });

  // Return array of unique owners (most recent version of each)
  return Array.from(ownerMap.values());
};


  // Form update functions
  const updateNondhDetail = (id: string, updates: Partial<NondhDetail>) => {
  setLocalState(prev => {
    const updatedNondhDetails = prev.nondhDetails.map(detail => 
      detail.id === id ? { ...detail, ...updates } : detail
    );
    
    const newState = {
      ...prev,
      nondhDetails: updatedNondhDetails
    };
    
    // Sync immediately without setTimeout
    const currentData = getStepData();
    updateStepData({ 
      ...currentData, 
      nondhDetails: updatedNondhDetails
    });
    
    return newState;
  });
}

  const toggleCollapse = (detailId: string) => {
  setLocalState(prev => {
    const newCollapsedNondhs = new Set(prev.collapsedNondhs);
    
    if (newCollapsedNondhs.has(detailId)) {
      newCollapsedNondhs.delete(detailId);
    } else {
      newCollapsedNondhs.add(detailId);
    }
    
    return {
      ...prev,
      collapsedNondhs: newCollapsedNondhs
    };
  });
};

  const toggleEqualDistribution = (detailId: string, checked: boolean) => {
  setLocalState(prev => {
    const newState = {
      ...prev,
      equalDistribution: {
        ...prev.equalDistribution,
        [detailId]: checked
      }
    };
    
    // Sync with step data
    const currentData = getStepData();
    updateStepData({
      ...currentData,
      equalDistribution: newState.equalDistribution
    });
    
    return newState;
  });
  
  // Apply equal distribution logic to ALL transfer types
  const detail = localState.nondhDetails.find(d => d.id === detailId);
  if (detail && checked) {
    const transferTypes = ["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"];
    
    if ((transferTypes.includes(detail.type) || (detail.type === "Hukam" && detail.ganot === "1st Right")) && detail.ownerRelations.length >= 1) {
      // For transfer types, distribute old owner's area equally among new owners
      const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
      const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
      const oldOwnerArea = selectedOldOwner?.area?.value || 0;
       // ADD: Calculate effective area considering year slab
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
        ? yearSlabArea.value 
        : oldOwnerArea;
      
        // ADD: Check if year slab exists and show warning
    if (yearSlabArea && oldOwnerArea > yearSlabArea.value) {
      toast({
        title: "Area capped to year slab limit",
        description: `Old owner area (${oldOwnerArea}) exceeds year slab limit (${yearSlabArea.value}). Distribution will use year slab limit.`,
        variant: "default"
      });
    }

      const newOwnersCount = detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length;
      
      const equalArea = newOwnersCount > 0 ? effectiveArea / newOwnersCount : effectiveArea; // Use effectiveArea
        
        const updatedRelations = detail.ownerRelations.map((relation) => {
          if (relation.ownerName === detail.oldOwner) {
            return relation; // Keep old owner relation as is
          }
          return { 
            ...relation, 
            area: { 
              ...relation.area, 
              value: equalArea 
            } 
          };
        });
        
        updateNondhDetail(detailId, { ownerRelations: updatedRelations });
      
    }
  }
};

 const addOwnerRelation = (detailId: string) => {
  const detail = nondhDetails.find((d) => d.id === detailId)
  if (detail) {
    // Get year slab area if date is available
    const yearSlabArea = detail.date ? getYearSlabAreaForDate(detail.date) : null;
    
    let defaultArea = { value: 0, unit: "sq_m" };
    
    if (yearSlabArea) {
      // Calculate already allocated area
      const allocatedArea = detail.ownerRelations.reduce((sum, rel) => {
        // For transfer types and 1st Right, exclude old owner from calculation
        if ((["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type) || 
            (detail.type === "Hukam" && detail.ganot === "1st Right")) && 
            rel.ownerName === detail.oldOwner) {
          return sum;
        }
        return sum + (rel.area?.value || 0);
      }, 0);
      
      const remainingArea = Math.max(0, yearSlabArea.value - allocatedArea);
      
      // Check if limit is exceeded
      if (allocatedArea >= yearSlabArea.value) {
        toast({
          title: "Area limit reached",
          description: `Year slab limit (${yearSlabArea.value.toFixed(2)} ${yearSlabArea.unit}) has been reached. Cannot add more owners.`,
          variant: "destructive"
        });
        return; // Don't add new owner if limit exceeded
      }
      
      // Show message if there's remaining area
      if (remainingArea > 0) {
        toast({
          title: "Area allocated",
          description: `Remaining area (${remainingArea.toFixed(2)} ${yearSlabArea.unit}) allocated to new owner.`,
          variant: "default"
        });
      }
      
      defaultArea = {
        value: remainingArea,
        unit: yearSlabArea.unit
      };
    }

    // Use consistent ID generation for new relations
    const newRelation = {
      id: `temp_rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ownerName: "",
      sNo: detail.sNo,
      area: defaultArea,
      tenure: "Navi",
      isValid: true
    };
    
    const updatedRelations = [...detail.ownerRelations, newRelation]
    
    // Only update owner relations, don't create a new detail
    updateNondhDetail(detailId, { ownerRelations: updatedRelations })
    
    if (equalDistribution[detailId] && updatedRelations.length > 1 && 
    !(detail.type === "Hukam" && detail.ganot === "2nd Right")) {
      const oldOwnerArea = updatedRelations[0]?.area?.value || 0
      const newOwnersCount = updatedRelations.length - 1
      const equalArea = oldOwnerArea / newOwnersCount
      
      const redistributed = updatedRelations.map((relation, index) => {
        if (index === 0) return relation
        return { ...relation, area: { ...relation.area, value: equalArea } }
      })
      
      updateNondhDetail(detailId, { ownerRelations: redistributed })
    }
  }
}

  const removeOwnerRelation = (detailId: string, relationId: string) => {
  const detail = nondhDetails.find((d) => d.id === detailId)
  if (detail) {
    const updatedRelations = detail.ownerRelations.filter((r) => r.id !== relationId)
    updateNondhDetail(detailId, { ownerRelations: updatedRelations })
    
    // ONLY apply equal distribution logic if NOT 2nd Right AND equal distribution is enabled
    if (equalDistribution[detailId] && 
        updatedRelations.length > 1 && 
        !(detail.type === "Hukam" && detail.ganot === "2nd Right")) {  // Add this check
      const oldOwnerArea = updatedRelations[0]?.area?.value || 0
      const newOwnersCount = updatedRelations.length - 1
      const equalArea = oldOwnerArea / newOwnersCount
      
      const redistributed = updatedRelations.map((relation, index) => {
        if (index === 0) return relation
        return { ...relation, area: { ...relation.area, value: equalArea } }
      })
      
      updateNondhDetail(detailId, { ownerRelations: redistributed })
    }
  }
}

  const updateOwnerRelation = (detailId: string, relationId: string, updates: any) => {
  const detail = nondhDetails.find((d) => d.id === detailId)
  if (detail) {
    // GLOBAL YEAR SLAB VALIDATION - applies to ALL nondh types
    if (updates.area) {
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      if (yearSlabArea) {
        // Calculate total area INCLUDING this update
        const totalWithUpdate = detail.ownerRelations.reduce((sum, rel) => {
          if (rel.id === relationId) {
            return sum + (updates.area?.value || 0);
          }
          return sum + (rel.area?.value || 0);
        }, 0);
        
        // Check against year slab limit
        if (totalWithUpdate > yearSlabArea.value) {
          const maxAllowedForThisOwner = yearSlabArea.value - detail.ownerRelations
            .filter(rel => rel.id !== relationId)
            .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
          
          toast({
            title: "Year slab limit exceeded",
            description: `Total area (${totalWithUpdate.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value}). Maximum allowed for this owner: ${Math.max(0, maxAllowedForThisOwner).toFixed(2)}`,
            variant: "destructive"
          });
          return; // Don't apply the update
        }
      }
    }
    
    // Year slab validation for transfer types
if (updates.area && (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail?.type || "") || 
    (detail?.type === "Hukam" && (detail?.ganot === "1st Right" || detail?.ganot === "2nd Right")))) {
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  if (yearSlabArea) {
    // Calculate new owners total (excluding old owner)
    const newOwnersTotalWithUpdate = detail.ownerRelations
      .filter(rel => rel.ownerName !== detail.oldOwner)
      .reduce((sum, rel) => {
        if (rel.id === relationId) {
          return sum + (updates.area?.value || 0);
        }
        return sum + (rel.area?.value || 0);
      }, 0);
    
    if (newOwnersTotalWithUpdate > yearSlabArea.value) {
      toast({
        title: "Area validation error",
        description: `Total new owners area (${newOwnersTotalWithUpdate.toFixed(2)}) cannot exceed year slab area (${yearSlabArea.value})`,
        variant: "destructive"
      });
      return;
    }
  }
}

    // If updating area, validate against old owner area
    if (updates.area && (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail?.type || "") || 
    (detail?.type === "Hukam" && (detail?.ganot === "1st Right")))) {
      const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
      const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
      const oldOwnerArea = selectedOldOwner?.area?.value || 0;
      
      const otherNewOwnersTotal = detail.ownerRelations
        .filter(rel => rel.id !== relationId && rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      const maxAllowedForThisOwner = oldOwnerArea - otherNewOwnersTotal;
      
      // Validate and cap the area value
      const validatedArea = {
        ...updates.area,
        value: validateAreaInput(updates.area.value || 0, updates.area, maxAllowedForThisOwner)
      };
      
      updates = { ...updates, area: validatedArea };
      
      // Show warning if area was capped
      if ((updates.area.value || 0) !== (updates.area.value || 0) && maxAllowedForThisOwner > 0) {
        toast({
          title: "Area adjusted",
          description: `Area capped to maximum allowed: ${maxAllowedForThisOwner}`,
          variant: "default"
        });
      } else if (maxAllowedForThisOwner <= 0) {
        toast({
          title: "Cannot assign area",
          description: "No remaining area available for new owners",
          variant: "destructive"
        });
        return;
      }
    }
    
    const updatedRelations = detail.ownerRelations.map((relation) =>
      relation.id === relationId ? { ...relation, ...updates } : relation,
    )
    updateNondhDetail(detailId, { ownerRelations: updatedRelations })
  }
}


  const handleFileUpload = async (file: File, detailId: string) => {
    try {
      setLoading(true)
      const path = `nondh-detail-documents/${Date.now()}_${file.name}`
      const url = await uploadFile(file, "land-documents", path)
      updateNondhDetail(detailId, { docUpload: url, hasDocuments: true })
      toast({ title: "File uploaded successfully" })
    } catch (error) {
      toast({ title: "Error uploading file", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const validateNondhDetails = (details: NondhDetail[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  details.forEach((detail, index) => {
    const nondhNumber = nondhs.find(n => n.id === detail.nondhId)?.number || index + 1;
    
    // Common required fields for all types
    if (!detail.type.trim()) {
      errors.push(`Nondh ${nondhNumber}: Type is required`);
    }
    if (!detail.date.trim()) {
      errors.push(`Nondh ${nondhNumber}: Date is required`);
    }

    if (!detail.vigat || !detail.vigat.trim()) {
      errors.push(`Nondh ${nondhNumber}: Vigat is required`);
    }

    // GLOBAL YEAR SLAB VALIDATION
  if (detail.date) {
    const yearSlabArea = getYearSlabAreaForDate(detail.date);
    if (yearSlabArea) {
      const totalOwnerArea = detail.ownerRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      if (totalOwnerArea > yearSlabArea.value) {
        errors.push(`Nondh ${nondhNumber}: Total owner area (${totalOwnerArea.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value})`);
      }
    }
  }
  
    // Owner name validation
    // const hasValidOwnerName = detail.ownerRelations.some(rel => rel.ownerName.trim() !== "");
    // const is1stRightHukam = detail.type === "Hukam" && detail.ganot === "1st Right";

    // if (!hasValidOwnerName && !is1stRightHukam) {
    //   errors.push(`Nondh ${nondhNumber}: At least one owner name is required`);
    // }
    
    // Status-specific validation - only Radd requires reason
    if (detail.status === "invalid" && (!detail.invalidReason || !detail.invalidReason.trim())) {
      errors.push(`Nondh ${nondhNumber}: Reason is required when status is Radd`);
    }
    
    // Type-specific validations
    switch (detail.type) {
      // case "Vehchani":
      // case "Varsai":
      // case "Hakkami": 
      // case "Vechand":
      // case "Hayati_ma_hakh_dakhal":
      //   if (!detail.oldOwner || !detail.oldOwner.trim()) {
      //     errors.push(`Nondh ${nondhNumber}: Old Owner is required for ${detail.type} type`);
      //   }
      //   break;
        
      case "Hukam":
       
        // Validate affected nondh details
        const affectedDetails = affectedNondhDetails[detail.id] || [];
        affectedDetails.forEach((affected, idx) => {
          if (affected.status === "invalid" && (!affected.invalidReason || !affected.invalidReason.trim())) {
            errors.push(`Nondh ${nondhNumber}, Affected Nondh ${idx + 1}: Reason is required when status is Radd`);
          }
        });
        break;
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// validation function before saveChanges
const validateOwnerAreas = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  nondhDetails.forEach((detail) => {
    const nondhNumber = nondhs.find(n => n.id === detail.nondhId)?.number || '?';
    
    // Check transfer types and 1st Right Hukam
    if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type) || 
        (detail.type === "Hukam" && detail.ganot === "1st Right")) {
      
      const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
      const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
      const oldOwnerArea = selectedOldOwner?.area?.value || 0;
      
      // Calculate new owners total (excluding old owner)
      const newOwnersTotal = detail.ownerRelations
        .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      // Check against old owner area
      if (newOwnersTotal > oldOwnerArea) {
        errors.push(
          `Nondh ${nondhNumber}: Total new owners area (${newOwnersTotal.toFixed(2)}) exceeds old owner's area (${oldOwnerArea.toFixed(2)})`
        );
      }
      
      // Check against year slab limit
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      if (yearSlabArea && newOwnersTotal > yearSlabArea.value) {
        errors.push(
          `Nondh ${nondhNumber}: Total new owners area (${newOwnersTotal.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value.toFixed(2)})`
        );
      }
      
      // Individual owner validation
      detail.ownerRelations
        .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .forEach((rel, idx) => {
          const otherNewOwnersTotal = detail.ownerRelations
            .filter(r => r.id !== rel.id && r.ownerName !== detail.oldOwner && r.ownerName.trim() !== "")
            .reduce((sum, r) => sum + (r.area?.value || 0), 0);
          
          const maxFromOldOwner = Math.max(0, oldOwnerArea - otherNewOwnersTotal);
          const maxFromYearSlab = yearSlabArea ? Math.max(0, yearSlabArea.value - otherNewOwnersTotal) : Infinity;
          const maxAllowed = Math.min(maxFromOldOwner, maxFromYearSlab);
          
          if (rel.area?.value > maxAllowed) {
            errors.push(
              `Nondh ${nondhNumber}, Owner "${rel.ownerName}": Area (${rel.area.value.toFixed(2)}) exceeds maximum allowed area (${maxAllowed.toFixed(2)})`
            );
          }
        });
    }
    
    // Check for ALL nondh types - global year slab validation
    if (detail.date) {
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      if (yearSlabArea) {
        const totalOwnerArea = detail.ownerRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
        
        if (totalOwnerArea > yearSlabArea.value) {
          errors.push(
            `Nondh ${nondhNumber}: Total owner area (${totalOwnerArea.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value.toFixed(2)})`
          );
        }
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// function to recalculate validity based on current order
const recalculateOwnerValidity = () => {
  const sortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Build a map of nondh details
  const nondhDetailMap = new Map<string, NondhDetail>();
  nondhDetails.forEach(detail => {
    nondhDetailMap.set(detail.nondhId, detail);
  });
  
  // Count affecting invalid nondhs for each nondh
  const affectingCounts = new Map<string, number>();
  sortedNondhs.forEach((nondh, index) => {
    let count = 0;
    // Look at all nondhs that come AFTER this one
    for (let i = index + 1; i < sortedNondhs.length; i++) {
      const affectingNondh = sortedNondhs[i];
      const affectingDetail = nondhDetailMap.get(affectingNondh.id);
      
      // Count if the affecting nondh is invalid
      if (affectingDetail?.status === 'invalid') {
        count++;
      }
    }
    affectingCounts.set(nondh.id, count);
  });
  
  // Update owner relation validity
  const updatedDetails = nondhDetails.map(detail => {
    const affectingCount = affectingCounts.get(detail.nondhId) || 0;
    const shouldBeValid = affectingCount % 2 === 0;
    
    // Update all owner relations with the correct validity
    const updatedRelations = detail.ownerRelations.map(relation => ({
      ...relation,
      isValid: shouldBeValid
    }));
    
    return {
      ...detail,
      ownerRelations: updatedRelations
    };
  });
  
  return updatedDetails;
};

  const saveChanges = async () => {
  if (!hasChanges) return;
  
  try {
    setSaving(true);

    // FIX: Get current nondh numbers from database
    const { data: currentNondhData, error: nondhError } = await LandRecordService.getNondhsforDetails(recordId);
    if (nondhError) throw nondhError;
    
    const currentNondhNumbers = new Set(
      (currentNondhData || []).map(nondh => nondh.number.toString())
    );

    // FIX: Filter out details for nondhs that no longer exist
    const validDetails = nondhDetails.filter(detail => {
      const nondh = nondhs.find(n => n.id === detail.nondhId);
      if (!nondh) return false;
      
      const existsInCurrent = currentNondhNumbers.has(nondh.number.toString());
      if (!existsInCurrent) {
        console.log(`Filtering out detail for deleted nondh no: ${nondh.number}`);
      }
      return existsInCurrent;
    });

    // ✅ NEW: Validate owner areas before saving
    const areaValidation = validateOwnerAreas();
    if (!areaValidation.isValid) {
      toast({
        title: "Area Validation Failed",
        description: areaValidation.errors.slice(0, 3).join('; ') + 
          (areaValidation.errors.length > 3 ? `; and ${areaValidation.errors.length - 3} more errors` : ''),
        variant: "destructive"
      });
      return;
    }

    // Existing validation
    const validation = validateNondhDetails(validDetails);
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join('; '),
        variant: "destructive"
      });
      return;
    }

    // ✅ NEW: Recalculate validity chain before saving
    console.log('Recalculating owner validity based on current order...');
    const detailsWithUpdatedValidity = recalculateOwnerValidity();
    
    // Use the details with updated validity
    const processedDetails = detailsWithUpdatedValidity.map(detail => detail);

    // Handle empty dates
    processedDetails.forEach(detail => {
      if (detail.date === "") detail.date = null;
      if (detail.hukamDate === "") detail.hukamDate = null;
    });

    // Transform data
    const changes = processedDetails.map(detail => {
      const transformedDetail = {
        ...transformForDB(detail),
        old_owner: detail.oldOwner?.includes('-') 
          ? processedDetails.find(d => d.nondhId === detail.oldOwner)?.ownerRelations[0]?.ownerName || detail.oldOwner
          : detail.oldOwner,
        affected_nondh_details: affectedNondhDetails[detail.id]?.length > 0 
          ? JSON.stringify(affectedNondhDetails[detail.id])
          : null
      };

      return { id: detail.id, changes: transformedDetail };
    });

    console.log('Starting save process...');
    console.log('Original details IDs:', originalDetails.map(d => d.id));
    console.log('Current details IDs:', processedDetails.map(d => d.id));

    // CRITICAL: Map to track ID changes
    const idMap = new Map<string, string>();

    // Rest of your save logic remains the same...
    // (Keep all the existing save code from STEP 1, STEP 2, STEP 3)

    console.log('Starting save process...');
    console.log('Original details IDs:', originalDetails.map(d => d.id));
    console.log('Current details IDs:', processedDetails.map(d => d.id));

    // ========================================
    // STEP 1: Save ALL nondh details FIRST
    // ========================================
    console.log('\n=== STEP 1: Saving nondh details ===');
    for (const change of changes) {
      const detail = processedDetails.find(d => d.id === change.id);
      if (!detail) continue;
      
      // FIX: Check if this nondhId already has a saved detail in originalDetails with REAL ID
      const originalDetailForNondh = originalDetails.find(od => 
        od.nondhId === detail.nondhId && !od.id.toString().startsWith('temp_')
      );
      
      const isTempDetail = detail.id.toString().startsWith('temp_');
      const hasSavedDetail = !!originalDetailForNondh;
      
      console.log(`Processing detail for nondhId: ${detail.nondhId} (current ID: ${detail.id}, temp: ${isTempDetail}, hasSavedDetail: ${hasSavedDetail})`);
      
      if (isTempDetail && !hasSavedDetail) {
        // This is a truly new detail that doesn't exist in DB
        console.log('  Creating new detail...');
        const { data: createdDetail, error } = await LandRecordService.createNondhDetail(change.changes);
        
        if (error) {
          console.error('  Error creating:', error);
          throw error;
        }
        
        console.log(`  Created with ID: ${createdDetail.id}`);
        idMap.set(detail.id, createdDetail.id);
        detail.id = createdDetail.id;
      } else {
        // UPDATE existing detail - use the REAL ID from originalDetails if available
        const detailIdToUse = hasSavedDetail ? originalDetailForNondh.id : detail.id;
        console.log(`  Updating existing detail with ID: ${detailIdToUse}...`);
        const { error } = await LandRecordService.updateNondhDetail(detailIdToUse, change.changes);
        
        if (error) {
          console.error('  Error updating:', error);
          throw error;
        }
        
        // Update mapping if we used a different ID
        if (hasSavedDetail && detailIdToUse !== detail.id) {
          idMap.set(detail.id, detailIdToUse);
          detail.id = detailIdToUse;
        }
        console.log('  Updated successfully');
      }
    }

    // Update step data with all new IDs at once
    console.log('\nUpdating step data with new IDs...');
    const currentStepData = getStepData();
    const updatedStepNondhDetails = processedDetails.map(detail => ({
      ...detail,
      id: idMap.get(detail.id) || detail.id
    }));
    updateStepData({
      ...currentStepData,
      nondhDetails: updatedStepNondhDetails
    });

    // ========================================
    // STEP 2: Now process owner relations
    // ========================================
    console.log('\n=== STEP 2: Processing owner relations ===');

    for (const detail of processedDetails) {
      // Use the REAL ID (after creation/update)
      const actualDetailId = detail.id; // Already updated in STEP 1
      console.log(`\nProcessing relations for detail ${actualDetailId}`);
      
      const originalDetail = originalDetails.find(d => {
        // Match by original temp ID or real ID
        const originalId = Array.from(idMap.entries()).find(([_, realId]) => realId === actualDetailId)?.[0];
        return d.id === (originalId || actualDetailId);
      });
      
      const validOwnerRelations = detail.ownerRelations.filter(
        relation => relation.ownerName && relation.ownerName.trim() !== ""
      );
      
      console.log(`  Valid owners: ${validOwnerRelations.length}`);

      // Get ALL existing relations from database
      const { data: existingDbRelations, error: fetchRelationsError } = await supabase
        .from('nondh_owner_relations')
        .select('id, owner_name')
        .eq('nondh_detail_id', actualDetailId);
      
      if (fetchRelationsError) {
        console.error('  Error fetching existing relations:', fetchRelationsError);
        throw fetchRelationsError;
      }
      
      const existingDbRelationIds = existingDbRelations?.map(r => r.id) || [];
      console.log(`  Existing DB relations: ${existingDbRelationIds.length}`);

      // Process each relation
      for (const relation of validOwnerRelations) {
        const isTempRelation = relation.id.toString().startsWith('temp_rel_');
        const existsInDb = existingDbRelationIds.includes(relation.id);
        
        console.log(`  Processing ${relation.ownerName} (temp: ${isTempRelation}, exists: ${existsInDb})`);
        
        if (isTempRelation || !existsInDb) {
          // CREATE
          console.log('    Creating relation...');
          const { data: createdRelation, error } = await LandRecordService.createNondhOwnerRelation({
            ...transformOwnerRelationForDB(relation),
            nondh_detail_id: actualDetailId // Use the REAL detail ID
          });
          
          if (error) {
            console.error('    Error creating relation:', error);
            throw error;
          }
          
          console.log(`    Created with ID: ${createdRelation.id}`);
          
          // Update local reference
          const relationIndex = detail.ownerRelations.findIndex(r => r.id === relation.id);
          if (relationIndex !== -1) {
            detail.ownerRelations[relationIndex].id = createdRelation.id;
          }
        } else {
          // UPDATE
          console.log('    Updating relation...');
          const { error } = await LandRecordService.updateNondhOwnerRelation(
            relation.id,
            transformOwnerRelationForDB(relation)
          );
          
          if (error) {
            console.error('    Error updating relation:', error);
            throw error;
          }
          console.log('    Updated');
        }
      }
      
      // Delete removed relations
      const currentRelationIds = validOwnerRelations.map(r => r.id);
      const relationsToDelete = existingDbRelationIds.filter(dbId => 
        !currentRelationIds.includes(dbId)
      );
      
      if (relationsToDelete.length > 0) {
        console.log(`  Deleting ${relationsToDelete.length} relations...`);
        for (const relationIdToDelete of relationsToDelete) {
          const { error } = await LandRecordService.deleteNondhOwnerRelation(relationIdToDelete);
          if (error) {
            console.error('    Error deleting relation:', error);
            throw error;
          }
        }
        console.log('  Deleted successfully');
      }
    }

    // ========================================
    // STEP 3: Refresh from database
    // ========================================
    console.log('\n=== STEP 3: Refreshing from database ===');
    const { data: updatedDetails, error: refreshError } = await LandRecordService.getNondhDetailsWithRelations(recordId || '');
    if (refreshError) throw refreshError;

    const transformed = (updatedDetails || []).map((detail: any) => ({
      id: detail.id,
      nondhId: detail.nondh_id,
      sNo: detail.s_no,
      type: detail.type,
      date: detail.date || "",
      vigat: detail.vigat || "",
      status: detail.status || "valid",
      invalidReason: detail.invalid_reason || "",
      showInOutput: detail.show_in_output !== false,
      hasDocuments: detail.has_documents || false,
      docUpload: detail.doc_upload_url || "",
      oldOwner: detail.old_owner || "",
      hukamDate: detail.hukam_date || "",
      hukamType: detail.hukam_type || "SSRD",
      hukamStatus: detail.hukam_status || "valid",
      hukamInvalidReason: detail.hukam_invalid_reason || "",
      ganot: detail.ganot || "",
      restrainingOrder: detail.restraining_order || "no",
      sdDate: detail.sd_date || "",
      tenure: detail.tenure || "Navi",
      amount: detail.amount || null,
      affectedNondhDetails: detail.affected_nondh_details 
        ? JSON.parse(detail.affected_nondh_details) 
        : [],
      ownerRelations: (detail.owner_relations || []).map((rel: any) => ({
        id: rel.id,
        ownerName: rel.owner_name,
        sNo: rel.s_no,
        area: {
          value: rel.square_meters || (rel.acres * SQM_PER_ACRE + rel.gunthas * SQM_PER_GUNTHA),
          unit: rel.area_unit as 'acre_guntha' | 'sq_m',
          acres: rel.acres,
          gunthas: rel.gunthas
        },
        isValid: rel.is_valid !== false,
        surveyNumber: rel.survey_number || "",
        surveyNumberType: rel.survey_number_type || "s_no"
      }))
    }));

    console.log('Refreshed details:', transformed.map(d => ({ id: d.id, owners: d.ownerRelations.length })));

    setNondhDetails(transformed);
    setOriginalDetails(JSON.parse(JSON.stringify(transformed)));
    
    const refreshedAffectedDetails = {};
    transformed.forEach(detail => {
      if (detail.affectedNondhDetails?.length > 0) {
        refreshedAffectedDetails[detail.id] = detail.affectedNondhDetails;
      }
    });
    setAffectedNondhDetails(refreshedAffectedDetails);
    setOriginalAffectedNondhDetails(JSON.parse(JSON.stringify(refreshedAffectedDetails)));
    
    // Update step data with final refreshed state
    updateStepData({
      ...currentStepData,
      nondhDetails: transformed,
      originalDetails: transformed,
      affectedNondhDetails: refreshedAffectedDetails,
      originalAffectedNondhDetails: JSON.parse(JSON.stringify(refreshedAffectedDetails))
    });
    
    // Update land record status to "drafting"
    await LandRecordService.updateLandRecord(recordId, {
      status: "drafting",
      current_step: 3  // Nondh details is step 3
    });

    // Create activity log
    await createActivityLog({
      user_email: user?.primaryEmailAddress?.emailAddress || "",
      land_record_id: recordId,
      step: 3,
      chat_id: null,
      description: `Updated nondh details and owner relations. Details count: ${processedDetails.length}`
    });

    setHasChanges(false);
    refreshStatus();
    toast({ title: "Changes saved successfully" });
    setCurrentStep(6);
    
  } catch (error) {
    console.error('Error saving changes:', error);
    toast({
      title: "Error saving changes",
      description: error instanceof Error ? error.message : "Unknown error occurred",
      variant: "destructive"
    });
  } finally {
    setSaving(false);
  }
};

  const transformForDB = (data: any) => {
  return {
    nondh_id: data.nondhId,
    s_no: data.sNo,
    type: data.type,
    date: data.date || null,
    vigat: data.vigat,
    status: data.status,
    invalid_reason: data.invalidReason,
    show_in_output: data.showInOutput,
    has_documents: data.hasDocuments,
    doc_upload_url: data.docUpload,
    old_owner: data.oldOwner,
    hukam_status: data.hukamStatus,
    hukam_invalid_reason: data.hukamInvalidReason,
    hukam_type: data.hukamType,
    hukam_date: data.hukamDate,
    ganot: data.ganot,
    tenure: data.tenure,
    restraining_order: data.restrainingOrder === 'yes',
    affected_nondh_details: affectedNondhDetails[data.id] && affectedNondhDetails[data.id].length > 0 
      ? JSON.stringify(affectedNondhDetails[data.id]) 
      : null
  }
}

  const transformOwnerRelationForDB = (data: any) => {
  const isAcreGuntha = data.area?.unit === 'acre_guntha';
  return {
    owner_name: data.ownerName,
    s_no: data.sNo,
    acres: isAcreGuntha ? data.area?.acres : null,
    gunthas: isAcreGuntha ? data.area?.gunthas : null,
    square_meters: isAcreGuntha ? null : data.area?.value,
    area_unit: data.area?.unit || 'sq_m',
    is_valid: data.isValid,
    survey_number: data.surveyNumber || null,
survey_number_type: data.surveyNumberType || null
  }
}

  const renderOwnerSelectionFields = (detail: NondhDetail) => {
  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  
  const hakkamiPreviousOwners = detail.type === "Hakkami" 
    ? getPreviousOwners(detail.sNo, detail.nondhId)
    : [];

    const vehchaniPreviousOwners = detail.type === "Vehchani" 
  ? getPreviousOwners(detail.sNo, detail.nondhId)
  : [];

  return (
    <div className="space-y-4">
      {/* SD Date and Amount fields for Vechand */}
      {detail.type === "Vechand" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SD Date</Label>
            <Input
              type="date"
              value={detail.sdDate || ''}
              onChange={(e) => {
    const value = e.target.value;
    updateNondhDetail(detail.id, { 
      date: value === '' ? null : value
    });
  }}
            />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={detail.amount || ''}
              onChange={(e) => updateNondhDetail(detail.id, { amount: parseFloat(e.target.value) || 0 })}
              placeholder="Enter amount"
            />
          </div>
        </div>
      )}

      {/* Old Owner Field - shown for all types */}
      <div className="space-y-2">
        <Label>Old Owner *</Label>
        <Select
  value={detail.oldOwner}
  onValueChange={(value) => {
  const selectedOwner = previousOwners.find(owner => 
    owner.name === value
  );
  
  if (selectedOwner) {
    updateNondhDetail(detail.id, { 
      oldOwner: selectedOwner.name
    });
    
    // Only auto-apply equal distribution for types that should have default owners
    const shouldAutoApplyEqualDist = !["Hakkami", "Vehchani"].includes(detail.type);
    
    // ADD THIS: For Hakkami and Vehchani, ensure no owner relations are created
    if (["Hakkami", "Vehchani"].includes(detail.type)) {
      // Explicitly set empty owner relations if somehow any got created
      if (detail.ownerRelations.length > 0) {
        updateNondhDetail(detail.id, { ownerRelations: [] });
      }
      return; // Don't proceed further for these types
    }
    
    if (equalDistribution[detail.id] && shouldAutoApplyEqualDist) {
      setTimeout(() => {
        toggleEqualDistribution(detail.id, true);
      }, 100);
    }
  }
}}
>
          <SelectTrigger>
            <SelectValue placeholder="Select Old Owner" />
          </SelectTrigger>
          <SelectContent>
            {previousOwners.map((owner, index) => (
              <SelectItem key={`${owner.name}_${index}`} value={owner.name}>
                {owner.name} ({owner.area.value} {owner.area.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

{/* Vehchani Section */}
      {detail.type === "Vehchani" && (
  <div className="space-y-4">
    
    {/* Available Previous Owners as Checkboxes for NEW owners only */}
    <div className="space-y-2">
      <Label>Select New Owners *</Label>
      <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
        {vehchaniPreviousOwners
          .filter(owner => owner.name !== detail.oldOwner)
          .map((owner, index) => {
            const isSelected = detail.ownerRelations.some(rel => 
              rel.ownerName === owner.name && rel.ownerName !== detail.oldOwner
            );
            
            return (
              <div key={`vehchani_${owner.name}_${index}`} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`vehchani_owner_${index}`}
                  checked={isSelected}
onCheckedChange={(checked) => {
  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
  
  let updatedRelations = [...detail.ownerRelations];
  
  if (checked) {
     const yearSlabArea = getYearSlabAreaForDate(detail.date);
    const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
      ? yearSlabArea.value 
      : oldOwnerArea;
    
    // Calculate area for new owner
    let newOwnerArea = 0;
    if (equalDistribution[detail.id]) {
      const newOwnersCount = updatedRelations.filter(rel => rel.ownerName !== detail.oldOwner).length + 1;
      newOwnerArea = effectiveArea / newOwnersCount; // Use effectiveArea instead of oldOwnerArea
    }
    
    const newRelation = {
      id: Date.now().toString() + Math.random(),
      ownerName: owner.name,
      sNo: detail.sNo,
      area: { 
        value: newOwnerArea, 
        unit: owner.area.unit 
      },
      tenure: "Navi",
      isValid: true
    };
    updatedRelations.push(newRelation);
  } else {
    updatedRelations = updatedRelations.filter(rel => 
      rel.ownerName !== owner.name || rel.ownerName === detail.oldOwner
    );
  }
  
  updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
  
  // Re-apply equal distribution if enabled
  if (equalDistribution[detail.id]) {
    setTimeout(() => {
      toggleEqualDistribution(detail.id, true);
    }, 100);
  }
}}
                />
                <Label htmlFor={`vehchani_owner_${index}`} className="flex-1">
                  {owner.name} ({owner.area.value} {owner.area.unit})
                </Label>
              </div>
            );
          })}
      </div>
    </div>
  </div>
)}
      {/* Hakkami Section */}
      {detail.type === "Hakkami" && (
  <div className="space-y-4">
    
    {/* Available Previous Owners as Checkboxes for NEW owners only */}
    <div className="space-y-2">
      <Label>Select New Owners *</Label>
      <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
        {hakkamiPreviousOwners
          .filter(owner => owner.name !== detail.oldOwner)
          .map((owner, index) => {
            const isSelected = detail.ownerRelations.some(rel => 
              rel.ownerName === owner.name && rel.ownerName !== detail.oldOwner
            );
            
            return (
              <div key={`hakkami_${owner.name}_${index}`} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`hakkami_owner_${index}`}
                  checked={isSelected}
onCheckedChange={(checked) => {
  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
  
  let updatedRelations = [...detail.ownerRelations];
  
  if (checked) {
     // Calculate effective area
    const yearSlabArea = getYearSlabAreaForDate(detail.date);
    const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
      ? yearSlabArea.value 
      : oldOwnerArea;
    
    // Calculate area for new owner
    let newOwnerArea = 0;
    if (equalDistribution[detail.id]) {
      const newOwnersCount = updatedRelations.filter(rel => rel.ownerName !== detail.oldOwner).length + 1;
      newOwnerArea = effectiveArea / newOwnersCount;
    }
    
    const newRelation = {
      id: Date.now().toString() + Math.random(),
      ownerName: owner.name,
      sNo: detail.sNo,
      area: { 
        value: newOwnerArea, 
        unit: owner.area.unit 
      },
      tenure: "Navi",
      isValid: true
    };
    updatedRelations.push(newRelation);
  } else {
    updatedRelations = updatedRelations.filter(rel => 
      rel.ownerName !== owner.name || rel.ownerName === detail.oldOwner
    );
  }
  
  updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
  
  // Re-apply equal distribution if enabled
  if (equalDistribution[detail.id]) {
    setTimeout(() => {
      toggleEqualDistribution(detail.id, true);
    }, 100);
  }
}}
                />
                <Label htmlFor={`hakkami_owner_${index}`} className="flex-1">
                  {owner.name} ({owner.area.value} {owner.area.unit})
                </Label>
              </div>
            );
          })}
      </div>
    </div>
  </div>
)}

      {/* Owner Details Section for Hayati, Varsai, and Vechand */}
{(detail.type === "Varsai" || detail.type === "Hayati_ma_hakh_dakhal" || detail.type === "Vechand" || detail.type === "Hakkami" || detail.type === "Vehchani" || (detail.type === "Hukam" && detail.ganot === "1st Right")) && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Label>{detail.type === "Hukam" && detail.ganot === "1st Right" ? "New Ganot Details" : "New Owner Details"}</Label>
      <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
        <Plus className="w-4 h-4 mr-2" />
        Add New Owner
      </Button>
    </div>

    {/* Area Distribution Header */}
<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
  <div className="flex justify-between items-start mb-3">
    <div>
      <h4 className="font-medium text-blue-800">Area Distribution Control</h4>
      <p className="text-sm text-blue-600 mt-1">
        Old Owner: <strong>{detail.oldOwner}</strong> - 
        Total Area: <strong>{(() => {
          const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
          const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
          return selectedOldOwner?.area?.value || 0;
        })()} {detail.ownerRelations[0]?.area?.unit || 'sq_m'}</strong>
      </p>
    </div>
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`equal_dist_${detail.id}`}
        checked={equalDistribution[detail.id] || false}
        onCheckedChange={(checked) => toggleEqualDistribution(detail.id, checked as boolean)}
        disabled={detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length < 1}
      />
      <Label htmlFor={`equal_dist_${detail.id}`} className="text-blue-800 font-medium">
        Equal Distribution
        {detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length <= 1 && 
          " (Need atleast 1 new owner)"}
      </Label>
    </div>
  </div>
  
  {/* Real-time Area Summary */}
  {(() => {
    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
    const newOwners = detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner);
    const newOwnersTotal = newOwners.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    const remaining = oldOwnerArea - newOwnersTotal;
    const isBalanced = Math.abs(remaining) < 0.01;
    const yearSlabArea = getYearSlabAreaForDate(detail.date);
const exceedsYearSlab = yearSlabArea && (newOwnersTotal > yearSlabArea.value);

    return (
      <div className={`p-3 rounded text-sm ${
    remaining < 0 || exceedsYearSlab ? 'bg-red-100 text-red-700 border border-red-300' : 
    isBalanced ? 'bg-green-100 text-green-700 border border-green-300' : 
    'bg-yellow-100 text-yellow-700 border border-yellow-300'
  }`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-semibold">Old Owner Area</div>
            <div>{oldOwnerArea.toFixed(2)}</div>
          </div>
          <div>
            <div className="font-semibold">New Owners Total</div>
            <div>{newOwnersTotal.toFixed(2)}</div>
          </div>
          <div>
            <div className="font-semibold">Remaining</div>
            <div className={remaining < 0 ? 'font-bold' : ''}>
              {remaining.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="font-semibold">Status</div>
            <div>
              {remaining < 0 ? '⚠️ Exceeded!' : 
               isBalanced ? '✓ Balanced' : 
               '⚠️ Not distributed'}
            </div>
          </div>
        </div>
        {yearSlabArea && (
      <div className="mt-2 text-center text-xs">
        Year Slab Limit: {yearSlabArea.value} {yearSlabArea.unit}
        {exceedsYearSlab && <span className="text-red-700 font-bold ml-2">⚠️ Exceeded!</span>}
      </div>
    )}
        {equalDistribution[detail.id] && newOwners.length > 0 && (
  <div className="mt-2 pt-2 border-t border-blue-200 text-center">
    <strong>Equal Distribution:</strong> {(() => {
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
        ? yearSlabArea.value 
        : oldOwnerArea;
      return (effectiveArea / newOwners.length).toFixed(4);
    })()} each
  </div>
)}
      </div>
    );
  })()}
</div>

    {detail.ownerRelations
      .filter(relation => relation.ownerName !== detail.oldOwner) // Only show new owners
      .map((relation, index) => (
      <Card key={relation.id} className="p-3">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium">New Owner {index + 1}</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeOwnerRelation(detail.id, relation.id)}
            className="text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="space-y-2">
            <Label>Owner Name</Label>
            <Input
              value={relation.ownerName}
              onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
              placeholder="Enter new owner name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Area</Label>
          {areaFields({
  area: relation.area,
  onChange: (newArea) => {
  // Validate area for transfer types
  if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail?.type || "") || 
      (detail?.type === "Hukam" && detail?.ganot === "1st Right")) {
    
    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
    
    // ADD: Year slab validation
    const yearSlabArea = getYearSlabAreaForDate(detail.date);
    if (yearSlabArea) {
      const otherNewOwnersTotal = detail.ownerRelations
        .filter(rel => rel.id !== relation.id && rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
      
      // Check year slab limit first
      if (proposedTotal > yearSlabArea.value) {
        toast({
          title: "Area validation error",
          description: `Total area (${proposedTotal.toFixed(2)}) would exceed year slab limit (${yearSlabArea.value}). Maximum allowed for this owner: ${Math.max(0, yearSlabArea.value - otherNewOwnersTotal).toFixed(2)}`,
          variant: "destructive"
        });
        return;
      }
    }
    
    // Then check old owner area
    const otherNewOwnersTotal = detail.ownerRelations
      .filter(rel => rel.id !== relation.id && rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    
    const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
    
    if (proposedTotal > oldOwnerArea) {
      toast({
        title: "Area validation error",
        description: `Total area would exceed old owner's area (${oldOwnerArea}). Maximum allowed for this owner: ${oldOwnerArea - otherNewOwnersTotal}`,
        variant: "destructive"
      });
      return;
    }
  }
  
  updateOwnerRelation(detail.id, relation.id, { area: newArea });
},
  disabled: equalDistribution[detail.id],
  maxValue: (() => {
  if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail?.type || "") || 
      (detail?.type === "Hukam" && detail?.ganot === "1st Right")) {
    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
    
    const otherNewOwnersTotal = detail.ownerRelations
      .filter(rel => rel.id !== relation.id && rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    
    const maxFromOldOwner = Math.max(0, oldOwnerArea - otherNewOwnersTotal);
    
    // ADD: Also check year slab limit
    const yearSlabArea = getYearSlabAreaForDate(detail.date);
    if (yearSlabArea) {
      const maxFromYearSlab = Math.max(0, yearSlabArea.value - otherNewOwnersTotal);
      // Return the minimum of both constraints
      return Math.min(maxFromOldOwner, maxFromYearSlab);
    }
    
    return maxFromOldOwner;
  }
  return undefined;
})()
})}
        </div>
        
        {/* Individual owner area status */}
{(() => {
  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
  const otherNewOwnersTotal = detail.ownerRelations
    .filter(rel => rel.id !== relation.id && rel.ownerName !== detail.oldOwner)
    .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
  
  const maxFromOldOwner = Math.max(0, oldOwnerArea - otherNewOwnersTotal);
  
  // ADD: Check year slab limit
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const maxFromYearSlab = yearSlabArea ? Math.max(0, yearSlabArea.value - otherNewOwnersTotal) : Infinity;
  const maxAllowed = Math.min(maxFromOldOwner, maxFromYearSlab);
  const exceedsLimit = relation.area?.value > maxAllowed;
  const exceedsYearSlab = yearSlabArea && (relation.area?.value + otherNewOwnersTotal) > yearSlabArea.value;
  
  return (
    <div className={`text-xs mt-1 p-1 rounded ${
      exceedsLimit ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}>
      Max allowed: {maxAllowed.toFixed(2)} {relation.area?.unit || 'sq_m'}
      {yearSlabArea && ` (Year Slab: ${maxFromYearSlab.toFixed(2)}, Old Owner: ${maxFromOldOwner.toFixed(2)})`}
      {exceedsYearSlab && " ⚠️ Exceeds year slab!"}
      {exceedsLimit && !exceedsYearSlab && " ⚠️ Over allocated!"}
    </div>
  );
})()}
      </Card>
    ))}
  </div>
)}
    </div>
  );
};

const formatArea = (area: { value: number; unit: string }) => {
  if (!area) return 'N/A';
  
  const { value, unit } = area;
  
  switch (unit) {
    case 'acre':
      return `${value.toFixed(2)} Acre`;
    case 'guntha':
      return `${value.toFixed(2)} Guntha`;
    case 'sq_m':
      return `${value.toFixed(2)} Sq.m`;
    case 'acre_guntha':
      // If it's acre_guntha format, you might have acres and gunthas properties
      const acres = Math.floor(value / 4046.86);
      const remainingSqm = value % 4046.86;
      const gunthas = Math.floor(remainingSqm / 101.17);
      return `${acres}A ${gunthas}G`;
    default:
      return `${value.toFixed(2)} ${unit}`;
  }
};

  const renderTypeSpecificFields = (detail: NondhDetail) => {
  // Handle types that need owner selection
  if (["Hayati_ma_hakh_dakhal", "Varsai", "Hakkami", "Vechand", "Vehchani"].includes(detail.type)) {
    return renderOwnerSelectionFields(detail);
  }

  switch (detail.type) {
    case "Kabjedaar":
    case "Ekatrikaran":
      return (
        <div className="space-y-4">

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Owner Details</Label>
              <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </div>

            {detail.ownerRelations.map((relation, index) => (
              <Card key={relation.id} className="p-3">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Owner {index + 1}</h4>
                
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOwnerRelation(detail.id, relation.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
   
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Owner Name</Label>
                    <Input
                      value={relation.ownerName}
                      onChange={(e) => updateOwnerRelation(detail.id, relation.id, { 
                        ownerName: e.target.value 
                      })}
                      placeholder="Enter owner name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Area</Label>
                    {areaFields({
                      area: relation.area,
                      onChange: (newArea) => updateOwnerRelation(
                        detail.id, 
                        relation.id, 
                        { area: newArea }
                      )
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )

    case "Durasti":
    case "Promulgation":
      return (
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Owner Details with Survey Numbers</Label>
              <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </div>

            {detail.ownerRelations.map((relation, index) => (
              <Card key={relation.id} className="p-3">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Owner {index + 1}</h4>
               
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOwnerRelation(detail.id, relation.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
            
                </div>

                <div className="space-y-2 mb-3">
                  <Label>Owner Name</Label>
                  <Input
                    value={relation.ownerName}
                    onChange={(e) => updateOwnerRelation(detail.id, relation.id, { 
                      ownerName: e.target.value 
                    })}
                    placeholder="Enter owner name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-2">
                    <Label>Survey Number</Label>
                    <Input
                      value={relation.surveyNumber || ''}
                      onChange={(e) => updateOwnerRelation(detail.id, relation.id, { 
                        surveyNumber: e.target.value 
                      })}
                      placeholder="Enter survey number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Survey Number Type</Label>
                    <Select
                      value={relation.surveyNumberType || 's_no'}
                      onValueChange={(value) => updateOwnerRelation(detail.id, relation.id, { 
                        surveyNumberType: value 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="s_no">Survey No</SelectItem>
                        <SelectItem value="block_no">Block No</SelectItem>
                        <SelectItem value="re_survey_no">Re-survey No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Area</Label>
                    {areaFields({
                      area: relation.area,
                      onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { 
                        area: newArea 
                      })
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      );

    case "Bojo":
      return (
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Owner Details</Label>
              <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </div>

            {detail.ownerRelations.map((relation, index) => (
              <Card key={relation.id} className="p-3">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Owner {index + 1}</h4>
               
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOwnerRelation(detail.id, relation.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
      
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Owner Name</Label>
                    <Input
                      value={relation.ownerName}
                      onChange={(e) => updateOwnerRelation(detail.id, relation.id, { 
                        ownerName: e.target.value 
                      })}
                      placeholder="Enter owner name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Area</Label>
                    {areaFields({
                      area: relation.area,
                      onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { 
                        area: newArea 
                      })
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )

    case "Hukam":
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Restraining Order Passed?</Label>
            <RadioGroup
              value={detail.restrainingOrder || "no"}
              onValueChange={(value) => updateNondhDetail(detail.id, { restrainingOrder: value })}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`yes_${detail.id}`} />
                <Label htmlFor={`yes_${detail.id}`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`no_${detail.id}`} />
                <Label htmlFor={`no_${detail.id}`}>No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Affected Nondh Management */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Affected Nondh Numbers (Optional)</Label>
              <Button size="sm" onClick={() => addAffectedNondh(detail.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Affected Nondh
              </Button>
            </div>

            {(affectedNondhDetails[detail.id] || []).map((affected) => {
              const currentNondh = nondhs.find(n => n.id === detail.nondhId);
              if (!currentNondh) return null;

              const allSortedNondhs = [...nondhs].sort(sortNondhs);
              const currentIndex = allSortedNondhs.findIndex(n => n.id === detail.nondhId);
              const sortedOriginalNondhs = allSortedNondhs.slice(0, currentIndex);

              return (
                <Card key={affected.id} className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Affected Nondh</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeAffectedNondh(detail.id, affected.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nondh Number</Label>
                      {sortedOriginalNondhs.length === 0 ? (
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder="No previous nondhs available" />
                          </SelectTrigger>
                        </Select>
                      ) : (
                        <Select
                          value={affected.nondhNo}
                          onValueChange={(value) => updateAffectedNondh(detail.id, affected.id, { nondhNo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select nondh" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-y-auto">
                            {sortedOriginalNondhs.map(nondh => {
                              const nondhDetail = nondhDetails.find(d => d.nondhId === nondh.id);
                              const type = nondhDetail?.type || 'Nondh';
                              const primaryType = getPrimarySNoType(nondh.affectedSNos);
                              const typeLabel = 
                                primaryType === 'block_no' ? 'Block' :
                                primaryType === 're_survey_no' ? 'Resurvey' : 
                                'Survey';

                              return (
                                <SelectItem key={nondh.id} value={nondh.number.toString()}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">Nondh No: {nondh.number}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                                        {typeLabel} No: {nondh.affectedSNos[0] || ''}
                                      </span>
                                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                        Type: {getNondhTypeDisplay(type)}  
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Hukam Status</Label>
                      <Select
                        value={affected.status}
                        onValueChange={(value) => {
  // Update UI state first
  updateAffectedNondh(detail.id, affected.id, { 
    status: value,
    invalidReason: value === "invalid" ? affected.invalidReason : ""
  });
  
  // Update the actual nondh status in the backend data
  if (affected.nondhNo) {
    // Find the actual nondh detail that corresponds to this affected nondh number
    const affectedNondh = nondhs.find(n => n.number.toString() === affected.nondhNo);
    if (affectedNondh) {
      const affectedDetail = nondhDetails.find(d => d.nondhId === affectedNondh.id);
      if (affectedDetail) {
        handleStatusChange(affectedDetail.id, value);
      }
    }
  }
}}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusTypes.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label>
                      Reason {affected.status === "invalid" ? "*" : "(Optional)"}
                    </Label>
                    <Input
                      value={affected.invalidReason || ''}
                      onChange={(e) => updateAffectedNondh(detail.id, affected.id, { 
                        invalidReason: e.target.value 
                      })}
                      placeholder={affected.status === "invalid" ? "Enter reason for invalidation" : "Enter reason (optional)"}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
          {/* Ganot field for ALT Krushipanch */}
          {detail.hukamType === "ALT Krushipanch" && (
            <div className="space-y-2">
              <Label>Ganot *</Label>
              <Select
                value={detail.ganot || ''}
                onValueChange={(value) => handleGanotChange(detail.id, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Ganot" />
                </SelectTrigger>
                <SelectContent>
                  {ganotOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Ganot-specific owner handling */}
{detail.ganot === "2nd Right" && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Label>Ganot Details</Label>
      <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
        <Plus className="w-4 h-4 mr-2" />
        Add Ganot
      </Button>
    </div>

    {detail.ownerRelations.map((relation, index) => (
      <Card key={relation.id} className="p-3">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium">Ganot {index + 1}</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeOwnerRelation(detail.id, relation.id)}
            className="text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Owner Name - Full width */}
        <div className="space-y-2 mb-3">
          <Label>Ganot Name</Label>
          <Input
            value={relation.ownerName}
            onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
            placeholder="Enter owner name"
          />
        </div>

        {/* Area - Compact like Kabjedaar */}
        <div className="space-y-2">
          <Label>Area</Label>
          {areaFields({
            area: relation.area,
            onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { area: newArea })
          })}
        </div>
      </Card>
    ))}
  </div>
)}

          {/* 1st Right - Direct Owner Selection (like Hakkami) */}
{detail.ganot === "1st Right" && (
  <div className="space-y-4">
    {/* Old Owner Selection */}
    <div className="space-y-2">
      <Label>Old Ganot *</Label>
      <Select
        value={detail.oldOwner || ''}
        onValueChange={(value) => {
          const currentNondh = nondhs.find(n => n.id === detail.nondhId);
          const currentSNos = currentNondh?.affectedSNos || [];
          const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
          const selectedOwner = availableOwners.oldOwners?.find(o => o.name === value);
          
          if (selectedOwner) {
            updateNondhDetail(detail.id, { 
              oldOwner: selectedOwner.name,
              ownerRelations: [] // Start fresh
            });
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select old ganot" />
        </SelectTrigger>
        <SelectContent>
          {(() => {
            const currentNondh = nondhs.find(n => n.id === detail.nondhId);
            const currentSNos = currentNondh?.affectedSNos || [];
            const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
            
            return (availableOwners.oldOwners || []).map((owner) => (
              <SelectItem key={owner.name} value={owner.name}>
                {owner.name} - {owner.area.value} {owner.area.unit}
              </SelectItem>
            ));
          })()}
        </SelectContent>
      </Select>
    </div>

    {/* New Ganot Selection */}
    <div className="space-y-2">
      <Label>Select New Ganot *</Label>
      <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
        {(() => {
          const currentNondh = nondhs.find(n => n.id === detail.nondhId);
          const currentSNos = currentNondh?.affectedSNos || [];
          const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
          
          return (availableOwners.newOwners || []).map((owner) => {
            const isSelected = detail.ownerRelations.some(rel => rel.ownerName === owner.name);
            
            return (
              <div key={owner.id} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`new_ganot_${owner.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
                    const selectedOldOwner = previousOwners.find(o => o.name === detail.oldOwner);
                    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                    
                    let updatedRelations = [...detail.ownerRelations];
                    
                    if (checked) {
                      // Calculate area for new owner
                      let newOwnerArea = 0;
                      if (equalDistribution[detail.id]) {
                        const yearSlabArea = getYearSlabAreaForDate(detail.date);
                        const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
                          ? yearSlabArea.value 
                          : oldOwnerArea;
                        const newOwnersCount = updatedRelations.length + 1;
                        newOwnerArea = effectiveArea / newOwnersCount;
                      }
                      
                      const newRelation = {
                        id: Date.now().toString() + Math.random(),
                        ownerName: owner.name,
                        sNo: detail.sNo,
                        area: { value: newOwnerArea, unit: owner.area.unit },
                        tenure: "Navi",
                        isValid: true
                      };
                      updatedRelations.push(newRelation);
                    } else {
                      updatedRelations = updatedRelations.filter(rel => rel.ownerName !== owner.name);
                    }
                    
                    updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
                    
                    // Re-apply equal distribution if enabled
                    if (equalDistribution[detail.id]) {
                      setTimeout(() => {
                        toggleEqualDistribution(detail.id, true);
                      }, 100);
                    }
                  }}
                />
                <Label htmlFor={`new_ganot_${owner.id}`} className="flex-1">
                  {owner.name} - {owner.area.value} {owner.area.unit}
                </Label>
              </div>
            );
          });
        })()}
      </div>
    </div>

    {/* Area Distribution Control Panel */}
    {detail.oldOwner && detail.ownerRelations.length > 0 && (
      <>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium text-blue-800">Area Distribution Control</h4>
              <p className="text-sm text-blue-600 mt-1">
                Old Ganot: <strong>{detail.oldOwner}</strong> - 
                Total Area: <strong>{(() => {
                  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
                  const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
                  return selectedOldOwner?.area?.value || 0;
                })()} {detail.ownerRelations[0]?.area?.unit || 'sq_m'}</strong>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`equal_dist_${detail.id}`}
                checked={equalDistribution[detail.id] || false}
                onCheckedChange={(checked) => toggleEqualDistribution(detail.id, checked as boolean)}
                disabled={detail.ownerRelations.length < 1}
              />
              <Label htmlFor={`equal_dist_${detail.id}`} className="text-blue-800 font-medium">
                Equal Distribution
                {detail.ownerRelations.length < 1 && " (Need atleast 1 new ganot)"}
              </Label>
            </div>
          </div>
          
          {/* Real-time Area Summary */}
          {(() => {
            const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
            const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
            const oldOwnerArea = selectedOldOwner?.area?.value || 0;
            const newOwners = detail.ownerRelations;
            const newOwnersTotal = newOwners.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
            const remaining = oldOwnerArea - newOwnersTotal;
            const isBalanced = Math.abs(remaining) < 0.01;
            const yearSlabArea = getYearSlabAreaForDate(detail.date);
            const exceedsYearSlab = yearSlabArea && (newOwnersTotal > yearSlabArea.value);

            return (
              <div className={`p-3 rounded text-sm ${
                remaining < 0 || exceedsYearSlab ? 'bg-red-100 text-red-700 border border-red-300' : 
                isBalanced ? 'bg-green-100 text-green-700 border border-green-300' : 
                'bg-yellow-100 text-yellow-700 border border-yellow-300'
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="font-semibold">Old Ganot Area</div>
                    <div>{oldOwnerArea.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-semibold">New Ganots Total</div>
                    <div>{newOwnersTotal.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Remaining</div>
                    <div className={remaining < 0 ? 'font-bold' : ''}>
                      {remaining.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Status</div>
                    <div>
                      {remaining < 0 ? '⚠️ Exceeded!' : 
                       isBalanced ? '✓ Balanced' : 
                       '⚠️ Not distributed'}
                    </div>
                  </div>
                </div>
                {yearSlabArea && (
                  <div className="mt-2 text-center text-xs">
                    Year Slab Limit: {yearSlabArea.value} {yearSlabArea.unit}
                    {exceedsYearSlab && <span className="text-red-700 font-bold ml-2">⚠️ Exceeded!</span>}
                  </div>
                )}
                {equalDistribution[detail.id] && newOwners.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-200 text-center">
                    <strong>Equal Distribution:</strong> {(() => {
                      const yearSlabArea = getYearSlabAreaForDate(detail.date);
                      const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
                        ? yearSlabArea.value 
                        : oldOwnerArea;
                      return (effectiveArea / newOwners.length).toFixed(4);
                    })()} each
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* New Ganot Details with Area Fields */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>New Ganot Details</Label>
            <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Ganot
            </Button>
          </div>

          {detail.ownerRelations.map((relation, index) => (
            <Card key={relation.id} className="p-3">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">New Ganot {index + 1}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeOwnerRelation(detail.id, relation.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="space-y-2">
                  <Label>Ganot Name</Label>
                  <Input
                    value={relation.ownerName}
                    onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
                    placeholder="Enter ganot name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Area</Label>
                {areaFields({
                  area: relation.area,
                  onChange: (newArea) => {
                    // Year slab validation for 1st Right
                    const yearSlabArea = getYearSlabAreaForDate(detail.date);
                    if (yearSlabArea) {
                      const otherNewOwnersTotal = detail.ownerRelations
                        .filter(rel => rel.id !== relation.id && rel.ownerName.trim() !== "")
                        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                      
                      const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
                      
                      if (proposedTotal > yearSlabArea.value) {
                        toast({
                          title: "Area validation error",
                          description: `Total area (${proposedTotal.toFixed(2)}) would exceed year slab limit (${yearSlabArea.value}). Maximum allowed for this ganot: ${Math.max(0, yearSlabArea.value - otherNewOwnersTotal).toFixed(2)}`,
                          variant: "destructive"
                        });
                        return;
                      }
                    }
                    
                    // Old owner area validation
                    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
                    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
                    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                    
                    const otherNewOwnersTotal = detail.ownerRelations
                      .filter(rel => rel.id !== relation.id && rel.ownerName.trim() !== "")
                      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                    
                    const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
                    
                    if (proposedTotal > oldOwnerArea) {
                      toast({
                        title: "Area validation error",
                        description: `Total area would exceed old ganot's area (${oldOwnerArea}). Maximum allowed for this ganot: ${oldOwnerArea - otherNewOwnersTotal}`,
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    updateOwnerRelation(detail.id, relation.id, { area: newArea });
                  },
                  disabled: equalDistribution[detail.id],
                  maxValue: (() => {
                    const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
                    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
                    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                    
                    const otherNewOwnersTotal = detail.ownerRelations
                      .filter(rel => rel.id !== relation.id && rel.ownerName.trim() !== "")
                      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                    
                    const maxFromOldOwner = Math.max(0, oldOwnerArea - otherNewOwnersTotal);
                    
                    const yearSlabArea = getYearSlabAreaForDate(detail.date);
                    if (yearSlabArea) {
                      const maxFromYearSlab = Math.max(0, yearSlabArea.value - otherNewOwnersTotal);
                      return Math.min(maxFromOldOwner, maxFromYearSlab);
                    }
                    
                    return maxFromOldOwner;
                  })()
                })}
              </div>
              
              {/* Individual ganot area status */}
              {(() => {
                const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
                const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
                const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                const otherNewOwnersTotal = detail.ownerRelations
                  .filter(rel => rel.id !== relation.id)
                  .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                
                const maxFromOldOwner = Math.max(0, oldOwnerArea - otherNewOwnersTotal);
                const yearSlabArea = getYearSlabAreaForDate(detail.date);
                const maxFromYearSlab = yearSlabArea ? Math.max(0, yearSlabArea.value - otherNewOwnersTotal) : Infinity;
                const maxAllowed = Math.min(maxFromOldOwner, maxFromYearSlab);
                const exceedsLimit = relation.area?.value > maxAllowed;
                const exceedsYearSlab = yearSlabArea && (relation.area?.value + otherNewOwnersTotal) > yearSlabArea.value;
                
                return (
                  <div className={`text-xs mt-1 p-1 rounded ${
                    exceedsLimit ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    Max allowed: {maxAllowed.toFixed(2)} {relation.area?.unit || 'sq_m'}
                    {yearSlabArea && ` (Year Slab: ${maxFromYearSlab.toFixed(2)}, Old Ganot: ${maxFromOldOwner.toFixed(2)})`}
                    {exceedsYearSlab && " ⚠️ Exceeds year slab!"}
                    {exceedsLimit && !exceedsYearSlab && " ⚠️ Over allocated!"}
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      </>
    )}
  </div>
)}

          {/* Regular owner details for non-ganot Hukam */}
          {(!detail.ganot || (detail.ganot !== "1st Right" && detail.ganot !== "2nd Right")) && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Owner Details</Label>
                <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Owner
                </Button>
              </div>

              {detail.ownerRelations.map((relation, index) => (
                <Card key={relation.id} className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Owner {index + 1}</h4>
             
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeOwnerRelation(detail.id, relation.id)} 
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
        
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Owner Name</Label>
                      <Input
                        value={relation.ownerName}
                        onChange={(e) => updateOwnerRelation(detail.id, relation.id, { 
                          ownerName: e.target.value 
                        })}
                        placeholder="Enter owner name"
                      />
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <Label>Area</Label>
                        {areaFields({
                          area: relation.area,
                          onChange: (newArea) => updateOwnerRelation(
                            detail.id, 
                            relation.id, 
                            { area: newArea }
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )

    default:
      return null;
  }
};

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nondh Details</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Nondh Details</CardTitle>
          
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 7/12 Documents Table */}
        {documents712.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Available 7/12 Documents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>S.No</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents712.map((doc, index) => (
                  <TableRow key={index}>
                    <TableCell>{doc.year}</TableCell>
                    <TableCell>{doc.s_no}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>{formatArea(doc.area)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Nondh Details */}
        {nondhs
  .sort(sortNondhs)
  .map(nondh => {
    // Add safety check - ensure nondhDetails is an array
    const detail = Array.isArray(nondhDetails) 
      ? nondhDetails.find(d => d.nondhId === nondh.id)
      : null;
    if (!detail) return null;

            return (
              <Card key={nondh.id} className="p-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        Nondh No: {nondh.number}
                      </h3>
                      <Badge variant={detail.status === 'invalid' ? 'destructive' : 'default'}>
                        {statusTypes.find(s => s.value === detail.status)?.label || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="mt-2">
  <h4 className="text-sm font-medium text-muted-foreground">
    Affected Survey Numbers:
  </h4>
  <div className="flex flex-wrap gap-2 mt-1">
    {(() => {
      // Get valid S.Nos from basic info and year slabs
      const validSNos = getSNoTypesFromSlabs();
      
      // Filter and sort the affected S.Nos
      return nondh.affectedSNos
        ?.map(sNoItem => {
          try {
            const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
            return {
              number: parsed.number || sNoItem,
              type: parsed.type || 's_no'
            };
          } catch (e) {
            return {
              number: sNoItem,
              type: 's_no'
            };
          }
        })
        // Filter to only show S.Nos that are in basic info or year slabs
        .filter(({ number }) => validSNos.has(number))
        .sort((a, b) => {
          const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
          const aPriority = priorityOrder.indexOf(a.type);
          const bPriority = priorityOrder.indexOf(b.type);
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.number.localeCompare(b.number, undefined, { numeric: true });
        })
        .map(({ number, type }) => (
          <span 
            key={`${number}-${type}`}
            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm"
          >
            {number} ({type === 's_no' ? 'Survey' : type === 'block_no' ? 'Block' : 'Re-survey'})
          </span>
        ));
    })()}
  </div>
</div>
                  </div>
                 <div className="flex items-center gap-2">
  {/* View Document Button - only show if document exists */}
  {(nondh as any).nondhDoc && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open((nondh as any).nondhDoc, '_blank')}
      className="flex items-center gap-1"
    >
      <Eye className="w-4 h-4" />
      View Document
    </Button>
  )}
  
  {/* Existing Collapse Button */}
  <Button
    variant="ghost"
    size="sm"
    onClick={() => toggleCollapse(nondh.id)}
    className="flex items-center gap-1"
  >
    {collapsedNondhs.has(nondh.id) ? (
      <>
        <ChevronDown className="w-4 h-4" />
        <span>Show Details</span>
      </>
    ) : (
      <>
        <ChevronUp className="w-4 h-4" />
        <span>Hide Details</span>
      </>
    )}
  </Button>
</div>
</div>

                {!collapsedNondhs.has(nondh.id) && (
                  <div className="mt-4 space-y-4">
                    <div className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <div className="space-y-2">
  <Label>Date *</Label>
  <Input
    type="date"
    value={detail.date || ''}
    min={getMinDateForNondh(nondh.id)}
    max={getMaxDateForNondh(nondh.id)}
    onChange={(e) => {
      const newDate = e.target.value;
      updateNondhDetail(detail.id, { date: newDate });
    }}
  />
</div>
                          <Label>Nondh Type *</Label>
                          <Select
                            value={detail.type}
                            onValueChange={(value) => updateNondhDetail(detail.id, { type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {nondhTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {getNondhTypeDisplay(type)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {detail.type === "Hukam" && (
<div className="space-y-2">
      <Label>Authority</Label>
      <Select
        value={detail.hukamType || "SSRD"}
        onValueChange={(value) => handleHukamTypeChange(detail.id, value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
  {hukamTypes.map((type) => (
    <SelectItem key={type} value={type}>
      {type}
    </SelectItem>
  ))}
</SelectContent>
      </Select>
    </div>
    )}
    {["Hukam", "Kabjedaar", "Ekatrikaran"].includes(detail.type) && (
                        <div className="space-y-2">
                          <Label>Tenure Type</Label>
                          <Select
                            value={detail.tenure || "Navi"}
                            onValueChange={(value) => updateNondhDetail(detail.id, { tenure: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tenureTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        )}
                      </div>

{/* Hukam-specific fields */}
{detail.type === "Hukam" && (
  <>
        <div className="space-y-2">
      <Label>Hukam Date</Label>
      <Input
        type="date"
        value={detail.hukamDate || ''}
        onChange={(e) => updateNondhDetail(detail.id, { hukamDate: e.target.value })}
      />
    </div>
  </>
)}

                      <div className="space-y-4 mb-4">
                        <div className="space-y-2">
                          <Label>Vigat *</Label>
                          <Textarea
                            value={detail.vigat}
                            onChange={(e) => updateNondhDetail(detail.id, { vigat: e.target.value })}
                            placeholder="Enter vigat details"
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={detail.status}
                            onValueChange={(value) => handleStatusChange(detail.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusTypes.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="space-y-2 mt-2">
  <Label>
    Reason {detail.status === "invalid" ? "*" : "(Optional)"}
  </Label>
  <Textarea
  value={detail.invalidReason || ''}
  onChange={(e) => updateNondhDetail(detail.id, { invalidReason: e.target.value })}
  placeholder={
    detail.status === "invalid" 
      ? "Enter reason for invalidation" 
      : "Enter reason (optional)"
  }
  rows={3}
/>
</div>
                        </div>
                      </div>

                      <div className="space-y-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`show_${detail.id}`}
                            checked={detail.showInOutput}
                            onCheckedChange={(checked) =>
                              updateNondhDetail(detail.id, { showInOutput: checked as boolean })
                            }
                          />
                          <Label htmlFor={`show_${detail.id}`}>Show in query list</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`docs_${detail.id}`}
                            checked={detail.hasDocuments}
                            onCheckedChange={(checked) =>
                              updateNondhDetail(detail.id, { hasDocuments: checked as boolean })
                            }
                          />
                          <Label htmlFor={`docs_${detail.id}`}>Do you have relevant documents?</Label>
                        </div>

                        {detail.hasDocuments && (
  <div className="space-y-2">
    <Label>Upload Documents</Label>
    
    {!detail.docUpload ? (
      // Show file input only when no document is uploaded
      <Input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file, detail.id)
        }}
      />
    ) : (
      // Show document actions when document exists
      <div className="flex items-center gap-2">
        <Button
          variant="outline" 
          size="sm"
          onClick={() => window.open(detail.docUpload, '_blank')}
        >
          <Eye className="w-4 h-4 mr-1" />
          View Document
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Create a hidden file input for replacement
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.pdf,.jpg,.jpeg,.png'
            input.onchange = (e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file, detail.id)
            }
            input.click()
          }}
        >
          Replace
        </Button>
        
        <Button
          variant="link"
          size="sm"
          className="text-red-600 h-4 p-0"
          onClick={() => updateNondhDetail(detail.id, { docUpload: '', hasDocuments: false })}
        >
          Remove
        </Button>
      </div>
    )}
    
    {detail.docUpload && (
      <p className="text-sm text-green-600">
        <Eye className="w-4 h-4 inline mr-1" />
        Document has been uploaded
      </p>
    )}
  </div>
)}
                      </div>

                      {renderTypeSpecificFields(detail)}
                    </div>
                    
                  </div>
                )}
                
              </Card>
            );
          })}
          {hasChanges && (
  <div className="flex justify-center mt-4">
    <Button onClick={saveChanges} disabled={saving}>
      {saving ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        <>Save & Continue</>
      )}
    </Button>
  </div>
)}
      </CardContent>
    </Card>
  )
}
