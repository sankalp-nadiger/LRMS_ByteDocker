"use client"
import React from 'react'
import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, Upload, Eye, Loader2, ChevronDown, ChevronUp, Badge} from "lucide-react"
import { useLandRecord, type NondhDetail } from "@/contexts/land-record-context"
import { createActivityLog, supabase, uploadFile } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useStepFormData } from "@/hooks/use-step-form-data"
import { useUser } from '@clerk/nextjs'

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

const statusTypes = [
  { value: "valid", label: "Pramanik (પ્રમાણિત)" },
  { value: "invalid", label: "Radd (રદ)" },
  { value: "nullified", label: "Na manjoor (નામંજૂર)" }
]

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

const GUNTHAS_PER_ACRE = 40;
const SQM_PER_GUNTHA = 101.1714; // Approx 1 guntha = 101.1714 sq meters
const SQM_PER_ACRE = SQM_PER_GUNTHA * GUNTHAS_PER_ACRE; // Approx 1 acre = 4046.856 sq meters


type AreaUnit = "acre" | "guntha" | "sq_m";

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
}

const areaFields = ({ area, onChange, disabled = false }: AreaFieldsProps) => {
  // Define constants
  const SQM_PER_GUNTHA = 101.17;
  const SQM_PER_ACRE = 4046.86;
  const GUNTHAS_PER_ACRE = 40;

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

  // Calculate display values based on current state - exactly like your working example
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
        sq_m: calculatedSqm ? parseFloat(calculatedSqm.toFixed(2)) : calculatedSqm, // Round to 2 decimal places
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
      const totalAcres = convertFromSquareMeters(num, "acre");
      const acres = Math.floor(totalAcres);
      const remainingGuntha = Math.round((totalAcres - acres) * 40);
      
      if (workingArea.unit === "sq_m") {
        // Square meter is primary
        onChange({
          ...workingArea,
          value: num,
          acres,
          gunthas: remainingGuntha
        });
      } else {
        // Square meter is secondary - update acre/guntha values
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          acres,
          gunthas: remainingGuntha,
          sq_m: parseFloat(num.toFixed(2)) // Round to 2 decimal places
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
      if (workingArea.unit === "sq_m") {
        const newSqm = convertToSquareMeters(num, "acre") + 
                      (displayValues.gunthas ? convertToSquareMeters(displayValues.gunthas, "guntha") : 0);
        onChange({
          ...workingArea,
          value: newSqm,
          acres: num,
          gunthas: displayValues.gunthas
        });
      } else {
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          acres: num,
          sq_m: parseFloat((convertToSquareMeters(num, "acre") + 
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
        // Handle guntha >= 40 like in your working example
        return;
      }
      
      if (workingArea.unit === "sq_m") {
        const newSqm = (displayValues.acres ? convertToSquareMeters(displayValues.acres, "acre") : 0) + 
                      convertToSquareMeters(num, "guntha");
        onChange({
          ...workingArea,
          value: newSqm,
          acres: displayValues.acres,
          gunthas: num
        });
      } else {
        onChange({
          ...workingArea,
          unit: "acre_guntha",
          gunthas: num,
          sq_m: parseFloat(((workingArea.acres ? convertToSquareMeters(workingArea.acres, "acre") : 0) +
               convertToSquareMeters(num, "guntha")).toFixed(2))
        });
      }
    }
  };

  const formatValue = (value: number | undefined): string => {
    return value === undefined ? "" : value.toString();
  };

  return (
    <div className="space-y-4">
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
                // Convert to sq_m mode - preserve the sq_m value
                const sqmValue = displayValues.sq_m || 0;
                onChange({ 
                  ...workingArea, 
                  unit: "sq_m",
                  value: sqmValue,
                  acres: displayValues.acres,
                  gunthas: displayValues.gunthas
                });
              } else {
                // Convert to acre_guntha mode - preserve acre/guntha values
                onChange({ 
                  ...workingArea, 
                  unit: "acre_guntha",
                  acres: displayValues.acres || 0,
                  gunthas: displayValues.gunthas || 0,
                  sq_m: displayValues.sq_m
                });
              }
            }}
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

        {/* Primary Field */}
        {workingArea.unit === "sq_m" ? (
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
          </>
        )}

        {/* Secondary Fields */}
        {workingArea.unit === "sq_m" ? (
          <>
            <div className="space-y-2 w-full">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter or view acres"
                className="w-full bg-blue-50 border-blue-200"
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
                className="w-full bg-blue-50 border-blue-200"
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 w-full">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter or view sq. meters"
              className="w-full bg-blue-50 border-blue-200"
            />
          </div>
        )}
      </div>

      {/* On desktop: Original single-row layout with better spacing */}
      <div className="hidden md:flex items-end gap-6">
        {/* Unit Selector */}
        <div className="space-y-2 w-[140px] flex-shrink-0">
          <Label>Unit</Label>
          <Select
            value={workingArea.unit}
            onValueChange={(unit) => {
              const newUnit = unit as AreaUnit;
              if (newUnit === "sq_m") {
                // Convert to sq_m mode - preserve the sq_m value
                const sqmValue = displayValues.sq_m || 0;
                onChange({ 
                  ...workingArea, 
                  unit: "sq_m",
                  value: sqmValue,
                  acres: displayValues.acres,
                  gunthas: displayValues.gunthas
                });
              } else {
                // Convert to acre_guntha mode - preserve acre/guntha values
                onChange({ 
                  ...workingArea, 
                  unit: "acre_guntha",
                  acres: displayValues.acres || 0,
                  gunthas: displayValues.gunthas || 0,
                  sq_m: displayValues.sq_m
                });
              }
            }}
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

        {/* Primary Fields */}
        {workingArea.unit === "sq_m" ? (
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
            />
          </div>
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
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        )}

        {/* Secondary Fields */}
        {workingArea.unit === "sq_m" ? (
          <>
            <div className="space-y-2 min-w-[120px] flex-1">
              <Label>Acres</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatValue(displayValues.acres)}
                onChange={(e) => handleAcreChange(e.target.value)}
                placeholder="Enter or view acres"
                className="w-full bg-blue-50 border-blue-200"
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
                className="w-full bg-blue-50 border-blue-200"
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 min-w-[150px] flex-1">
            <Label>Square Meters</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formatValue(displayValues.sq_m)}
              onChange={(e) => handleSqmChange(e.target.value)}
              placeholder="Enter or view sq. meters"
              className="w-full bg-blue-50 border-blue-200"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default function NondhDetails() {
  const { yearSlabs, nondhs, setNondhs, nondhDetails, setNondhDetails, setCurrentStep, landBasicInfo } = useLandRecord()
  const { toast } = useToast()
  const { getStepData, updateStepData, markAsSaved } = useStepFormData(5) // Step 5 for NondhDetails
  console.log('Initial nondhs data:', nondhs);
  console.log('Land basic info:', landBasicInfo);
  const [loading, setLoading] = useState(false)
  const [nondhDetailData, setNondhDetailData] = useState<NondhDetail[]>(getStepData().nondhDetails || [])
  const [collapsedNondhs, setCollapsedNondhs] = useState<Set<string>>(new Set())
  const [equalDistribution, setEqualDistribution] = useState<Record<string, boolean>>({})
  const [ownerTransfers, setOwnerTransfers] = useState<Record<string, Array<any>>>({})
const [transferEqualDistribution, setTransferEqualDistribution] = useState<Record<string, Record<string, boolean>>>({})
const [affectedNondhDetails, setAffectedNondhDetails] = useState<Record<string, Array<{
  id: string;
  nondhNo: string;
  status: "valid" | "invalid" | "nullified";
  invalidReason?: string;
}>>>({});
const { user } = useUser();
const cleanupTimeoutRef = useRef(null);

useEffect(() => {
  if (cleanupTimeoutRef.current) {
    clearTimeout(cleanupTimeoutRef.current);
  }

  cleanupTimeoutRef.current = setTimeout(() => {
    const cleanedData = nondhDetailData.map(detail => {
      if (["Hakkami"].includes(detail.type)) {
        const nonEmptyRelations = detail.ownerRelations.filter(rel => rel.ownerName.trim() !== "");
        if (nonEmptyRelations.length !== detail.ownerRelations.length) {
          return { ...detail, ownerRelations: nonEmptyRelations };
        }
      }
      return detail;
    });
    
    if (JSON.stringify(cleanedData) !== JSON.stringify(nondhDetailData)) {
      setNondhDetailData(cleanedData);
    }
  }, 100);

  return () => {
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
  };
}, [nondhDetailData.map(d => `${d.id}-${d.type}-${d.ownerRelations.length}`).join(',')]); // More specific dependency

// Initialize additional states from step data
useEffect(() => {
  const stepData = getStepData();
  
  // Always restore additional states if they exist in step data
  if (stepData.ownerTransfers && Object.keys(stepData.ownerTransfers).length > 0) {
    setOwnerTransfers(stepData.ownerTransfers);
  }
  
  if (stepData.transferEqualDistribution && Object.keys(stepData.transferEqualDistribution).length > 0) {
    setTransferEqualDistribution(stepData.transferEqualDistribution);
  }
  
  if (stepData.affectedNondhDetails && Object.keys(stepData.affectedNondhDetails).length > 0) {
    setAffectedNondhDetails(stepData.affectedNondhDetails);
  }
}, []);

useEffect(() => {
  Object.entries(affectedNondhDetails).forEach(([detailId, affectedList]) => {
    affectedList.forEach(affected => {
      if (affected.status === "invalid" && affected.invalidReason) {
        propagateReasonToAffectedNondh(affected.nondhNo, affected.invalidReason);
      }
    });
  });
}, [affectedNondhDetails]);

// Add function to manage affected nondh details
const addAffectedNondh = (detailId: string) => {
  setAffectedNondhDetails(prev => ({
    ...prev,
    [detailId]: [
      ...(prev[detailId] || []),
      {
        id: Date.now().toString(),
        nondhNo: '',
        status: 'valid',
        invalidReason: ''
      }
    ]
  }));
};

const removeAffectedNondh = (detailId: string, affectedId: string) => {
  setAffectedNondhDetails(prev => ({
    ...prev,
    [detailId]: (prev[detailId] || []).filter(a => a.id !== affectedId)
  }));
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

const updateAffectedNondh = (detailId: string, affectedId: string, updates: any) => {
  setAffectedNondhDetails(prev => ({
    ...prev,
    [detailId]: (prev[detailId] || []).map(affected =>
      affected.id === affectedId ? { ...affected, ...updates } : affected
    )
  }));
};

const updateAffectedNondhValidityChain = (affectedNondhNo: string, newStatus: "valid" | "invalid" | "nullified") => {
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Find the affected nondh by number (direct string comparison)
  const affectedNondh = allSortedNondhs.find(n => 
    n.number.toString() === affectedNondhNo // Use direct string comparison
  );
  
  if (!affectedNondh) {
    console.log('ERROR: Target nondh not found for number:', affectedNondhNo);
    console.log('Available nondh numbers:', allSortedNondhs.map(n => n.number.toString()));
    return;
  }

  // Find the actual nondh detail for the affected nondh
  const affectedDetail = nondhDetailData.find(d => d.nondhId === affectedNondh.id);
  
  if (!affectedDetail) {
    console.log('ERROR: Target detail not found for nondh ID:', affectedNondh.id);
    return;
  }

  console.log('Calling handleStatusChange with:', affectedDetail.id, newStatus);
  
  // Use the same handleStatusChange function that main nondhs use
  handleStatusChange(affectedDetail.id, newStatus);
};

const propagateReasonToAffectedNondh = (affectedNondhNo: string, reason: string) => {
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  const affectedNondh = allSortedNondhs.find(n => n.number.toString() === affectedNondhNo);
  
  if (!affectedNondh) return;

  setNondhDetailData(prev => prev.map(detail => 
    detail.nondhId === affectedNondh.id && detail.status === "invalid"
      ? { ...detail, invalidReason: reason }
      : detail
  ));
};


const getAvailableOwnersForGanot = (ganotType: string, currentNondhId: string, currentSNos: string[]) => {
  console.log('=== getAvailableOwnersForGanot START ===');
  console.log('Ganot Type:', ganotType);
  console.log('Current Nondh ID:', currentNondhId);
  
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
        const detail = nondhDetailData.find(d => d.nondhId === nondh.id);
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
        
        const firstSNo = (() => {
          try {
            return JSON.parse(nondh.affectedSNos[0]).number;
          } catch (e) {
            return nondh.affectedSNos[0];
          }
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
              const priorDetail = nondhDetailData.find(d => d.nondhId === priorNondhs[i].id);
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
        const detail = nondhDetailData.find(d => d.nondhId === nondh.id);
        
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
              const priorDetail = nondhDetailData.find(d => d.nondhId === priorNondhs[i].id);
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
          
          const firstSNo = (() => {
          try {
            return JSON.parse(nondh.affectedSNos[0]).number;
          } catch (e) {
            return nondh.affectedSNos[0];
          }
        })();

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
        
        const firstSNo = (() => {
          try {
            return JSON.parse(nondh.affectedSNos[0]).number;
          } catch (e) {
            return nondh.affectedSNos[0];
          }
        })();
        
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
        const detail = nondhDetailData.find(d => d.nondhId === nondh.id);
        
        // Only include if it's Hukam 2nd Right AND status is valid (Pramanik)
        if (!detail || 
            !(detail.type === "Hukam" && detail.ganot === "2nd Right") ||
            detail.status !== 'valid') {
          console.log('  Skipped (not Hukam 2nd Right or not Pramanik status)');
          return [];
        }
        
        console.log('  Is Hukam 2nd Right with Pramanik status - including all owners');
        
        const firstSNo = (() => {
          try {
            return JSON.parse(nondh.affectedSNos[0]).number;
          } catch (e) {
            return nondh.affectedSNos[0];
          }
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

const isValidNondhDateOrder = (nondhId: string, newDate: string): boolean => {
  if (!newDate) return true;
  
  const minDate = getMinDateForNondh(nondhId);
  const maxDate = getMaxDateForNondh(nondhId);
  
  if (minDate && newDate <= minDate) return false;
  if (maxDate && newDate >= maxDate) return false;
  
  return true;
};

//Function to add a new transfer
const addOwnerTransfer = (detailId: string) => {
  setOwnerTransfers(prev => ({
    ...prev,
    [detailId]: [
      ...(prev[detailId] || []),
      {
        id: Date.now().toString(),
        oldOwner: '',
        newOwners: [],
        equalDistribution: false,
        oldOwnerArea: { value: 0, unit: 'sq_m' },
        newOwnerAreas: []
      }
    ]
  }));
};

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
    
    // Owner name validation (at least one non-empty owner name) - Skip for 1st Right Hukam
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

const safeNondhNumber = (nondh: any): number => {
  const numberValue = typeof nondh.number === 'string' 
    ? parseInt(nondh.number, 10) 
    : nondh.number;
  return isNaN(numberValue) ? 0 : numberValue;
};

// Update the handleTypeChange function to include Vechand
const handleTypeChange = (detailId: string, newType: string) => {
  const detail = nondhDetailData.find(d => d.id === detailId);
  if (!detail) return;

  // Always clear owner relations when type changes
  const clearedRelations = [{
    id: Date.now().toString() + Math.random(),
    ownerName: "",
    area: { value: 0, unit: "sq_m" },
    isValid: true
  }];

  // Update the type, clear owner relations and old owner
  updateNondhDetail(detailId, { 
    type: newType, 
    ownerRelations: clearedRelations,
    oldOwner: undefined // Clear old owner field
  });
  
  // Initialize default affected nondh for Hukam type
  if (newType === "Hukam" && (!affectedNondhDetails[detailId] || affectedNondhDetails[detailId].length === 0)) {
    addAffectedNondh(detailId);
    
    // If ganot is already set to 2nd Right, auto-populate owners
    if (detail.ganot === "2nd Right") {
      handleGanotChange(detailId, "2nd Right");
    }
  }
};
// Add a ref to debounce saves
const saveTimeoutRef = useRef(null);

  // useEffect that saves to step data
useEffect(() => {
  if (nondhDetailData.length === 0) return;
  
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(() => {
    const hasContent = nondhDetailData.some(detail => 
      detail.type.trim() !== "" || 
      detail.ownerRelations.some(rel => rel.ownerName.trim() !== "") ||
      detail.status !== "valid" ||
      detail.reason.trim() !== "" ||
      detail.vigat.trim() !== "" ||
      detail.date.trim() !== "" ||
      detail.ganot || 
      detail.sdDate ||
      detail.amount
    );
    
    if (hasContent) {
      updateStepData({
        nondhDetails: nondhDetailData,
        ownerTransfers,
        transferEqualDistribution,
        affectedNondhDetails
      });
    }
  }, 500); // Debounce saves

  return () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  };
}, [nondhDetailData, ownerTransfers, transferEqualDistribution, affectedNondhDetails]);


// Load nondhs from database first
useEffect(() => {
  const loadNondhs = async () => {
    if (!landBasicInfo?.id) return;

    try {
      const { data: nondhData, error } = await supabase
        .from('nondhs')
        .select('*')
        .eq('land_record_id', landBasicInfo.id)
        .order('number');

      if (error) throw error;

      if (nondhData?.length) {
        const formattedNondhs = nondhData.map(nondh => ({
          id: nondh.id,
          number: nondh.number.toString(),
          sNoType: nondh.s_no_type,
          affectedSNos: Array.isArray(nondh.affected_s_nos) 
            ? nondh.affected_s_nos
            : nondh.affected_s_nos 
              ? JSON.parse(nondh.affected_s_nos) 
              : [],
          nondhDoc: nondh.nondh_doc_url || '',
        }));
        
        setNondhs(formattedNondhs);
        // Clear existing nondhDetailData when nondhs change
        setNondhDetailData([]);
      }
    } catch (error) {
      console.error('Error loading nondhs:', error);
      toast({ title: "Error loading nondhs", variant: "destructive" });
    }
  };

  loadNondhs();
}, [landBasicInfo?.id]);

useEffect(() => {
  if (nondhs.length === 0) return;

  const stepData = getStepData();
  
  // Check if we need to reinitialize (new nondhs or mismatched data)
  const needsReinit = nondhDetailData.length === 0 || 
                     nondhDetailData.length !== nondhs.length ||
                     !nondhs.every(nondh => nondhDetailData.some(detail => detail.nondhId === nondh.id));
  
  if (needsReinit) {
    // Check if we have saved data that matches current nondhs
    const hasSavedDataForCurrentNondhs = stepData.nondhDetails && 
                                         stepData.nondhDetails.length === nondhs.length &&
                                         nondhs.every(nondh => stepData.nondhDetails.some(detail => detail.nondhId === nondh.id));
    
    if (hasSavedDataForCurrentNondhs) {
      // Restore saved data
      setNondhDetailData(stepData.nondhDetails);
      
      // Restore additional states
      if (stepData.ownerTransfers) setOwnerTransfers(stepData.ownerTransfers);
      if (stepData.transferEqualDistribution) setTransferEqualDistribution(stepData.transferEqualDistribution);
      if (stepData.affectedNondhDetails) setAffectedNondhDetails(stepData.affectedNondhDetails);
    } else {
      // Initialize new data for all nondhs
      const initialData = nondhs.map(nondh => {
        const firstSNo = Array.isArray(nondh.affectedSNos) && nondh.affectedSNos.length > 0
          ? typeof nondh.affectedSNos[0] === 'string'
            ? JSON.parse(nondh.affectedSNos[0]).number
            : nondh.affectedSNos[0].number
          : '';
          
        const initialOwnerRelations = [{
          id: Date.now().toString() + Math.random(),
          ownerName: "",
          area: { value: 0, unit: "sq_m" },
          isValid: true
        }];
          
        return {
          id: Date.now().toString() + Math.random(),
          nondhId: nondh.id,
          sNo: firstSNo,
          type: "Kabjedaar",
          reason: "",
          date: "",
          vigat: "",
          tenure: "Navi",
          status: "valid",
          showInOutput: true,
          hasDocuments: false,
          ganot: undefined,
          sdDate: undefined,
          amount: undefined,
          hukamDate: undefined,
          hukamType: "SSRD",
          restrainingOrder: "no",
          ownerRelations: initialOwnerRelations,
        };
      });
      
      setNondhDetailData(initialData);
      
      // Clear additional states when initializing fresh
      setOwnerTransfers({});
      setTransferEqualDistribution({});
      setAffectedNondhDetails({});
    }
  }
}, [nondhs, nondhDetailData.length]); // Watch for changes in nondhs or length mismatch

  const updateNondhDetail = useCallback((id: string, updates: Partial<NondhDetail>) => {
  setNondhDetailData((prev) => {
    return prev.map((detail) => {
      if (detail.id === id) {
        return { 
          ...detail, 
          ...updates,
          ...(updates.ownerRelations && { ownerRelations: updates.ownerRelations })
        };
      }
      return detail;
    });
  });
}, []);

  const toggleCollapse = (detailId: string) => {
    setCollapsedNondhs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(detailId)) {
        newSet.delete(detailId)
      } else {
        newSet.add(detailId)
      }
      return newSet
    })
  }

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

const addOwnerRelation = (detailId: string) => {
  console.log('addOwnerRelation called for:', detailId);
  const detail = nondhDetailData.find((d) => d.id === detailId)
  console.log('Found detail:', detail);
  
  if (detail) {
    const yearSlabArea = detail.date ? getYearSlabAreaForDate(detail.date) : null;
    const defaultArea = yearSlabArea || { value: 0, unit: "sq_m" };
    
    const currentTotalArea = detail.ownerRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
const remainingYearSlabArea = yearSlabArea ? yearSlabArea.value - currentTotalArea : 0;

const newRelation = {
  id: Date.now().toString() + Math.random(),
  ownerName: "",
  sNo: detail.sNo,
  area: { value: Math.max(0, remainingYearSlabArea), unit: defaultArea.unit }, // Use remaining area
  tenure: "Navi",
  isValid: true
};

    const updatedRelations = [...detail.ownerRelations, newRelation]
    console.log('Updated relations:', updatedRelations);
    
    updateNondhDetail(detail.id, { ownerRelations: updatedRelations })
    
    // Auto-distribute if equal distribution is enabled
    if (equalDistribution[detailId] && updatedRelations.length > 1) {
      // For Vechand, get old owner area from previous owners data
      let oldOwnerArea = 0;
      if (detail.type === "Vechand" && detail.oldOwner) {
        const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
        const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
        oldOwnerArea = selectedOldOwner?.area?.value || 0;
      } else {
        // For other types, use the first owner's area
        oldOwnerArea = updatedRelations[0]?.area?.value || 0;
      }
      
      const newOwnersCount = updatedRelations.filter(rel => 
        rel.ownerName !== detail.oldOwner
      ).length;
      
      if (newOwnersCount > 0) {
        const equalArea = oldOwnerArea / newOwnersCount;
        
        const redistributed = updatedRelations.map((relation) => {
          // Don't modify old owner area for Vechand type
          if (detail.type === "Vechand" && relation.ownerName === detail.oldOwner) {
            return relation;
          }
          return { ...relation, area: { ...relation.area, value: equalArea } };
        });
        
        updateNondhDetail(detail.id, { ownerRelations: redistributed });
      }
    }
  } else {
    console.log('Detail not found for ID:', detailId);
  }
}

 const removeOwnerRelation = (detailId: string, relationId: string) => {
  const detail = nondhDetailData.find((d) => d.id === detailId) // Changed from nondhId to id
  if (detail) {
    const updatedRelations = detail.ownerRelations.filter((r) => r.id !== relationId)
    updateNondhDetail(detail.id, { ownerRelations: updatedRelations })
    
    // Auto-redistribute if equal distribution is enabled
    if (equalDistribution[detail.id] && updatedRelations.length > 1) {
      const oldOwnerArea = updatedRelations[0]?.area?.value || 0
      const newOwnersCount = updatedRelations.length - 1
      const equalArea = oldOwnerArea / newOwnersCount
      
      const redistributed = updatedRelations.map((relation, index) => {
        if (index === 0) return relation
        return { ...relation, area: { ...relation.area, value: equalArea } }
      })
      
      updateNondhDetail(detail.id, { ownerRelations: redistributed })
    }
  }
}

const updateOwnerRelation = (detailId: string, relationId: string, updates: any) => {
  const detail = nondhDetailData.find((d) => d.id === detailId);
  if (detail) {

    const updatedRelations = detail.ownerRelations.map((relation) =>
      relation.id === relationId ? { ...relation, ...updates } : relation,
    );
    
    if (updates.area) {
      // Year slab area validation (applies to ALL types)
      const yearSlabArea = getYearSlabAreaForDate(detail.date);
      if (yearSlabArea) {
        const totalArea = updatedRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
        if (totalArea > yearSlabArea.value) {
          toast({
            title: "Area validation error",
            description: `Total area (${totalArea.toFixed(2)}) cannot exceed year slab area (${yearSlabArea.value})`,
            variant: "destructive"
          });
          return;
        }
      }

      // Area validation for transfer types
      if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type)) {
        const oldOwnerArea = getPreviousOwners(detail.sNo, detail.nondhId)
          .find(owner => owner.name === detail.oldOwner)?.area?.value || 0;
        
        const newOwnersTotal = updatedRelations
          .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
          .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
        
        if (newOwnersTotal > oldOwnerArea) {
          toast({
            title: "Area validation error",
            description: `Total new owners area (${newOwnersTotal.toFixed(2)}) cannot exceed old owner's area (${oldOwnerArea})`,
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
  }
}

const getPrimarySNoType = (affectedSNos: string[]): string => {
  if (!affectedSNos || affectedSNos.length === 0) return 's_no';
  
  // Priority order: s_no > block_no > re_survey_no
  const priorityOrder = ['s_no', 'block_no', 're_survey_no'];
  
  // Parse the stringified JSON objects to get the actual types
  const types = affectedSNos.map(sNoStr => {
    try {
      const parsed = JSON.parse(sNoStr);
      return parsed.type || 's_no';
    } catch (e) {
      return 's_no'; // fallback
    }
  });
  
  // Find the highest priority type present
  for (const type of priorityOrder) {
    if (types.includes(type)) {
      return type;
    }
  }
  
  return 's_no'; // default
};

const sortNondhs = (a: Nondh, b: Nondh): number => {
  // Get primary types from affected_s_nos
  const aType = getPrimarySNoType(a.affectedSNos);
  const bType = getPrimarySNoType(b.affectedSNos);

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
  // Update the state first
  setNondhDetailData(prev => {
    const updatedDetails = prev.map(detail => 
      detail.id === detailId 
        ? { 
            ...detail, 
            status: newStatus,
            invalidReason: newStatus === 'invalid' ? detail.invalidReason || '' : ''
          } 
        : detail
    );
    
    // Then process the validity chain with the updated state
    processValidityChain(updatedDetails);
    
    return updatedDetails;
  });
};

// Separate function to process the validity chain
const processValidityChain = (details: NondhDetail[]) => {
  // Get all nondhs sorted by S.No type and number
  const sortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Create a map of nondh ID to its detail
  const nondhDetailMap = new Map<string, NondhDetail>();
  details.forEach(detail => {
    nondhDetailMap.set(detail.nondhId, detail);
  });

  // First pass: count how many invalid nondhs affect each nondh
  const affectingCounts = new Map<string, number>();
  sortedNondhs.forEach((nondh, index) => {
    let count = 0;
    
    // Count invalid nondhs that come after this one in the sorted list
    for (let i = index + 1; i < sortedNondhs.length; i++) {
      const affectingNondh = sortedNondhs[i];
      const affectingDetail = nondhDetailMap.get(affectingNondh.id);
      if (affectingDetail?.status === 'invalid') {
        count++;
      }
    }
    
    affectingCounts.set(nondh.id, count);
  });

  // Second pass: update owner validity based on the count
  const updatedDetails = details.map(detail => {
    const affectingCount = affectingCounts.get(detail.nondhId) || 0;
    const shouldBeValid = affectingCount % 2 === 0;

    // Only update if current validity doesn't match
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

  setNondhDetailData(updatedDetails);
};

// Update the updateValidityChain function to use the sorted nondhs
const updateValidityChain = () => {
  // Get all nondhs sorted by S.No type and number (same as display sorting)
  const sortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Create a map of nondh ID to its detail
  const nondhDetailMap = new Map<string, NondhDetail>();
  nondhDetailData.forEach(detail => {
    nondhDetailMap.set(detail.nondhId, detail);
  });

  // First pass: count how many invalid nondhs affect each nondh
  const affectingCounts = new Map<string, number>();
  sortedNondhs.forEach((nondh, index) => {
    let count = 0;
    
    // Count invalid nondhs that come after this one in the sorted list
    for (let i = index + 1; i < sortedNondhs.length; i++) {
      const affectingNondh = sortedNondhs[i];
      const affectingDetail = nondhDetailMap.get(affectingNondh.id);
      if (affectingDetail?.status === 'invalid') {
        count++;
      }
    }
    
    affectingCounts.set(nondh.id, count);
  });

  // Second pass: update owner validity based on the count
  sortedNondhs.forEach(nondh => {
    const detail = nondhDetailMap.get(nondh.id);
    if (!detail) return;

    const affectingCount = affectingCounts.get(nondh.id) || 0;
    
    // If affected by odd number of invalid nondhs, owners should be invalid
    // If affected by even number (or zero), owners should be valid
    const shouldBeValid = affectingCount % 2 === 0;

    // Only update if current validity doesn't match
    const currentValidity = detail.ownerRelations.every(r => r.isValid);
    if (currentValidity !== shouldBeValid) {
      const updatedRelations = detail.ownerRelations.map(relation => ({
        ...relation,
        isValid: shouldBeValid
      }));
      updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
    }
  });
};

const updateHukamValidityChain = (detailId: string) => {
  const detail = nondhDetailData.find(d => d.id === detailId);
  if (!detail || !detail.affectedNondhNo) return;

  const currentNondh = nondhs.find(n => n.id === detail.nondhId);
  if (!currentNondh) return;

  // Get all nondhs in proper sorted order
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Find affected nondh by number
  const affectedNondh = allSortedNondhs.find(n => 
    safeNondhNumber(n).toString() === detail.affectedNondhNo
  );
  
  if (!affectedNondh) return;

  const currentIndex = allSortedNondhs.findIndex(n => n.id === detail.nondhId);
  const affectedIndex = allSortedNondhs.findIndex(n => n.id === affectedNondh.id);

  // Get all nondhs in the affected range (from affected to current-1)
  const affectedNondhIds = allSortedNondhs
    .slice(affectedIndex, currentIndex)
    .map(n => n.id);

  // Update all affected nondh details based on hukam status
  const shouldBeValid = detail.hukamStatus === "valid";
  
  affectedNondhIds.forEach(nondhId => {
    const affectedDetail = nondhDetailData.find(d => d.nondhId === nondhId);
    if (affectedDetail) {
      const updatedRelations = affectedDetail.ownerRelations.map(relation => ({
        ...relation,
        isValid: shouldBeValid
      }));
      updateNondhDetail(affectedDetail.id, { 
        ownerRelations: updatedRelations
      });
    }
  });
};
  // Get previous owners for dropdown (Varsai, Hakkami, Vechand, Vehchani, Hayati_ma_hakh_dakhal)
const getPreviousOwners = (sNo: string, currentNondhId: string) => {
  // Get all nondhs sorted by priority
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  const currentIndex = allSortedNondhs.findIndex(n => n.id === currentNondhId);
  
  // Only look at nondhs that come BEFORE the current one
  const previousNondhs = allSortedNondhs.slice(0, currentIndex);

  // Track owners by name to keep only the most recent version
  const ownerMap = new Map();

  previousNondhs.forEach(nondh => {
    const detail = nondhDetailData.find(d => d.nondhId === nondh.id);
    
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
          const priorDetail = nondhDetailData.find(d => d.nondhId === priorNondhs[i].id);
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

  const updateNondhDetailData = (newData: NondhDetail[]) => {
  setNondhDetailData(newData)
  updateStepData({ nondhDetails: newData })
}
  const handleFileUpload = async (file: File, detailId: string) => {
    try {
      const path = `nondh-detail-documents/${Date.now()}_${file.name}`
      const url = await uploadFile(file, "land-documents", path)
      const updatedDetails = nondhDetailData.map(detail => 
      detail.id === detailId ? { ...detail, docUpload: url } : detail
    )
    updateNondhDetailData(updatedDetails)
    toast({ title: "File uploaded successfully" })
    } catch (error) {
      toast({ title: "Error uploading file", variant: "destructive" })
    }
  }

  const updateBackendNondhStatus = (nondhId: string, newStatus: "valid" | "invalid" | "nullified") => {
  // Update the state without triggering UI changes
  setNondhDetailData(prev => {
    const updatedDetails = prev.map(detail => 
      detail.nondhId === nondhId 
        ? { 
            ...detail, 
            status: newStatus,
            invalidReason: newStatus === 'invalid' ? detail.invalidReason || '' : ''
          } 
        : detail
    );
    
    // Process the validity chain with the updated state (backend only)
    processValidityChain(updatedDetails);
    
    return updatedDetails;
  });
};

const toggleAffectedNondhStatus = (affectedNondhNo: string, uiStatus: string, hukamDetailId: string) => {
  const allSortedNondhs = [...nondhs].sort(sortNondhs);
  
  // Find the affected nondh by number
  const affectedNondh = allSortedNondhs.find(n => 
    n.number.toString() === affectedNondhNo
  );
  
  if (!affectedNondh) {
    console.log('ERROR: Target nondh not found for number:', affectedNondhNo);
    return;
  }

  // Find the actual nondh detail to get the REAL backend status
  const affectedDetail = nondhDetailData.find(d => d.nondhId === affectedNondh.id);
  
  if (!affectedDetail) {
    console.log('ERROR: Target detail not found for nondh ID:', affectedNondh.id);
    return;
  }

  // Get the ACTUAL backend status, not the UI status
  const actualBackendStatus = affectedDetail.status;
  
  // Determine the new status: if it was invalid in backend, make it valid, and vice versa
  const newStatus = actualBackendStatus === "invalid" ? "valid" : "invalid";
  
  console.log('Toggling backend status from', actualBackendStatus, 'to', newStatus, 'for nondh:', affectedNondhNo);
  
  // Float the hukam invalid reason to the affected nondh's reason field
  const hukamDetail = nondhDetailData.find(d => d.id === hukamDetailId);
  const hukamReason = hukamDetail?.invalidReason || '';
  
  // Update backend status AND reason field
  setNondhDetailData(prev => {
    const updatedDetails = prev.map(detail => 
      detail.nondhId === affectedNondh.id 
        ? { 
            ...detail, 
            status: newStatus,
            invalidReason: newStatus === "invalid" ? hukamReason : detail.invalidReason
          } 
        : detail
    );
    
    // Process the validity chain with the updated state
    processValidityChain(updatedDetails);
    
    return updatedDetails;
  });
};

 const renderOwnerSelectionFields = (detail: NondhDetail) => {
  const previousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  
  if (detail.type === "Vechand") {
    console.log('Vechand detail ownerRelations:', detail.ownerRelations);
    console.log('Vechand detail:', detail);
  }

  // For Hakkami - get previous owners for both dropdowns
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
              onChange={(e) => updateNondhDetail(detail.id, { sdDate: e.target.value })}
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
            // Find the selected owner from previous owners
            const selectedOwner = previousOwners.find(owner => 
              owner.name === value
            );
            
            if (selectedOwner) {
              // For Hakkami, replace owner relations with old owner only
              if (detail.type === "Hakkami") {
                const oldOwnerRelation = {
                  id: Date.now().toString(),
                  ownerName: selectedOwner.name,
                  sNo: detail.sNo,
                  area: selectedOwner.area,
                  isValid: true
                };
                
                updateNondhDetail(detail.id, { 
                  oldOwner: selectedOwner.name,
                  ownerRelations: [] 
                });
              } else {
                // For Vechand, Hayati, Varsai - only update oldOwner field
                // Keep the existing new owner relations (don't add old owner to relations)
                updateNondhDetail(detail.id, { 
                  oldOwner: selectedOwner.name
                });
              }
              
              if (detail.status === 'invalid') {
                updateValidityChain(detail.id, selectedOwner.name, false);
              } else {
                updateValidityChain(detail.id, selectedOwner.name, true);
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
    {/* Equal distribution checkbox */}
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`equal_dist_${detail.id}`}
        checked={equalDistribution[detail.id] || false}
        onCheckedChange={(checked) => {
          setEqualDistribution(prev => ({ ...prev, [detail.id]: checked }));
          
          if (checked) {
            // Get old owner area from previous owners data
            const selectedOldOwner = vehchaniPreviousOwners.find(owner => owner.name === detail.oldOwner);
            const oldOwnerArea = selectedOldOwner?.area?.value || 0;
            
            // Get only new owners (excluding old owner)
            const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
  
  const newOwnersCount = detail.ownerRelations.filter(rel => 
    rel.ownerName !== detail.oldOwner
  ).length;
  
  if (newOwnersCount > 0) {
    const equalArea = effectiveArea / newOwnersCount;
              const updatedRelations = detail.ownerRelations.map((relation) => {
                // Don't modify old owner (shouldn't be in relations anyway)
                if (relation.ownerName === detail.oldOwner) {
                  return relation;
                }
                return { ...relation, area: { ...relation.area, value: equalArea } };
              });
              
              updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
            }
          }
        }}
      />
      <Label htmlFor={`equal_dist_${detail.id}`}>Equal Distribution of Land</Label>
    </div>

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
                    // Get old owner area from previous owners data
                    const selectedOldOwner = vehchaniPreviousOwners.find(o => o.name === detail.oldOwner);
                    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                    
                    let updatedRelations = [...detail.ownerRelations];
                    
                    if (checked) {
                      // Add new owner relation with 0 area
                      const newRelation = {
                        id: Date.now().toString(),
                        ownerName: owner.name,
                        sNo: detail.sNo,
                        area: { value: 0, unit: selectedOldOwner?.area?.unit || owner.area.unit },
                        isValid: true
                      };
                      
                      updatedRelations.push(newRelation);
                    } else {
                      // Remove owner relation
                      updatedRelations = updatedRelations.filter(rel => 
                        rel.ownerName !== owner.name
                      );
                    }
                    
                    updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
                    
                    // Auto-distribute if equal distribution is enabled
                    if (equalDistribution[detail.id] && selectedOldOwner) {
                      const newOwnersCount = updatedRelations.filter(rel => 
                        rel.ownerName !== detail.oldOwner
                      ).length;

                      // Use year slab effective area
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
  
  if (newOwnersCount > 0) {
    const equalArea = effectiveArea / newOwnersCount; // Use effective area
                        
                        const redistributed = updatedRelations.map(relation => {
                          // Don't modify old owner (shouldn't be in relations)
                          if (relation.ownerName === detail.oldOwner) {
                            return relation;
                          }
                          return { ...relation, area: { ...relation.area, value: equalArea } };
                        });
                        
                        updateNondhDetail(detail.id, { ownerRelations: redistributed });
                      }
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

    {/* Area Distribution for NEW Owners Only */}
    {detail.ownerRelations.filter(rel => 
      rel.ownerName.trim() !== "" && rel.ownerName !== detail.oldOwner
    ).length > 0 && (
      <div className="space-y-3">
        <Label>Area Distribution for New Owners</Label>
        
        {/* Show new owners with editable areas */}
        {detail.ownerRelations
          .filter(rel => rel.ownerName.trim() !== "" && rel.ownerName !== detail.oldOwner)
          .map((relation) => (
            <div key={relation.id} className="flex items-center gap-3 p-2 border rounded">
              <span className="min-w-0 flex-1 font-medium">{relation.ownerName}</span>
              <div className="flex-shrink-0">
                {areaFields({
                  area: relation.area,
                  onChange: (newArea) => {
                    // Validate before updating
                    const currentDetail = nondhDetailData.find(d => d.id === detail.id);
                    if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(currentDetail?.type || "")) {
                      const oldOwnerArea = getPreviousOwners(currentDetail.sNo, currentDetail.nondhId)
                        .find(owner => owner.name === currentDetail.oldOwner)?.area?.value || 0;
                      
                      const otherNewOwnersTotal = currentDetail.ownerRelations
                        .filter(rel => rel.id !== relation.id && rel.ownerName !== currentDetail.oldOwner && rel.ownerName.trim() !== "")
                        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                      
                      const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
                      
                      if (proposedTotal > oldOwnerArea) {
                        toast({
                          title: "Area validation error",
                          description: `Total area would exceed old owner's area. Maximum allowed: ${oldOwnerArea - otherNewOwnersTotal}`,
                          variant: "destructive"
                        });
                        return;
                      }
                    }
                    
                    updateOwnerRelation(detail.id, relation.id, { area: newArea });
                  },
                  disabled: equalDistribution[detail.id]
                })}
              </div>
            </div>
          ))}
        
        {/* Area validation display */}
        <div className="text-sm text-muted-foreground">
          {(() => {
  // Get old owner area from previous owners data
  const selectedOldOwner = vehchaniPreviousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
  
  // Only sum new owners (old owner not in relations)
  const newOwnersTotal = detail.ownerRelations
    .filter(rel => rel.ownerName !== detail.oldOwner)
    .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
  const remaining = oldOwnerArea - newOwnersTotal;
  
  // Get year slab area and calculate effective area for equal distribution
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
  const exceedsYearSlab = yearSlabArea && (newOwnersTotal > yearSlabArea.value);
  
  return (
    <div className={`p-2 rounded ${
      remaining < 0 || exceedsYearSlab ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
    }`}>
      Old Owner Area: {oldOwnerArea} | New Owners Total: {newOwnersTotal} | Remaining: {remaining}
      {yearSlabArea && ` | Year Slab Limit: ${yearSlabArea.value}`}
      {exceedsYearSlab && " ❌ Exceeds year slab area!"}
      {remaining < 0 && " ⚠️ Exceeds old owner area!"}
      {remaining > 0 && " (Old owner retains remaining area)"}
      {equalDistribution[detail.id] && detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length > 0 && ` (Equal distribution: ${(effectiveArea / detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length).toFixed(2)} each)`}
    </div>
  );
})()}
        </div>
      </div>
    )}
  </div>
)}
      {/* Hakkami Section */}
      {detail.type === "Hakkami" && (
        <div className="space-y-4">
          {/* Equal distribution checkbox */}
<div className="flex items-center space-x-2">
  <Checkbox
    id={`equal_dist_${detail.id}`}
    checked={equalDistribution[detail.id] || false}
    onCheckedChange={(checked) => {
      setEqualDistribution(prev => ({ ...prev, [detail.id]: checked }));
      
      if (checked) {
        // Get old owner area from previous owners
        const hakkamiPreviousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
        const selectedOldOwner = hakkamiPreviousOwners.find(owner => owner.name === detail.oldOwner);
        const oldOwnerArea = selectedOldOwner?.area?.value || 0;
        
        // Calculate effective area considering year slab limit
        const yearSlabArea = getYearSlabAreaForDate(detail.date);
        const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
          ? yearSlabArea.value 
          : oldOwnerArea;
        
        // Get only new owners (excluding old owner)
        const newOwnersCount = detail.ownerRelations.filter(rel => 
          rel.ownerName !== detail.oldOwner
        ).length;
        
        if (newOwnersCount > 0) {
          const equalArea = effectiveArea / newOwnersCount;
          
          const updatedRelations = detail.ownerRelations.map((relation) => {
            if (relation.ownerName === detail.oldOwner) {
              return relation; // Keep old owner area unchanged
            }
            return { ...relation, area: { ...relation.area, value: equalArea } };
          });
          
          updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
        }
      }
    }}
  />
  <Label htmlFor={`equal_dist_${detail.id}`}>Equal Distribution of Land</Label>
</div>

          {/* Available Previous Owners as Checkboxes for NEW owners only */}
          <div className="space-y-2">
            <Label>Select New Owners *</Label>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
              {hakkamiPreviousOwners
                .filter(owner => owner.name !== detail.oldOwner) // Exclude the selected old owner
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
                          const oldOwnerRelation = detail.ownerRelations.find(rel => rel.ownerName === detail.oldOwner);
                          const oldOwnerArea = oldOwnerRelation?.area?.value || 0;
                          
                          let updatedRelations = [...detail.ownerRelations];
                          
                          if (checked) {
                            // Add new owner relation
                            const newRelation = {
                              id: Date.now().toString(),
                              ownerName: owner.name,
                              sNo: detail.sNo,
                              area: { value: 0, unit: owner.area.unit },
                              isValid: true
                            };
                            
                            updatedRelations.push(newRelation);
                          } else {
                            // Remove owner relation (only if not the old owner)
                            updatedRelations = updatedRelations.filter(rel => 
                              rel.ownerName !== owner.name || rel.ownerName === detail.oldOwner
                            );
                          }
                          
                          updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
                          
                          // Auto-distribute if equal distribution is enabled
if (equalDistribution[detail.id]) {
  // Get old owner area from previous owners
  const hakkamiPreviousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  const selectedOldOwner = hakkamiPreviousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerAreaFromPrevious = selectedOldOwner?.area?.value || 0;
  
  // Calculate effective area
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerAreaFromPrevious > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerAreaFromPrevious;
  
  const newOwnersCount = updatedRelations.filter(rel => 
    rel.ownerName !== detail.oldOwner
  ).length;
  
  if (newOwnersCount > 0) {
    const equalArea = effectiveArea / newOwnersCount; // Use effective area
                              
                              const redistributed = updatedRelations.map(relation => {
                                if (relation.ownerName === detail.oldOwner) {
                                  return relation; // Keep old owner area unchanged
                                }
                                return { ...relation, area: { ...relation.area, value: equalArea } };
                              });
                              
                              updateNondhDetail(detail.id, { ownerRelations: redistributed });
                            }
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

          {/* Area Distribution for NEW Owners Only */}
          {detail.ownerRelations.filter(rel => 
            rel.ownerName.trim() !== "" && rel.ownerName !== detail.oldOwner
          ).length > 0 && (
            <div className="space-y-3">
              <Label>Area Distribution for New Owners</Label>
              
              {/* Show new owners with editable areas */}
              {detail.ownerRelations
                .filter(rel => rel.ownerName.trim() !== "" && rel.ownerName !== detail.oldOwner)
                .map((relation) => (
                  <div key={relation.id} className="flex items-center gap-3 p-2 border rounded">
                    <span className="min-w-0 flex-1 font-medium">{relation.ownerName}</span>
                    <div className="flex-shrink-0">
                      {areaFields({
                        area: relation.area,
                        onChange: (newArea) => {
  // Validate before updating
  const currentDetail = nondhDetailData.find(d => d.id === detail.id);
  if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(currentDetail?.type || "")) {
    const oldOwnerArea = getPreviousOwners(currentDetail.sNo, currentDetail.nondhId)
      .find(owner => owner.name === currentDetail.oldOwner)?.area?.value || 0;
    
    const otherNewOwnersTotal = currentDetail.ownerRelations
      .filter(rel => rel.id !== relation.id && rel.ownerName !== currentDetail.oldOwner && rel.ownerName.trim() !== "")
      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    
    const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
    
    if (proposedTotal > oldOwnerArea) {
      toast({
        title: "Area validation error",
        description: `Total area would exceed old owner's area. Maximum allowed: ${oldOwnerArea - otherNewOwnersTotal}`,
        variant: "destructive"
      });
      return;
    }
  }
  
  updateOwnerRelation(detail.id, relation.id, { area: newArea });
},
                        disabled: equalDistribution[detail.id]
                      })}
                    </div>
                  </div>
                ))}
              
              {/* Area validation display */}
              <div className="text-sm text-muted-foreground">
                {(() => {
                   const hakkamiPreviousOwners = getPreviousOwners(detail.sNo, detail.nondhId);
  const selectedOldOwner = hakkamiPreviousOwners.find(owner => owner.name === detail.oldOwner);
  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                  const newOwnersTotal = detail.ownerRelations
                    .filter(rel => rel.ownerName !== detail.oldOwner)
                    .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                  const remaining = oldOwnerArea - newOwnersTotal;
                    // ADD: Year slab validation
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const exceedsYearSlab = yearSlabArea && (newOwnersTotal > yearSlabArea.value);
                  return (
    <div className={`p-2 rounded ${
      remaining < 0 || exceedsYearSlab ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
    }`}>
      Old Owner Area: {oldOwnerArea} | New Owners Total: {newOwnersTotal} | Remaining: {remaining}
      {yearSlabArea && ` | Year Slab Limit: ${yearSlabArea.value}`}
      {exceedsYearSlab && " ❌ Exceeds year slab area!"}
                      {remaining < 0 && " (⚠️ Exceeds old owner area!)"}
                      {remaining > 0 && " (Old owner retains remaining area)"}
                      {equalDistribution[detail.id] && (() => {
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
  const newOwnersCount = detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length;
  return ` (Equal distribution: ${(effectiveArea / newOwnersCount).toFixed(2)} each)`;
})()}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Equal distribution checkbox - shown for Hayati, Varsai, and Vechand */}
      {(detail.type === "Hayati_ma_hakh_dakhal" || detail.type === "Varsai" || detail.type === "Vechand") && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`equal_dist_${detail.id}`}
            checked={equalDistribution[detail.id] || false}
            onCheckedChange={(checked) => {
              setEqualDistribution(prev => ({ ...prev, [detail.id]: checked }));
              
              if (checked) {
                // Get old owner area from previous owners data, not from ownerRelations
                const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
                const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
                // Get only new owners (excluding any potential old owner that might be in relations)
                const newOwners = detail.ownerRelations.filter(rel => 
                  rel.ownerName.trim() !== "" && rel.ownerName !== detail.oldOwner
                );
                const newOwnersCount = newOwners.length;
                
                if (newOwnersCount > 0) {
                  const equalArea = effectiveArea / newOwnersCount;
                  
                  const updatedRelations = detail.ownerRelations.map((relation) => {
                    // Don't modify old owner area (it shouldn't be in relations anyway)
                    if (relation.ownerName === detail.oldOwner) {
                      return relation;
                    }
                    return { ...relation, area: { ...relation.area, value: equalArea } };
                  });
                  
                  updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
                }
              }
            }}
          />
          <Label htmlFor={`equal_dist_${detail.id}`}>Equal Distribution of Land</Label>
        </div>
      )}

      {/* Owner Details Section for Hayati, Varsai, and Vechand */}
      {(detail.type === "Varsai" || detail.type === "Hayati_ma_hakh_dakhal" || detail.type === "Vechand") && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>New Owner Details</Label>
            <Button size="sm" onClick={() => addOwnerRelation(detail.id)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Owner
            </Button>
          </div>

          {detail.ownerRelations.map((relation, index) => (
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

              {/* Owner Name and Tenure in one row */}
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

              {/* Area */}
              <div className="space-y-2">
                <Label>Area</Label>
                {areaFields({
  area: relation.area,
  onChange: (newArea) => {
    // Validate before updating
    if (["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail?.type || "")) {
      const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
      const oldOwnerArea = selectedOldOwner?.area?.value || 0;
      
      const otherNewOwnersTotal = detail.ownerRelations
        .filter(rel => rel.id !== relation.id && rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
        .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
      
      const proposedTotal = otherNewOwnersTotal + (newArea.value || 0);
      
      if (proposedTotal > oldOwnerArea) {
        toast({
          title: "Area validation error",
          description: `Total area would exceed old owner's area. Maximum allowed: ${oldOwnerArea - otherNewOwnersTotal}`,
          variant: "destructive"
        });
        return;
      }
    }
    
    updateOwnerRelation(detail.id, relation.id, { area: newArea });
  },
  disabled: equalDistribution[detail.id]
})}
              </div>
            </Card>
          ))}
          
          {/* Show remaining area info */}
          <div className="text-sm text-muted-foreground">
  {(() => {
    const selectedOldOwner = previousOwners.find(owner => owner.name === detail.oldOwner);
    const oldOwnerArea = selectedOldOwner?.area?.value || 0;
    const newOwnersTotal = detail.ownerRelations
      .filter(rel => rel.ownerName !== detail.oldOwner && rel.ownerName.trim() !== "")
      .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    const remaining = oldOwnerArea - newOwnersTotal;
     // Year slab validation
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const exceedsYearSlab = yearSlabArea && (newOwnersTotal > yearSlabArea.value);
  
  return (
    <div className={`p-2 rounded ${
      remaining < 0 || exceedsYearSlab ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
    }`}>
      Old Owner Area: {oldOwnerArea} | New Owners Total: {newOwnersTotal} | Remaining: {remaining}
      {yearSlabArea && ` | Year Slab Limit: ${yearSlabArea.value}`}
      {exceedsYearSlab && " ❌ Exceeds year slab area!"}
        {remaining < 0 && " ❌ Exceeds old owner area!"}
        {remaining === 0 && " ✅ Fully allocated"}
        {remaining > 0 && ` ✅ Available: ${remaining}`}
        {equalDistribution[detail.id] && (() => {
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
    ? yearSlabArea.value 
    : oldOwnerArea;
  const newOwnersCount = detail.ownerRelations.filter(rel => rel.ownerName !== detail.oldOwner).length;
  return ` (Auto-distributed: ${(effectiveArea / newOwnersCount).toFixed(2)} each)`;
})()}
      </div>
    );
  })()}
</div>
        </div>
      )}
    </div>
  );
};

  const renderTypeSpecificFields = (detail: NondhDetail) => {

  // Handle other types that need owner selection
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
                        onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
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

            {/* Owner Name - Full width */}
            <div className="space-y-2 mb-3">
              <Label>Owner Name</Label>
              <Input
                value={relation.ownerName}
                onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
                placeholder="Enter owner name"
              />
            </div>

            {/* Survey Number and Type in one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="space-y-2">
                <Label>Survey Number</Label>
                <Input
                  value={relation.surveyNumber || ''}
                  onChange={(e) => updateOwnerRelation(detail.id, relation.id, { surveyNumber: e.target.value })}
                  placeholder="Enter survey number"
                />
              </div>
              <div className="space-y-2">
                <Label>Survey Number Type</Label>
                <Select
                  value={relation.surveyNumberType || 's_no'}
                  onValueChange={(value) => updateOwnerRelation(detail.id, relation.id, { surveyNumberType: value })}
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

            {/* Area and Tenure in one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Area</Label>
                {areaFields({
                  area: relation.area,
                  onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { area: newArea })
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
      {/* Owner Details Section */}
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

            {/* Compact layout like Kabjedaar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input
                  value={relation.ownerName}
                  onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
                  placeholder="Enter owner name"
                />
              </div>
              <div className="space-y-2">
  <Label>Area</Label>
  {areaFields({
    area: relation.area,
    onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { area: newArea })
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
        onValueChange={(value) => {
          // First update the nondh number
          updateAffectedNondh(detail.id, affected.id, { nondhNo: value });
          
          // If there was a previous status set, apply it to the new nondh
          if (affected.status && affected.status !== "valid") {
            updateAffectedNondhValidityChain(detail.id, value, affected.status);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select nondh" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          {sortedOriginalNondhs.map(nondh => {
            const nondhDetail = nondhDetailData.find(d => d.nondhId === nondh.id);
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
                      {typeLabel} No: {typeof nondh.affectedSNos[0] === 'string' ? nondh.affectedSNos[0] : nondh.affectedSNos[0]?.number || ''}
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
  console.log('=== AFFECTED NONDH STATUS CHANGE START ===');
  console.log('Changing affected nondh status to:', value);
  console.log('Affected nondh number:', affected.nondhNo);

  // Update the affected nondh record UI only
  updateAffectedNondh(detail.id, affected.id, { 
    status: value, // This updates only the UI dropdown
    invalidReason: value === "invalid" ? affected.invalidReason : ""
  });
  
  // Toggle the actual backend status based on REAL backend status
  if (affected.nondhNo) {
    toggleAffectedNondhStatus(affected.nondhNo, value, detail.id); // Pass hukam detail ID
  }
  console.log('=== AFFECTED NONDH STATUS CHANGE END ===');
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
    onChange={(e) => updateAffectedNondh(detail.id, affected.id, { invalidReason: e.target.value })}
    placeholder={affected.status === "invalid" ? "Enter reason for invalidation" : "Enter reason (optional)"}
  />
</div>
            </Card>
          );
        })}
      </div>

{/* Ganot-specific owner handling */}
{detail.ganot === "2nd Right" && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Label>Ganot Details</Label>
      <Button size="sm" onClick={() => {
        // Add a new empty owner relation
        const newRelation = {
          id: Date.now().toString() + Math.random(),
          ownerName: "",
          sNo: detail.sNo,
          area: { value: 0, unit: "sq_m" },
          isValid: true
        };
        const updatedRelations = [...detail.ownerRelations, newRelation];
        updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
      }}>
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
          {/* 1st Right - Transfer Management */}
          {/* 1st Right */}
{detail.ganot === "1st Right" && (
  <div className="space-y-4">
    {/* Old Owner Selection */}
    <div className="space-y-2">
      <Label>Old Ganot *</Label>
      <Select
        value={detail.oldOwner || ''}
        onValueChange={(value) => {
          const currentNondh = nondhs.find(n => n.id === detail.nondhId);
          const currentSNos = currentNondh?.affectedSNos.map(sNo => 
            typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
          ) || [];
          
          const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
          const selectedOwner = availableOwners.oldOwners.find(o => o.name === value);
          
          if (selectedOwner) {
            updateNondhDetail(detail.id, { 
              oldOwner: selectedOwner.name,
              ownerRelations: [] // Start fresh like Hakkami
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
            const currentSNos = currentNondh?.affectedSNos.map(sNo => 
              typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
            ) || [];
            const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
            
            return availableOwners.oldOwners.map((owner) => (
              <SelectItem key={owner.id} value={owner.name}>
                {owner.name} - {owner.area.value} {owner.area.unit} (From Nondh: {nondhs.find(n => n.id === owner.nondhId)?.number})
              </SelectItem>
            ));
          })()}
        </SelectContent>
      </Select>
    </div>

    {/* Equal Distribution Checkbox */}
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`equal_dist_1st_${detail.id}`}
        checked={equalDistribution[detail.id] || false}
        onCheckedChange={(checked) => {
          setEqualDistribution(prev => ({ ...prev, [detail.id]: checked }));
          
          if (checked && detail.oldOwner) {
            const currentNondh = nondhs.find(n => n.id === detail.nondhId);
            const currentSNos = currentNondh?.affectedSNos.map(sNo => 
              typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
            ) || [];
            const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
            const selectedOldOwner = availableOwners.oldOwners.find(o => o.name === detail.oldOwner);
            const oldOwnerArea = selectedOldOwner?.area?.value || 0;
            
            // Calculate effective area
            const yearSlabArea = getYearSlabAreaForDate(detail.date);
            const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
              ? yearSlabArea.value 
              : oldOwnerArea;
            
            const newOwnersCount = detail.ownerRelations.length;
            
            if (newOwnersCount > 0) {
              const equalArea = effectiveArea / newOwnersCount;
              
              const updatedRelations = detail.ownerRelations.map((relation) => ({
                ...relation,
                area: { ...relation.area, value: equalArea }
              }));
              
              updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
            }
          }
        }}
      />
      <Label htmlFor={`equal_dist_1st_${detail.id}`}>Equal Distribution of Land</Label>
    </div>

    {/* New Ganot Selection */}
    <div className="space-y-2">
      <Label>Select New Ganot *</Label>
      <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
        {(() => {
          const currentNondh = nondhs.find(n => n.id === detail.nondhId);
          const currentSNos = currentNondh?.affectedSNos.map(sNo => 
            typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
          ) || [];
          const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
          
          return availableOwners.newOwners.map((owner) => {
            const isSelected = detail.ownerRelations.some(rel => rel.ownerName === owner.name);
            
            return (
              <div key={owner.id} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`new_ganot_${owner.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    let updatedRelations = [...detail.ownerRelations];
                    
                    if (checked) {
                      // Add new owner
                      const newRelation = {
                        id: Date.now().toString(),
                        ownerName: owner.name,
                        sNo: detail.sNo,
                        area: { value: 0, unit: owner.area.unit },
                        isValid: true
                      };
                      updatedRelations.push(newRelation);
                    } else {
                      // Remove owner
                      updatedRelations = updatedRelations.filter(rel => rel.ownerName !== owner.name);
                    }
                    
                    updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
                    
                    // Auto-distribute if equal distribution is enabled
                    if (equalDistribution[detail.id] && detail.oldOwner) {
                      const selectedOldOwner = availableOwners.oldOwners.find(o => o.name === detail.oldOwner);
                      const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                      
                      const yearSlabArea = getYearSlabAreaForDate(detail.date);
                      const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
                        ? yearSlabArea.value 
                        : oldOwnerArea;
                      
                      if (updatedRelations.length > 0) {
                        const equalArea = effectiveArea / updatedRelations.length;
                        
                        const redistributed = updatedRelations.map(relation => ({
                          ...relation,
                          area: { ...relation.area, value: equalArea }
                        }));
                        
                        updateNondhDetail(detail.id, { ownerRelations: redistributed });
                      }
                    }
                  }}
                />
                <Label htmlFor={`new_ganot_${owner.id}`} className="flex-1">
                  {owner.name} - {owner.area.value} {owner.area.unit} (From Nondh: {nondhs.find(n => n.id === owner.nondhId)?.number})
                </Label>
              </div>
            );
          });
        })()}
      </div>
    </div>

    {/* Area Distribution */}
    {detail.ownerRelations.length > 0 && (
      <div className="space-y-3">
        <Label>Area Distribution for New Ganot</Label>
        {detail.ownerRelations.map((relation) => (
          <div key={relation.id} className="flex items-center gap-3 p-2 border rounded">
            <span className="min-w-0 flex-1 font-medium">{relation.ownerName}</span>
            <div className="flex-shrink-0">
              {areaFields({
                area: relation.area,
                onChange: (newArea) => {
                  if (equalDistribution[detail.id]) return;
                  
                  const currentNondh = nondhs.find(n => n.id === detail.nondhId);
                  const currentSNos = currentNondh?.affectedSNos.map(sNo => 
                    typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
                  ) || [];
                  const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
                  const selectedOldOwner = availableOwners.oldOwners.find(o => o.name === detail.oldOwner);
                  const oldOwnerArea = selectedOldOwner?.area?.value || 0;
                  
                  const otherOwnersTotal = detail.ownerRelations
                    .filter(rel => rel.id !== relation.id)
                    .reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
                  
                  const proposedTotal = otherOwnersTotal + (newArea.value || 0);
                  
                  if (proposedTotal > oldOwnerArea) {
                    toast({
                      title: "Area validation error",
                      description: `Total area would exceed old ganot's area. Maximum allowed: ${oldOwnerArea - otherOwnersTotal}`,
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  updateOwnerRelation(detail.id, relation.id, { area: newArea });
                },
                disabled: equalDistribution[detail.id]
              })}
            </div>
          </div>
        ))}
        
        {/* Area validation display */}
        <div className="text-sm text-muted-foreground">
          {(() => {
            const currentNondh = nondhs.find(n => n.id === detail.nondhId);
            const currentSNos = currentNondh?.affectedSNos.map(sNo => 
              typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
            ) || [];
            const availableOwners = getAvailableOwnersForGanot("1st Right", detail.nondhId, currentSNos);
            const selectedOldOwner = availableOwners.oldOwners.find(o => o.name === detail.oldOwner);
            const oldOwnerArea = selectedOldOwner?.area?.value || 0;
            const totalNewOwnerArea = detail.ownerRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
            const remaining = oldOwnerArea - totalNewOwnerArea;
            
            const yearSlabArea = getYearSlabAreaForDate(detail.date);
            const effectiveArea = yearSlabArea && oldOwnerArea > yearSlabArea.value 
              ? yearSlabArea.value 
              : oldOwnerArea;
            const exceedsYearSlab = yearSlabArea && (totalNewOwnerArea > yearSlabArea.value);
            
            return (
              <div className={`p-2 rounded ${
                remaining < 0 || exceedsYearSlab ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                Old Ganot Area: {oldOwnerArea} | New Ganot Total: {totalNewOwnerArea} | Remaining: {remaining}
                {yearSlabArea && ` | Year Slab Limit: ${yearSlabArea.value}`}
                {exceedsYearSlab && " ❌ Exceeds year slab area!"}
                {remaining < 0 && " ⚠️ Exceeds old ganot area!"}
                {equalDistribution[detail.id] && ` (Equal distribution: ${(effectiveArea / detail.ownerRelations.length).toFixed(2)} each)`}
              </div>
            );
          })()}
        </div>
      </div>
    )}
  </div>
)}
{!(detail.hukamType === "ALT Krushipanch" && (detail.ganot === "1st Right" || detail.ganot === "2nd Right")) && (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
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
            {/* Owner Name - Full width */}
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input
                value={relation.ownerName}
                onChange={(e) => updateOwnerRelation(detail.id, relation.id, { ownerName: e.target.value })}
                placeholder="Enter owner name"
              />
            </div>

            {/* Area and Tenure in one row on desktop */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Area Fields - Takes remaining space */}
              <div className="flex-1">
                <Label>Area</Label>
                {areaFields({
                  area: relation.area,
                  onChange: (newArea) => updateOwnerRelation(detail.id, relation.id, { area: newArea })
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
  }

  const get712Documents = () => {
    const docs: any[] = []
    yearSlabs.forEach((slab) => {
      if (slab.integrated712) {
        docs.push({
          year: `${slab.startYear}-${slab.endYear}`,
          sNo: slab.sNo,
          url: slab.integrated712,
          type: "Main Slab",
          area: slab.area ? `${slab.area.value} ${slab.area.unit}` : 'N/A'
        })
      }

      slab.paikyEntries.forEach((entry, index) => {
        if (entry.integrated712) {
          docs.push({
            year: `${slab.startYear}-${slab.endYear}`,
            sNo: entry.sNo,
            url: entry.integrated712,
            type: `Paiky ${index + 1}`,
            area: entry.area ? `${entry.area.value} ${entry.area.unit}` : 'N/A'
          })
        }
      })

      slab.ekatrikaranEntries.forEach((entry, index) => {
        if (entry.integrated712) {
          docs.push({
            year: `${slab.startYear}-${slab.endYear}`,
            sNo: entry.sNo,
            url: entry.integrated712,
            type: `Ekatrikaran ${index + 1}`,
            area: entry.area ? `${entry.area.value} ${entry.area.unit}` : 'N/A'
          })
        }
      })
    })
    return docs
  }
const handleGanotChange = (detailId: string, ganot: string) => {
  console.log('=== HANDLE GANOT CHANGE START ===');
  console.log('Detail ID:', detailId);
  console.log('New Ganot:', ganot);
  
  // CRITICAL: Get detail and nondh BEFORE any state updates
  const detail = nondhDetailData.find(d => d.id === detailId);
  
  if (!detail) {
    console.log('ERROR: Detail not found for detailId:', detailId);
    return;
  }
  
  const currentNondh = nondhs.find(n => n.id === detail.nondhId);
  
  if (!currentNondh) {
    console.log('ERROR: Nondh not found for nondhId:', detail.nondhId);
    return;
  }
  
  console.log('Found detail and nondh:', currentNondh.number);
  
  // Now update the ganot
  updateNondhDetail(detailId, { ganot });
  
  // Create default transfer for 1st Right if none exists
  if (ganot === "1st Right" && (!ownerTransfers[detailId] || ownerTransfers[detailId].length === 0)) {
    console.log('Adding owner transfer for 1st Right');
    addOwnerTransfer(detailId);
  }
  
  // Auto-populate all previous owners for 2nd Right
if (ganot === "2nd Right") {
  console.log('Processing 2nd Right auto-population');
  
  const currentSNos = currentNondh.affectedSNos.map(sNo => 
    typeof sNo === 'string' ? JSON.parse(sNo).number : sNo.number
  );
  console.log('Current SNos:', currentSNos);
  
  const previousOwners = getAvailableOwnersForGanot("2nd Right", currentNondh.id, currentSNos);
  console.log('Previous owners returned:', previousOwners);
  console.log('Previous owners count:', previousOwners.length);
  
  // Convert all previous owners to owner relations
  const ownerRelations = previousOwners.map((owner, index) => ({
    id: (Date.now() + index).toString(),
    ownerName: owner.name,
    sNo: owner.sNo,
    area: owner.area,
    isValid: true
  }));
  
  console.log('Setting owner relations:', ownerRelations.map(r => r.ownerName));
  
  // ADD: Validate total area against year slab
  const yearSlabArea = getYearSlabAreaForDate(detail.date);
  if (yearSlabArea) {
    const totalOwnersArea = ownerRelations.reduce((sum, rel) => sum + (rel.area?.value || 0), 0);
    
    if (totalOwnersArea > yearSlabArea.value) {
  console.log('Total owners area exceeds year slab, clearing areas to 0');
  // Clear all areas to 0
  const clearedOwnerRelations = ownerRelations.map(rel => ({
    ...rel,
    area: { value: 0, unit: rel.area.unit }
  }));
  
  updateNondhDetail(detailId, { ownerRelations: clearedOwnerRelations });
  
  // Show warning toast with proper duration
  toast({
    title: "Area exceeds year slab limit",
    description: `Total auto-populated owners area (${totalOwnersArea.toFixed(2)}) exceeds year slab limit (${yearSlabArea.value}). All owner areas have been cleared to 0. Please manually enter areas with total not exceeding ${yearSlabArea.value}.`,
    variant: "destructive"
    // Remove duration property to use default behavior, or set it higher like duration: 5000
  });
  return;
}
  }
  
  // Update with the new owner relations (if validation passed)
  updateNondhDetail(detailId, { ownerRelations });
}
  
  console.log('=== HANDLE GANOT CHANGE END ===\n');
};

  const handleSubmit = async () => {
    // Force save current state to step data immediately before submitting
   const immediateStepData = {
    nondhDetails: nondhDetailData,
    ownerTransfers,
    transferEqualDistribution,
    affectedNondhDetails
  };
  updateStepData(immediateStepData);
  // Update validity chain for all nondhs first
  nondhDetailData.forEach(detail => {
    if (detail.status === 'invalid') {
      updateValidityChain();
    }
    if (detail.hukamStatus === 'invalid' && detail.affectedNondhNo) {
      updateHukamValidityChain(detail.id);
    }
  });

  if (!nondhs.length) {
    toast({
      title: "Error",
      description: "No nondh data available to save",
      variant: "destructive"
    });
    return;
  }

  // Process data before saving - copy tenure for Varsai/Hayyati types
  const processedDetails = nondhDetailData.map(detail => {
    // For Varsai and Hayyati types, copy tenure from old owner to new owners
    if (["Varsai", "Hayati_ma_hakh_dakhal","Hakkami","Vechand"].includes(detail.type) && detail.ownerRelations.length > 1) {
      const oldOwnerTenure = detail.ownerRelations[0]?.tenure || "Navi";
      return {
        ...detail,
        ownerRelations: detail.ownerRelations.map((relation, index) => ({
          ...relation,
          // Keep old owner's tenure, copy to new owners
          tenure: index === 0 ? relation.tenure : oldOwnerTenure
        }))
      };
    }
    return detail;
  });

  const validation = validateNondhDetails(processedDetails);
if (!validation.isValid) {
  toast({
    title: "Validation Error",
    description: validation.errors.join('; '),
    variant: "destructive"
  });
  return;
}

  // Filter out empty/incomplete nondh details from processed data
  const validNondhDetails = processedDetails.filter(detail => {
    // Check if detail has meaningful content
    const hasOwnerNames = detail.ownerRelations.some(rel => rel.ownerName.trim() !== "");
    const hasReason = detail.reason.trim() !== "";
    const hasVigat = detail.vigat.trim() !== "";
    const hasDate = detail.date.trim() !== "";
    const isNonDefaultStatus = detail.status !== "valid";
    const hasDocuments = detail.hasDocuments && detail.docUpload;
    
    // Special handling for different nondh types
    const hasTypeSpecificData = (() => {
      switch (detail.type) {
        case "Hukam":
          return detail.ownerRelations.some(rel => 
            rel.hukamDate || rel.hukamType || rel.restrainingOrder
          );
        case "Varsai":
        case "Hakkami":
        case "Vechand":
        case "Hayati_ma_hakh_dakhal":
          return detail.oldOwner && detail.oldOwner.trim() !== "";
        default:
          return true; // For basic types, owner names are sufficient
      }
    })();
    
    return hasOwnerNames || hasReason || hasVigat || hasDate || 
           isNonDefaultStatus || hasDocuments || hasTypeSpecificData;
  });

  if (!validNondhDetails.length) {
    toast({
      title: "No data to save",
      description: "Please enter nondh details before saving",
      variant: "destructive"
    });
    return;
  }

  setLoading(true);
  try {
    // 1. First get all existing nondh IDs to delete
    const existingNondhIds = nondhs
      .map(n => n.id)
      .filter(id => id && id !== "1" && id !== "new");

    if (existingNondhIds.length === 0) {
      throw new Error("No valid nondh IDs found");
    }

    // 2. Get existing nondh details and their relations to delete
    const { data: existingDetails, error: fetchError } = await supabase
      .from('nondh_details')
      .select('id')
      .in('nondh_id', existingNondhIds);

    if (fetchError) throw fetchError;

    // 3. Delete existing data in correct order (relations first)
    if (existingDetails?.length) {
      // Delete owner relations first
      const { error: relationsDeleteError } = await supabase
        .from('nondh_owner_relations')
        .delete()
        .in('nondh_detail_id', existingDetails.map(d => d.id));

      if (relationsDeleteError) throw relationsDeleteError;

      // Then delete nondh details
      const { error: detailsDeleteError } = await supabase
        .from('nondh_details')
        .delete()
        .in('id', existingDetails.map(d => d.id));

      if (detailsDeleteError) throw detailsDeleteError;
    }

    // Insert new nondh details 
    const { data: insertedDetails, error: insertError } = await supabase
  .from('nondh_details')
  .insert(validNondhDetails.map(detail => ({
    nondh_id: detail.nondhId,
    s_no: detail.sNo || nondhs.find(n => n.id === detail.nondhId)?.affectedSNos[0] || '',
    type: detail.type,
    reason: detail.reason || null,
    date: detail.date || null,
    tenure: detail.tenure || 'Navi',
    hukam_date: detail.hukamDate || null,
    hukam_type: detail.hukamType || 'SSRD',
    vigat: detail.vigat || null,
    status: detail.status,
    invalid_reason: detail.status === 'invalid' ? (detail.invalidReason || null) : null,
    old_owner: detail.oldOwner || null,
    show_in_output: detail.showInOutput !== false,
    has_documents: detail.hasDocuments || false,
    doc_upload_url: detail.docUpload || null,
    hukam_status: detail.hukamStatus || 'valid',
    hukam_invalid_reason: detail.hukamInvalidReason || null,
    affected_nondh_details: (() => {
  const affected = affectedNondhDetails[detail.id];
  // Filter out empty/incomplete affected nondhs (those without nondhNo)
  const validAffected = affected?.filter(a => a.nondhNo && a.nondhNo.trim() !== '');
  
  return validAffected && validAffected.length > 0
    ? JSON.stringify(validAffected.map(a => ({
        nondhNo: a.nondhNo,
        status: a.status,
        invalidReason: a.invalidReason || null
      })))
    : null;
})(),
    ganot: detail.ganot || null,
    restraining_order: detail.restrainingOrder || 'no',
    sd_date: detail.sdDate || null,
    amount: detail.amount || null
  })))
  .select();

if (insertError) throw insertError;

    // Prepare owner relations data
    const ownerRelationsToInsert = validNondhDetails.flatMap(detail => {
  const insertedDetail = insertedDetails.find(d => 
    d.nondh_id === detail.nondhId && 
    d.s_no === detail.sNo
  );
  
  if (!insertedDetail) return [];

  // For transfer types, exclude the old owner from owner relations
  const isTransferType = ["Varsai", "Hakkami", "Vechand", "Hayati_ma_hakh_dakhal", "Vehchani"].includes(detail.type);
  
  return detail.ownerRelations
    .filter(relation => relation.ownerName.trim() !== "")
    .filter(relation => {
      // For transfer types, exclude the old owner
      if (isTransferType && detail.oldOwner && relation.ownerName === detail.oldOwner) {
        return false;
      }
      return true;
    })
    .map(relation => {
      const isAcreGuntha = relation.area.unit === 'acre_guntha';
      const acres = isAcreGuntha ? Math.floor(relation.area.value || 0) : null;
      const gunthas = isAcreGuntha ? ((relation.area.value || 0) % 1) * 40 : null;
      const square_meters = isAcreGuntha ? null : (relation.area.value || 0);

      return {
        nondh_detail_id: insertedDetail.id,
        owner_name: relation.ownerName.trim(),
        s_no: relation.sNo || detail.sNo,
        acres,
        gunthas,
        square_meters,
        area_unit: relation.area.unit === 'acre_guntha' ? 'acre_guntha' : 'sq_m',
        is_valid: relation.isValid !== false,
        survey_number: relation.surveyNumber || null,
        survey_number_type: relation.surveyNumberType || null
      };
    });
});

    //  Insert owner relations in batch
    if (ownerRelationsToInsert.length > 0) {
  const { data: insertedRelations, error: relationsError } = await supabase
    .from('nondh_owner_relations')
    .insert(ownerRelationsToInsert)
    .select();

  if (relationsError) {
    console.error('Owner relations insert error:', relationsError);
    throw relationsError;
  }
}

    // Update local state
    const updatedDetails = validNondhDetails.map(detail => {
      const insertedDetail = insertedDetails.find(d => 
        d.nondh_id === detail.nondhId && d.s_no === detail.sNo
      );
      return insertedDetail ? { ...detail, dbId: insertedDetail.id } : detail;
    });

    setNondhDetails(updatedDetails);
    markAsSaved();

    await createActivityLog({
      user_email: user?.primaryEmailAddress?.emailAddress || "",
      land_record_id: landBasicInfo.id,
      step: 5,
      chat_id: null,
      description: `Added ${validNondhDetails.length} nondh detail(s) with ${ownerRelationsToInsert.length} owner relations successfully`
    });
    toast({
      title: "Success",
      description: `Saved ${validNondhDetails.length} nondh detail(s) with ${ownerRelationsToInsert.length} owner relations successfully`
    });
    
    setCurrentStep(6);
  } catch (error) {
    console.error('Save error:', error);
    toast({
      title: "Error saving nondh details",
      description: error instanceof Error ? error.message : "Database error",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};

  const documents712 = get712Documents()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4B: Nondh Details</CardTitle>
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
                    <TableCell>{doc.sNo}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>{doc.area}</TableCell>
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


        {/* Nondh Details by S.No */}
        {nondhs
  .map(nondh => ({
    ...nondh,
    primarySNoType: getPrimarySNoType(nondh.affectedSNos)
  }))
  .sort(sortNondhs)
  .map(sortedNondh => {
    const detail = nondhDetailData.find(d => d.nondhId === sortedNondh.id);
    if (!detail) return null;

    return (
      <Card key={sortedNondh.id} className="p-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                Nondh No: {sortedNondh.number}
              </h3>
              <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                {getNondhTypeDisplay(detail.type)}
              </span>
            </div>
            <div className="mt-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Affected Survey Numbers:
              </h4>
             <div className="flex flex-wrap gap-2 mt-1">
  {sortedNondh.affectedSNos
    .map(sNoStr => {
      try {
        return JSON.parse(sNoStr);
      } catch (e) {
        return { number: sNoStr, type: 's_no' };
      }
    })
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
        {number} ({type})
      </span>
    ))}
</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show nondh document if available */}
            {sortedNondh.nondhDoc && (
              <div className="flex items-center gap-2 mr-4">
                <div className="text-sm">
                  <div className="font-medium text-blue-600">
                    {sortedNondh.nondhDocFileName || 'Nondh Document'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(sortedNondh.nondhDoc, '_blank')}
                    className="mt-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Document
                  </Button>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleCollapse(sortedNondh.id)}
              className="flex items-center gap-1"
            >
              {collapsedNondhs.has(sortedNondh.id) ? (
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

        {!collapsedNondhs.has(sortedNondh.id) && (
          <div className="mt-4 space-y-4">
            <div className="border rounded-lg p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium">
                    Details for Nondh No: {sortedNondh.number}
                  </h4>
                  
                </div>
                <Badge variant={detail.status === 'invalid' ? 'destructive' : 'default'}>
                  {statusTypes.find(s => s.value === detail.status)?.label || 'Unknown'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
  <Label>Date *</Label>
  <Input
    type="date"
    value={detail.date || ''}
    min={getMinDateForNondh(sortedNondh.id)}
    max={getMaxDateForNondh(sortedNondh.id)}
    onChange={(e) => {
      const newDate = e.target.value;
      updateNondhDetail(detail.id, { date: newDate });
      
      // Auto-populate areas when date changes
      const yearSlabArea = getYearSlabAreaForDate(newDate);
      if (yearSlabArea) {
        const updatedRelations = detail.ownerRelations.map(relation => ({
          ...relation,
          area: { ...yearSlabArea }
        }));
        updateNondhDetail(detail.id, { ownerRelations: updatedRelations });
      }
    }}
  />
</div>

  <div className="space-y-2">
  <Label>Nondh Type *</Label>
  <Select
    value={detail.type}
    onValueChange={(value) => handleTypeChange(detail.id, value)}
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
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <div className="space-y-2">
      <Label>Authority</Label>
      <Select
        value={detail.hukamType || "SSRD"}
        onValueChange={(value) => {
          updateNondhDetail(detail.id, { hukamType: value });
          // Clear ganot if not ALT Krushipanch
          if (value !== "ALT Krushipanch") {
            updateNondhDetail(detail.id, { ganot: undefined });
          }
        }}
      >
        <SelectTrigger className="w-full">
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

{/* Hukam Date and Type for Hukam type */}
{detail.type === "Hukam" && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <div className="space-y-2">
  <Label>Hukam Date</Label>
  <Input
    type="date"
    value={detail.hukamDate || ''}
    min={getMinDateForNondh(sortedNondh.id)}
    max={getMaxDateForNondh(sortedNondh.id)}
    onChange={(e) => {
      const newDate = e.target.value;
      if (isValidNondhDateOrder(sortedNondh.id, newDate)) {
        updateNondhDetail(detail.id, { hukamDate: newDate });
      } else {
        toast({
          title: "Invalid Hukam Date",
          description: "Hukam dates must follow nondh date order",
          variant: "destructive"
        });
      }
    }}
    className="w-full"
  />
</div>
    
    {/* Add Ganot field for ALT Krushipanch */}
    {detail.hukamType === "ALT Krushipanch" && (
  <div className="space-y-2 md:col-span-2">
    <Label>Ganot *</Label>
    <Select
      value={detail.ganot || ''}
      onValueChange={(value) => handleGanotChange(detail.id, value)}
    >
      <SelectTrigger className="w-full">
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
  </div>
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
  </div>
  
  {/* Reason field - always shown, mandatory only for invalid status */}
  <div className="space-y-2">
    <Label>Reason {detail.status === "invalid" ? "*" : "(Optional)"}</Label>
    <Input
      value={detail.invalidReason || ''}
      onChange={(e) => updateNondhDetail(detail.id, { invalidReason: e.target.value })}
      placeholder="Enter reason"
    />
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
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, detail.id)
                        }}
                      />
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {detail.docUpload && (
                      <div className="flex items-center gap-2 mt-2">
                        <Eye className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">Document uploaded</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-red-600 h-4 p-0"
                          onClick={() => updateNondhDetail(detail.id, { docUpload: '' })}
                        >
                          Remove
                        </Button>
                      </div>
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

        <div className="flex justify-center pt-6">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}