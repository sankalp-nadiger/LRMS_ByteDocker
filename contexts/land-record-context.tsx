"use client"
import { useEffect } from "react"
import { LandRecordService } from "@/lib/supabase"
import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface AreaInput {
  value: number
  unit: "acre_guntha" | "sq_m"
  acres?: number
  gunthas?: number
  square_meters?: number
}

export interface LandBasicInfo {
  district: string
  taluka: string
  village: string
  area: AreaInput
  sNoType: "s_no" | "block_no" | "re_survey_no"
  sNo: string
  isPromulgation: boolean
  blockNo: string
  reSurveyNo: string
  integrated712: string
  integrated712FileName: string
}

export interface SlabEntry {
  sNo: string
  yearSlabId: string
  sNoType: "s_no" | "block_no" | "re_survey_no"
  area: { value: number; unit: "acre" | "guntha" | "sq_m" }
  integrated712?: string
}

export interface YearSlab {
  id: string
  startYear: number
  endYear: number
  sNo: string
  sNoType: "s_no" | "block_no" | "re_survey_no"
  area: { value: number; unit: "acre" | "guntha" | "sq_m" }
  integrated712?: string
  paiky: boolean
  paikyCount: number
  paikyEntries: SlabEntry[]
  ekatrikaran: boolean
  ekatrikaranCount: number
  ekatrikaranEntries: SlabEntry[]
}

export interface Farmer {
  id: string
  name: string
  area: AreaInput
  type: 'regular' | 'paiky' | 'ekatrikaran'
  paikyNumber?: number
  ekatrikaranNumber?: number
}

export interface Panipatrak {
  slabId: string
  sNo: string
  year: number
  farmers: Farmer[]
}

export interface Nondh {
  id: string
  number: string
  sNoType: "s_no" | "block_no" | "re_survey_no"
  affectedSNos: Array<{ number: string; type: "s_no" | "block_no" | "re_survey_no" }>
  nondhDoc?: string
  nondhDocFileName?: string
}

export interface NondhDetail {
  id: string
  nondhId: string
  sNo: string
  type: string
  reason?: string
  vigat?: string
  status: "valid" | "invalid" | "nullified"
  invalidReason?: string
  oldOwner?: string
  showInOutput: boolean
  hasDocuments: boolean
  docUpload?: string
  date?: string
  hukamDate?: string
  hukamType?: string
  hukamStatus?: "valid" | "invalid" | "nullified"
  hukamInvalidReason?: string
  affectedNondhNo?: string
  ganot?: string
  tenure?: string
  restrainingOrder?: 'yes' | 'no'
  ownerTransfers?: Array<{
    id: string
    oldOwner: string
    newOwners: string[]
    equalDistribution: boolean
    oldOwnerArea: { value: number; unit: AreaUnit }
    newOwnerAreas: Array<{ ownerId: string; area: { value: number; unit: AreaUnit } }>
  }>
  sdDate?: string
  amount?: number
  ownerRelations: Array<{
    id: string
    ownerName: string
    sNo: string
    area: { value: number; unit: AreaUnit }
    isValid: boolean
      surveyNumber?: string
  surveyNumberType?: string
  }>
  dbId?: string
}

export type AreaUnit = "acre" | "guntha" | "sq_m";

export interface LocalFormData {
  [key: number]: {
    landBasicInfo?: LandBasicInfo
    yearSlabs?: YearSlab[]
    panipatraks?: Panipatrak[]
    nondhs?: Nondh[]
    nondhDetails?: NondhDetail[]
    // Add the new fields for step 5 (NondhDetails component state)
    ownerTransfers?: Record<string, Array<{
      id: string
      oldOwner: string
      newOwners: string[]
      equalDistribution: boolean
      oldOwnerArea: { value: number; unit: string }
      newOwnerAreas: Array<{ ownerId: string; area: { value: number; unit: string } }>
    }>>
    transferEqualDistribution?: Record<string, Record<string, boolean>>
    affectedNondhDetails?: Record<string, Array<{
      id: string
      nondhNo: string
      status: "valid" | "invalid" | "nullified"
      invalidReason?: string
    }>>
  }
}

interface LandRecordContextType {
  currentStep: number
  mode: 'add' | 'view' | 'edit'
  recordId?: string
  setCurrentStep: (step: number) => void
  canProceedToStep: (step: number) => boolean
  landBasicInfo: LandBasicInfo | null
  setLandBasicInfo: (info: LandBasicInfo) => void
  yearSlabs: YearSlab[]
  setYearSlabs: (slabs: YearSlab[]) => void
  panipatraks: Panipatrak[]
  setPanipatraks: (panipatraks: Panipatrak[]) => void
  nondhs: Nondh[]
  setNondhs: (nondhs: Nondh[]) => void
  nondhDetails: NondhDetail[]
  setNondhDetails: (details: NondhDetail[]) => void
  hasUnsavedChanges: Record<number, boolean>
  setHasUnsavedChanges: (step: number, value: boolean) => void
  resetUnsavedChanges: () => void
  formData: LocalFormData
  setFormData: (data: LocalFormData | ((prev: LocalFormData) => LocalFormData)) => void
  updateFormData: (step: number, data: Partial<LocalFormData[number]>) => void
  refreshStatus: () => void
    statusRefreshTrigger: number 
}

const LandRecordContext = createContext<LandRecordContextType | undefined>(undefined)

export function LandRecordProvider({ 
  children,
  mode = 'add',
  recordId
}: { 
  children: ReactNode;
  mode?: 'add' | 'view' | 'edit';
  recordId?: string;
}) {
  const [isLoading, setIsLoading] = useState(mode !== 'add');
  
  // Add useEffect to load data if in view/edit mode
useEffect(() => {
  if (mode !== 'add' && recordId) {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await LandRecordService.getCompleteRecord(recordId);
        if (error) throw error;
        
        // Set all data
        if (data.landRecord) {
          setLandBasicInfo({
            district: data.landRecord.district,
            taluka: data.landRecord.taluka,
            village: data.landRecord.village,
            area: {
              value: data.landRecord.area_value,
              unit: data.landRecord.area_unit as "acre" | "guntha" | "sq_m"
            },
            sNoType: data.landRecord.s_no_type as "s_no" | "block_no" | "re_survey_no",
            sNo: data.landRecord.s_no,
            isPromulgation: data.landRecord.is_promulgation,
            blockNo: data.landRecord.block_no,
            reSurveyNo: data.landRecord.re_survey_no,
            integrated712: data.landRecord.integrated_712,
            integrated712FileName: data.landRecord.integrated712FileName
          });
        }
        
        if (data.yearSlabs) {
          setYearSlabs(data.yearSlabs);
        }
        
        if (data.panipatraks) {
          setPanipatraks(data.panipatraks);
        }
      } catch (error) {
        console.error('Error loading record:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }
}, [mode, recordId]);
  const [currentStep, setCurrentStep] = useState(1)
  const [landBasicInfo, setLandBasicInfo] = useState<LandBasicInfo | null>(null)
  const [yearSlabs, setYearSlabs] = useState<YearSlab[]>([])
  const [yearSlabsVersion, setYearSlabsVersion] = useState(0);
  const [panipatraks, setPanipatraks] = useState<Panipatrak[]>([])
  const [nondhs, setNondhs] = useState<Nondh[]>([])
  const [nondhDetails, setNondhDetails] = useState<NondhDetail[]>([])
  const [formData, setFormDataState] = useState<LocalFormData>({})
  const [statusRefreshTrigger, setStatusRefreshTrigger] = useState(0)
  const [hasUnsavedChanges, setRawHasUnsavedChanges] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false
  })

  const setHasUnsavedChanges = useCallback((step: number, value: boolean) => {
    setRawHasUnsavedChanges(prev => {
      // Only update if the value has actually changed
      if (prev[step] !== value) {
        return {
          ...prev,
          [step]: value
        }
      }
      return prev
    })
  }, [])

  const setFormData = useCallback((
    data: LocalFormData | ((prev: LocalFormData) => LocalFormData)
  ) => {
    if (typeof data === 'function') {
      setFormDataState(data)
    } else {
      setFormDataState(data)
    }
  }, [])

  const updateFormData = useCallback((step: number, data: Partial<LocalFormData[number]>) => {
  setFormDataState(prev => {
    const prevStepData = prev[step] || {};
    const newStepData = {
      ...prevStepData,
      ...data
    };
    
    // Only proceed if there are actual changes
    const hasChanged = Object.keys(data).some(key => {
      return JSON.stringify(prevStepData[key]) !== JSON.stringify(data[key]);
    });
    
    if (hasChanged) {
      setHasUnsavedChanges(step, true);
    }
    
    return {
      ...prev,
      [step]: newStepData
    };
  });
}, [setHasUnsavedChanges]);

  const resetUnsavedChanges = useCallback(() => {
    setRawHasUnsavedChanges({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false
    })
  }, [])

  const refreshStatus = useCallback(() => {
  setStatusRefreshTrigger(prev => prev + 1)
}, [])

  const canProceedToStep = useCallback((step: number) => {
    if (step <= currentStep) return true
    if (step === 2 && formData[1]?.landBasicInfo) return true
    if (step === 3 && formData[2]?.yearSlabs?.length) return true
    if (step === 4 && formData[3]?.panipatraks?.length) return true
    if (step === 5 && formData[4]?.nondhs?.length) return true
    if (step === 6 && formData[5]?.nondhDetails?.length) return true
    return false
  }, [currentStep, formData])

  return (
    <LandRecordContext.Provider
      value={{
        currentStep,
        mode,
        recordId,
        setCurrentStep,
        canProceedToStep,
        landBasicInfo,
        setLandBasicInfo,
        yearSlabs,
        setYearSlabs,
        panipatraks,
        setPanipatraks,
        nondhs,
        setNondhs,
        nondhDetails,
        setNondhDetails,
        formData,
        setFormData,
        updateFormData,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        resetUnsavedChanges,
        refreshStatus,  // ADD THIS LINE
      statusRefreshTrigger
      }}
    >
      {children}
    </LandRecordContext.Provider>
  )
}

export function useLandRecord() {
  const context = useContext(LandRecordContext)
  if (context === undefined) {
    throw new Error("useLandRecord must be used within a LandRecordProvider")
  }
  return context
}