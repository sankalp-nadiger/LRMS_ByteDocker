import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions
export interface LandRecordData {
  id?: string
  district: string
  taluka: string
  village: string
  area_value: number
  area_unit: string
  s_no_type: string
  s_no: string
  is_promulgation: boolean
  block_no?: string
  re_survey_no?: string
  integrated_712?: string
  status?: string
  current_step?: number,
  integrated712?: string
  integrated712FileName?: string
}

export interface YearSlabData {
  id?: string;
  land_record_id?: string;
  start_year: number;  // Changed to snake_case
  end_year: number;    // Changed to snake_case
  s_no?: string | null;
  s_no_type?: string;
  area_value?: number;
  area_unit?: string;
  integrated_712?: string;
  paiky?: boolean;
  paiky_count?: number;
  ekatrikaran?: boolean;
  ekatrikaran_count?: number;
  paiky_entries?: SlabEntryData[];  // Changed to snake_case
  ekatrikaran_entries?: SlabEntryData[];  // Changed to snake_case
}

export interface Chat {
  id: string;
  created_at: string; // ISO timestamp (UTC)
  from_email: string;
  to_email: string[]; // array of recipients
  message: string;
  land_record_id: string;
  step?: number | null;
}

export interface ActivityLog {
  id: string;
  created_at: string; // ISO timestamp (UTC)
  user_email: string;
  land_record_id: string;
  step?: number | null;
  chat_id?: string | null;
  description: string;
}

export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description?: string;
  created_by_email: string;
  land_record_ids: string[];
}

export interface SlabEntryData {
  id?: string;
  year_slab_id?: string; // Made optional since it might not exist before saving
  entry_type: 'paiky' | 'ekatrikaran';
  s_no: string;
  s_no_type: string;
  area_value: number;
  area_unit: string;
  integrated_712?: string;
}

export interface Panipatrak {
  slabId: string;
  sNo: string;
  year: number;
  farmers: FarmerStrict[];
}

export interface FarmerStrict {
  id: string;
  name: string;
  area: {
    value: number;
    unit: "acre" | "sq_m";
  };
  areaType: "acre_guntha" | "sq_m";
  acre?: number;
  guntha?: number;
  sq_m?: number;
  paikyNumber?: number;
  ekatrikaranNumber?: number;
  type: 'regular' | 'paiky' | 'ekatrikaran';
}

export interface Nondh {
  id?: string;
  number: string;
  affectedSNos: {
    number: string;
    type: "s_no" | "block_no" | "re_survey_no";
  }[];
  nondhDoc: string;
  nondhDocFileName: string;
}

// Area conversion utilities
export function convertToSquareMeters(value: number, unit: "acre" | "guntha" | "sq_m"): number {
  switch (unit) {
    case "acre":
      return value * 4046.86 // 1 acre = 4046.86 sq meters
    case "guntha":
      return value * 101.17 // 1 guntha = 101.17 sq meters
    case "sq_m":
      return value
    default:
      return value
  }
}

export function convertFromSquareMeters(sqMeters: number, targetUnit: "acre" | "guntha" | "sq_m"): number {
  switch (targetUnit) {
    case "acre":
      return sqMeters / 4046.86
    case "guntha":
      return sqMeters / 101.17
    case "sq_m":
      return sqMeters
    default:
      return sqMeters
  }
}

// File upload utility
export async function uploadFile(file: File, bucket: string = "land-documents", customPath?: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop()
    
    // Sanitize filename - remove invalid characters
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    
    const fileName = customPath || `${Date.now()}_${sanitizedFileName}`
    const filePath = `private/${fileName}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    return null
  }
}

// Database operations
export class LandRecordService {
  // Create or update land record
  static async saveLandRecord(data: LandRecordData): Promise<{ data: any, error: any }> {
  try {
    if (data.id) {
      // Update existing record (partial save or step completion)
      const updateData = { ...data }
      delete updateData.id // Remove id from update data
      
      const { data: result, error } = await supabase
        .from('land_records')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          status: data.status || 'drafting', 
          current_step: data.current_step || 1     // Default to step 1 if missing
        })
        .eq('id', data.id)
        .select()
        .single()

      return { data: result, error }
    } else {
      // Create new record with step 1 default
      const insertData = { ...data }
      delete insertData.id // Ensure no id field is included for insert
      
      const { data: result, error } = await supabase
        .from('land_records')
        .insert([{
          ...insertData,
          status: 'initiated',
          current_step: 1
        }])
        .select()
        .single()

      return { data: result, error }
    }
  } catch (error) {
    return { data: null, error }
  }
  }

static async deleteLandRecord(landRecordId: string): Promise<{ data: any, error: any }> {
  try {
    const { data, error } = await supabase
      .from('land_records')
      .delete()
      .eq('id', landRecordId);

    if (error) throw error;

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('Error deleting land record:', error);
    return { 
      data: null, 
      error: {
        message: 'Failed to delete land record',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

static async checkDuplicateLandRecord(data: {
  district: string;
  taluka: string;
  village: string;
  block_no: string;
  re_survey_no?: string;
  excludeId?: string; // For updates - exclude current record
}): Promise<{ data: any | null, error: any }> {
  try {
    let query = supabase
      .from('land_records')
      .select('id, district, taluka, village, block_no, re_survey_no')
      .eq('district', data.district)
      .eq('taluka', data.taluka)
      .eq('village', data.village)
      .eq('block_no', data.block_no);

    // If re_survey_no is provided, check for it too
    if (data.re_survey_no) {
      query = query.eq('re_survey_no', data.re_survey_no);
    }

    // Exclude current record when updating
    if (data.excludeId) {
      query = query.neq('id', data.excludeId);
    }

    const { data: existingRecords, error } = await query;

    if (error) throw error;

    return { 
      data: existingRecords && existingRecords.length > 0 ? existingRecords[0] : null, 
      error: null 
    };
  } catch (error) {
    console.error('Error checking duplicate land record:', error);
    return { 
      data: null, 
      error: {
        message: 'Failed to check for duplicate records',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

static async getLandRecordBasicInfo(landRecordId: string): Promise<{ 
  sNo?: string, 
  blockNo?: string, 
  reSurveyNo?: string 
}> {
  const { data, error } = await supabase
    .from('land_records')
    .select('s_no, block_no, re_survey_no')
    .eq('id', landRecordId)
    .single();

  if (error) {
    console.error('Error fetching land record:', error);
    return {};
  }

  return {
    sNo: data.s_no,
    blockNo: data.block_no,
    reSurveyNo: data.re_survey_no
  };
}
  // Get land record by ID
  static async getLandRecord(id: string): Promise<{ data: any, error: any }> {
    const { data, error } = await supabase
      .from('land_records')
      .select('*')
      .eq('id', id)
      .single()
    
    return { data, error }
  }

  static async updateLandRecord(id: string, updateData: any): Promise<{ data: any, error: any }> {
  const { data, error } = await supabase
    .from('land_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

  // Save year slabs
 static async saveYearSlabs(
  landRecordId: string,
  yearSlabs: YearSlabData[]
): Promise<{ data: any, error: any }> {
  try {
    // Delete existing data
    const { data: existingSlabs, error: fetchError } = await supabase
      .from('year_slabs')
      .select('id')
      .eq('land_record_id', landRecordId);
      
    if (fetchError) throw fetchError;
    
    if (existingSlabs?.length) {
      // First delete entries
      const { error: entryDeleteError } = await supabase
        .from('slab_entries')
        .delete()
        .in('year_slab_id', existingSlabs.map(s => s.id));
        
      if (entryDeleteError) throw entryDeleteError;
      
      // Then delete slabs
      const { error: slabDeleteError } = await supabase
        .from('year_slabs')
        .delete()
        .eq('land_record_id', landRecordId);
        
      if (slabDeleteError) throw slabDeleteError;
    }

    // Insert new slabs and get their IDs
    const { data: insertedSlabs, error: slabError } = await supabase
      .from('year_slabs')
      .insert(yearSlabs.map(slab => ({
        land_record_id: landRecordId,
        start_year: slab.start_year,
        end_year: slab.end_year,
        s_no: slab.s_no,
        s_no_type: slab.s_no_type,
        area_value: slab.area_value,
        area_unit: slab.area_unit,
        integrated_712: slab.integrated_712,
        paiky: slab.paiky || false,
        paiky_count: slab.paiky_count || 0,
        ekatrikaran: slab.ekatrikaran || false,
        ekatrikaran_count: slab.ekatrikaran_count || 0
      })))
      .select('id');

    if (slabError) throw slabError;
    
    if (!insertedSlabs || insertedSlabs.length !== yearSlabs.length) {
      throw new Error("Failed to insert all year slabs");
    }

    // Prepare all entries for batch insert
    const allEntries = [];
    
    for (let i = 0; i < yearSlabs.length; i++) {
      const slab = yearSlabs[i];
      const slabId = insertedSlabs[i].id;
      
      console.log(`Processing slab ${i}:`, {
        paiky: slab.paiky,
        paiky_entries: slab.paiky_entries?.length || 0,
        ekatrikaran: slab.ekatrikaran,
        ekatrikaran_entries: slab.ekatrikaran_entries?.length || 0
      });
      
      // Add paiky entries - FIXED: Check for entries existence, not just flag
      if (slab.paiky_entries && Array.isArray(slab.paiky_entries) && slab.paiky_entries.length > 0) {
        slab.paiky_entries.forEach((entry, entryIndex) => {
          // Only add entries that have some data
          if (entry.s_no || entry.area_value > 0) {
            allEntries.push({
              year_slab_id: slabId,
              entry_type: 'paiky',
              s_no: entry.s_no || '',
              s_no_type: entry.s_no_type || 's_no',
              area_value: entry.area_value || 0,
              area_unit: entry.area_unit || 'sq_m',
              integrated_712: entry.integrated_712 || null
            });
          }
        });
      }
      
      // Add ekatrikaran entries - FIXED: Check for entries existence, not just flag
      if (slab.ekatrikaran_entries && Array.isArray(slab.ekatrikaran_entries) && slab.ekatrikaran_entries.length > 0) {
        slab.ekatrikaran_entries.forEach((entry, entryIndex) => {
          // Only add entries that have some data
          if (entry.s_no || entry.area_value > 0) {
            allEntries.push({
              year_slab_id: slabId,
              entry_type: 'ekatrikaran',
              s_no: entry.s_no || '',
              s_no_type: entry.s_no_type || 's_no',
              area_value: entry.area_value || 0,
              area_unit: entry.area_unit || 'sq_m',
              integrated_712: entry.integrated_712 || null
            });
          }
        });
      }
    }

    console.log(`Total entries to insert: ${allEntries.length}`);
    
    // Insert all entries in a single batch if there are any
    if (allEntries.length > 0) {
      const { error: entryError } = await supabase
        .from('slab_entries')
        .insert(allEntries);
        
      if (entryError) {
        console.error('Entry insert error:', entryError);
        throw entryError;
      }
    }

    return {
      data: {
        slabs: insertedSlabs,
        entriesCount: allEntries.length
      },
      error: null
    };
  } catch (error) {
    console.error('Detailed save error:', error);
    return { data: null, error };
  }
}

static async updateYearSlabs(
  landRecordId: string,
  yearSlabs: YearSlabData[]
): Promise<{ data: any, error: any }> {
  try {
    // 1. Update main slab records
    const { error: slabError } = await supabase
      .from('year_slabs')
      .upsert(yearSlabs.map(slab => ({
        id: slab.id,
        land_record_id: landRecordId,
        start_year: slab.start_year,
        end_year: slab.end_year,
        s_no: slab.s_no,
        s_no_type: slab.s_no_type,
        area_value: slab.area_value,
        area_unit: slab.area_unit,
        integrated_712: slab.integrated_712,
        paiky: slab.paiky,
        paiky_count: slab.paiky_count,
        ekatrikaran: slab.ekatrikaran,
        ekatrikaran_count: slab.ekatrikaran_count
      })));

    if (slabError) throw slabError;

    // 2. Process all slabs and their entries
    for (const slab of yearSlabs) {
      // Get existing entries for this slab from database
      const { data: existingEntries, error: fetchError } = await supabase
        .from('slab_entries')
        .select('*')
        .eq('year_slab_id', slab.id);

      if (fetchError) throw fetchError;

      // Process PAIKY entries
      if (slab.paiky) {
        await this.processEntries(
          slab.id,
          'paiky',
          existingEntries?.filter(e => e.entry_type === 'paiky') || [],
          slab.paiky_entries || []
        );
      }

      // Process EKATRIKARAN entries
      if (slab.ekatrikaran) {
        await this.processEntries(
          slab.id,
          'ekatrikaran',
          existingEntries?.filter(e => e.entry_type === 'ekatrikaran') || [],
          slab.ekatrikaran_entries || []
        );
      }
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('Error updating year slabs:', error);
    return { data: null, error };
  }
}

private static async processEntries(
  slabId: string,
  entryType: 'paiky' | 'ekatrikaran',
  existingEntries: any[],
  currentEntries: any[]
) {
  // 1. Identify entries to delete (exist in DB but not in current entries)
  const currentEntryIds = currentEntries.map(e => e.id).filter(Boolean);
  const entriesToDelete = existingEntries
    .filter(dbEntry => !currentEntryIds.includes(dbEntry.id))
    .map(e => e.id);

  // 2. Delete removed entries
  if (entriesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('slab_entries')
      .delete()
      .in('id', entriesToDelete);
    if (deleteError) throw deleteError;
  }

  // 3. Upsert current entries (only those with IDs - new entries without IDs will be handled separately)
  const entriesToUpsert = currentEntries.filter(entry => entry.id);
  if (entriesToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('slab_entries')
      .upsert(entriesToUpsert.map(entry => ({
        id: entry.id,
        year_slab_id: slabId,
        entry_type: entryType,
        s_no: entry.s_no,
        s_no_type: entry.s_no_type,
        area_value: entry.area_value,
        area_unit: entry.area_unit,
        integrated_712: entry.integrated_712
      })));
    if (upsertError) throw upsertError;
  }

  // 4. Insert new entries (those without IDs)
  const newEntries = currentEntries.filter(entry => !entry.id);
  if (newEntries.length > 0) {
    const { error: insertError } = await supabase
      .from('slab_entries')
      .insert(newEntries.map(entry => ({
        year_slab_id: slabId,
        entry_type: entryType,
        s_no: entry.s_no,
        s_no_type: entry.s_no_type,
        area_value: entry.area_value,
        area_unit: entry.area_unit,
        integrated_712: entry.integrated_712
      })));
    if (insertError) throw insertError;
  }
}

static async getNondhs(landRecordId: string): Promise<{ data: Nondh[] | null, error: any }> {
  console.log(`[getNondhs] Starting fetch for landRecordId: ${landRecordId}`);
  
  try {
    const { data, error } = await supabase
      .from('nondhs')
      .select(`
        id,
        number,
        s_no_type,
        affected_s_nos,
        nondh_doc_url,
        nondh_doc_filename,
        created_at
      `)
      .eq('land_record_id', landRecordId)
      .order('created_at', { ascending: true });

    console.log('[getNondhs] Supabase query completed', { data, error });

    if (error) {
      console.error('[getNondhs] Supabase error:', error);
      throw error;
    }

    if (!data) {
      console.log('[getNondhs] No data returned from query');
      return { data: [], error: null };
    }

    console.log('[getNondhs] Raw data from database:', data);

    const mappedData = data.map(nondh => {
      console.log('[getNondhs] Processing nondh:', nondh.id, {
        rawAffectedSNos: nondh.affected_s_nos,
        type: typeof nondh.affected_s_nos
      });

      // Handle array data
      let affectedSNos: string[] = [];
      if (nondh.affected_s_nos) {
        if (Array.isArray(nondh.affected_s_nos)) {
          affectedSNos = nondh.affected_s_nos;
        } else {
          console.log('[getNondhs] affected_s_nos is not an array, attempting parse');
          try {
            affectedSNos = JSON.parse(nondh.affected_s_nos);
          } catch (parseError) {
            console.error('[getNondhs] Failed to parse affected_s_nos:', parseError);
            affectedSNos = [];
          }
        }
      }

      console.log('[getNondhs] Processed affectedSNos:', affectedSNos);

      return {
        id: nondh.id,
        number: nondh.number.toString(),
        sNoType: nondh.s_no_type || 'S.No.',
        affectedSNos: affectedSNos,
        nondhDoc: nondh.nondh_doc_url || "",
        nondhDocFileName: nondh.nondh_doc_filename || ""
      };
    });

    console.log('[getNondhs] Final mapped data:', mappedData);
    return { data: mappedData, error: null };
  } catch (error) {
    console.error('[getNondhs] Error in getNondhs:', {
      error,
      message: error instanceof Error ? error.message : String(error)
    });
    return { 
      data: null, 
      error: {
        message: 'Failed to load nondh data',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

  // Create or update multiple nondhs (upsert)
static async upsertNondhs(nondhs: any[]): Promise<{ data: any, error: any }> {
  try {

    // Normalize the input data
    const preparedData = nondhs.map(nondh => {
      // Handle both property naming cases (affectedSNos and affected_s_nos)
      const affectedSNos = nondh.affectedSNos || nondh.affected_s_nos || [];

      return {
        id: nondh.id || undefined,
        land_record_id: nondh.land_record_id,
        number: String(nondh.number),
        s_no_type: nondh.sNoType || nondh.s_no_type || 's_no',
        affected_s_nos: Array.isArray(affectedSNos) 
  ? affectedSNos.map(s => {
      if (typeof s === 'object' && s.number) {
        // Keep the full object structure
        return JSON.stringify({ number: s.number, type: s.type });
      } else if (typeof s === 'string') {
        try {
          // If it's already a JSON string, keep it as is
          const parsed = JSON.parse(s);
          return JSON.stringify({ number: parsed.number, type: parsed.type });
        } catch {
          // If it's a plain string number, wrap it as s_no type
          return JSON.stringify({ number: s, type: 's_no' });
        }
      } else {
        // Fallback for plain string numbers
        return JSON.stringify({ number: s, type: 's_no' });
      }
    }).filter(Boolean)
  : [],
        nondh_doc_url: nondh.nondhDoc || nondh.nondh_doc_url || null,
        nondh_doc_filename: nondh.nondhDocFileName || nondh.nondh_doc_filename || null
      };
    });


    const { data, error } = await supabase
      .from('nondhs')
      .upsert(preparedData)
      .select();

    if (error) {
      console.error('[upsertNondhs] Supabase error:', error);
      throw error;
    }

   return { 
  data: data?.map(d => ({
    id: d.id,
    number: d.number,
    sNoType: d.s_no_type,
    affectedSNos: (d.affected_s_nos || []).map(item => {
      // The data comes back as JSON strings from the database
      if (typeof item === 'string') {
        return item; // Keep as JSON string
      }
      return JSON.stringify(item); // Convert object to JSON string
    }),
    nondhDoc: d.nondh_doc_url || "",
    nondhDocFileName: d.nondh_doc_filename || ""
  })), 
  error: null 
};
  } catch (error) {
    console.error('[upsertNondhs] Error:', error);
    return { 
      data: null, 
      error: {
        message: 'Failed to save nondh data',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
  // Delete multiple nondhs
  static async deleteNondhs(nondhIds: string[]): Promise<{ data: any, error: any }> {
  try {
    if (!Array.isArray(nondhIds)) {
      throw new Error('Input must be an array of nondh IDs');
    }

    if (nondhIds.length === 0) {
      return { data: null, error: null }; // Nothing to delete
    }

    const { data, error } = await supabase
      .from('nondhs')
      .delete()
      .in('id', nondhIds);

    if (error) throw error;

    return { data: { count: data?.length || 0 }, error: null };
  } catch (error) {
    console.error('Error in deleteNondhs:', error);
    return { 
      data: null, 
      error: {
        message: 'Failed to delete nondhs',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

static async getNondhsforDetails(landRecordId: string) {
  console.log(`[SERVICE] getNondhsforDetails called with landRecordId: ${landRecordId}`);
  
  try {
    const result = await supabase
      .from('nondhs')
      .select('*')
      .eq('land_record_id', landRecordId)
      .order('number');
    
    console.log(`[SERVICE] getNondhsforDetails result:`, {
      data: result.data,
      error: result.error,
      count: result.data?.length || 0
    });
    
    if (result.error) {
      console.error(`[SERVICE] getNondhsforDetails error:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[SERVICE] getNondhsforDetails exception:`, error);
    throw error;
  }
}

  // Save nondhs
  static async saveNondhs(landRecordId: string, nondhs: Nondh[]): Promise<{ data: any, error: any }> {
  try {
    // First, delete existing nondhs for this land record
    await supabase
      .from('nondhs')
      .delete()
      .eq('land_record_id', landRecordId)

    // Prepare data for insertion
    const nondhsToInsert = nondhs.map(nondh => ({
      land_record_id: landRecordId,
      number: nondh.number,
      affected_s_nos: nondh.affectedSNos.map(s => s.number), // Just the numbers as text[]
      affected_s_no_types: nondh.affectedSNos.map(s => s.type), // Just the types as text[]
      nondh_doc_url: nondh.nondhDoc,
      nondh_doc_filename: nondh.nondhDocFileName || null
    }))

    // Insert new nondhs
    const { data, error } = await supabase
      .from('nondhs')
      .insert(nondhsToInsert)
      .select()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

  // Get all data for a land record
static async getCompleteRecord(landRecordId: string) {
  try {
    console.log('getCompleteRecord called for:', landRecordId);
    
    const { data: landRecord, error: landError } = await supabase
      .from('land_records')
      .select('*')
      .eq('id', landRecordId)
      .single();

    if (landError) throw landError;

    const { data: yearSlabs, error: slabsError } = await this.getYearSlabs(landRecordId);
    if (slabsError) throw slabsError;

    // Get panipatraks with their farmers
    console.log('About to call getPanipatraks...');
    const { data: panipatraks, error: paniError } = await this.getPanipatraks(landRecordId);
    console.log('getPanipatraks returned:', panipatraks);
    if (paniError) throw paniError;

    const result = {
      data: {
        landRecord,
        yearSlabs,
        panipatraks: panipatraks || [] // Ensure we always return an array
      },
      error: null
    };
    
    console.log('getCompleteRecord final result:', result);
    return result;
  } catch (error) {
    console.error('Error fetching complete record:', error);
    return { data: null, error };
  }
}
 
  // getYearSlabs
static async getYearSlabs(landRecordId: string): Promise<{ data: YearSlabData[] | null, error: any }> {
  try {
    const { data: slabs, error: slabError } = await supabase
      .from('year_slabs')
      .select('*')
      .eq('land_record_id', landRecordId)
      .order('start_year', { ascending: false }); // Changed to descending order

    if (slabError) throw slabError;
    if (!slabs || slabs.length === 0) return { data: null, error: null };

    const { data: entries, error: entryError } = await supabase
      .from('slab_entries')
      .select('*')
      .in('year_slab_id', slabs.map(s => s.id));

    if (entryError) throw entryError;

    return { 
      data: slabs.map(slab => ({
        id: slab.id,
        startYear: slab.start_year,
        endYear: slab.end_year,
        sNo: slab.s_no,
        sNoType: slab.s_no_type,
        area: {
          value: slab.area_value,
          unit: slab.area_unit
        },
        integrated712: slab.integrated_712,
        paiky: slab.paiky,
        paikyCount: slab.paiky_count,
        ekatrikaran: slab.ekatrikaran,
        ekatrikaranCount: slab.ekatrikaran_count,
        paikyEntries: entries
          ?.filter(e => e.year_slab_id === slab.id && e.entry_type === 'paiky')
          .map(e => ({
            sNo: e.s_no,
            sNoType: e.s_no_type,
            area: {
              value: e.area_value,
              unit: e.area_unit
            },
            integrated712: e.integrated_712
          })) || [],
        ekatrikaranEntries: entries
          ?.filter(e => e.year_slab_id === slab.id && e.entry_type === 'ekatrikaran')
          .map(e => ({
            sNo: e.s_no,
            sNoType: e.s_no_type,
            area: {
              value: e.area_value,
              unit: e.area_unit
            },
            integrated712: e.integrated_712
          })) || []
      })),
      error: null
    };
  } catch (error) {
    console.error('Error fetching year slabs:', error);
    return { data: null, error };
  }
}
static async savePanipatraks(
  landRecordId: string,
  panipatraks: Panipatrak[]
) {
  try {
    console.log("Received panipatraks:", panipatraks.length);
    
    // First delete existing records
    const { data: existing, error: fetchError } = await supabase
      .from('panipatraks')
      .select('id')
      .eq('land_record_id', landRecordId);

    if (fetchError) throw fetchError;

    if (existing?.length) {
      // Delete farmers first
      const { error: deleteFarmersError } = await supabase
        .from('panipatrak_farmers')
        .delete()
        .in('panipatrak_id', existing.map(p => p.id));

      if (deleteFarmersError) throw deleteFarmersError;

      // Then delete panipatraks
      const { error: deletePanipatraksError } = await supabase
        .from('panipatraks')
        .delete()
        .eq('land_record_id', landRecordId);

      if (deletePanipatraksError) throw deletePanipatraksError;
    }

    // Insert ALL new panipatraks
    const { data: insertedPanipatraks, error: insertError } = await supabase
      .from('panipatraks')
      .insert(panipatraks.map(p => ({
        land_record_id: landRecordId,
        year_slab_id: p.slabId,
        s_no: p.sNo,
        year: p.year
      })))
      .select('id');

    if (insertError) throw insertError;

    // Insert ALL farmers
    const farmersToInsert = panipatraks.flatMap((p, i) => 
      p.farmers.map(f => ({
        panipatrak_id: insertedPanipatraks[i]?.id,
        name: f.name,
        area_value: f.area.value,
        area_unit: f.area.unit,
        paiky_number: f.paikyNumber,
        ekatrikaran_number: f.ekatrikaranNumber,
        farmer_type: f.type
      }))
    );

    if (farmersToInsert.length) {
      const { error: farmerError } = await supabase
        .from('panipatrak_farmers')
        .insert(farmersToInsert);
      
      if (farmerError) throw farmerError;
    }

    return { data: insertedPanipatraks, error: null };
  } catch (error) {
    console.error("Full save error:", error);
    return { data: null, error };
  }
}

static async getPanipatraks(landRecordId: string) {
  try {
    console.log('[DEBUG] Starting getPanipatraks for:', landRecordId);
    
    const { data: panipatraks, error: paniError } = await supabase
      .from('panipatraks')
      .select('id, year_slab_id, s_no, year')
      .eq('land_record_id', landRecordId)
      .order('year', { ascending: true });

    console.log('[DEBUG] Panipatraks query result:', { data: panipatraks, error: paniError });
    
    if (paniError) throw paniError;
    if (!panipatraks) return { data: [], error: null };

    const { data: farmers, error: farmersError } = await supabase
      .from('panipatrak_farmers')
      .select('*')
      .in('panipatrak_id', panipatraks.map(p => p.id));

    console.log('[DEBUG] Farmers query result:', { data: farmers, error: farmersError });
    
    if (farmersError) throw farmersError;
    
    console.log('Found farmers:', farmers);

    // Group farmers by their panipatrak_id
    const farmersByPanipatrak = (farmers || []).reduce((acc, farmer) => {
      if (!acc[farmer.panipatrak_id]) {
        acc[farmer.panipatrak_id] = [];
      }
      acc[farmer.panipatrak_id].push(farmer);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('Farmers grouped by panipatrak:', farmersByPanipatrak);

    // Map panipatraks with their farmers
    const result = panipatraks.map(panipatrak => {
      const panipatrakFarmers = farmersByPanipatrak[panipatrak.id] || [];
      
      console.log(`Processing panipatrak ${panipatrak.id}, found ${panipatrakFarmers.length} farmers`);
      
      return {
        slabId: panipatrak.year_slab_id,
        sNo: panipatrak.s_no,
        year: panipatrak.year,
        farmers: panipatrakFarmers.map(f => {
          // Deduce farmer type based on numbers
          let type: 'regular' | 'paiky' | 'ekatrikaran' = 'regular';
          if (f.paiky_number && f.paiky_number > 0) {
            type = 'paiky';
          } else if (f.ekatrikaran_number && f.ekatrikaran_number > 0) {
            type = 'ekatrikaran';
          }
          
          console.log(`Farmer ${f.name}: paiky_number=${f.paiky_number}, ekatrikaran_number=${f.ekatrikaran_number}, deduced type=${type}`);
          
          return {
            id: f.id,
            name: f.name,
            area: {
              value: f.area_value,
              unit: f.area_unit as 'acre' | 'sq_m'
            },
            type,
            paikyNumber: f.paiky_number,
            ekatrikaranNumber: f.ekatrikaran_number
          };
        })
      };
    });

    console.log('Final result:', result);
    
    return { data: result, error: null };
  } catch (error) {
    console.error('Error fetching panipatraks:', error);
    return { data: null, error };
  }
}

static async updatePanipatraks(
  landRecordId: string,
  panipatraks: Panipatrak[]
): Promise<{ data: any, error: any }> {
  try {
    console.log('[DEBUG] updatePanipatraks called with:', {
      landRecordId,
      panipatraks: JSON.stringify(panipatraks, null, 2)
    });

    if (!landRecordId || !panipatraks?.length) {
      throw new Error('Invalid input: landRecordId and panipatraks are required');
    }

    // Convert to JSON format for the procedure
    const panipatraksJson = panipatraks.map(pani => ({
      slabId: pani.slabId,
      sNo: pani.sNo,
      year: pani.year,
      farmers: pani.farmers.map(farmer => ({
        name: farmer.name,
        area: {
          value: farmer.area.value,
          unit: farmer.area.unit
        },
        type: farmer.type,
        paikyNumber: farmer.paikyNumber,
        ekatrikaranNumber: farmer.ekatrikaranNumber
      }))
    }));

    console.log('[DEBUG] Calling stored procedure with:', panipatraksJson);

    const { data, error } = await supabase.rpc('update_panipatraks', {
  p_land_record_id: landRecordId,
  panipatraks_data: panipatraksJson
});

console.log('[DEBUG] Raw Supabase response:', { data, error });

// Check if the procedure returned an error in the data
if (data?.error) {
  throw new Error(data.error);
}
    return { data, error: null };
  } catch (error) {
    console.error('[ERROR] updatePanipatraks failed:', error);
    return { data: null, error };
  }
}

  // Get nondh details with owner relations
  static async getNondhDetailsWithRelations(landRecordId: string) {
    console.log(`[SERVICE] getNondhDetailsWithRelations called with landRecordId: ${landRecordId}`);
    
    try {
      // First get all nondhs for this land record
      const { data: nondhs, error: nondhError } = await supabase
        .from('nondhs')
        .select('id')
        .eq('land_record_id', landRecordId);

      if (nondhError) throw nondhError;
      if (!nondhs || nondhs.length === 0) return { data: [], error: null };

      // Extract valid UUIDs
      const nondhIds = nondhs.map(n => n.id).filter(id => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      // Then get details for these nondh IDs
      const { data, error } = await supabase
        .from('nondh_details')
        .select(`
          *,
          owner_relations: nondh_owner_relations!nondh_detail_id(*)
        `)
        .in('nondh_id', nondhIds);

      return { data, error };
    } catch (error) {
      console.error('[SERVICE] Error in getNondhDetailsWithRelations:', error);
      return { data: null, error };
    }
  }

  static async deleteNondhOwnerRelation(relationId: string) {
  try {
    console.log('Deleting nondh owner relation with ID:', relationId);
    const { data, error } = await supabase
      .from('nondh_owner_relations')
      .delete()
      .eq('id', relationId)
      .select()
    
    if (error) {
      console.error('Error deleting nondh owner relation:', error)
      return { data: null, error }
    }
    
    return { data, error: null }
  } catch (error) {
    console.error('Exception deleting nondh owner relation:', error)
    return { data: null, error }
  }
}

static async get712Documents(landRecordId: string) {
  try {
    const docs = [];
    
    // Get main record document
    const { data: recordData } = await supabase
      .from('land_records')
      .select('integrated_712')
      .eq('id', landRecordId)
      .single();

    // Get year slab documents
    const { data: slabs } = await supabase
      .from('year_slabs')
      .select('integrated_712, start_year, end_year, s_no, area_value, area_unit')
      .eq('land_record_id', landRecordId)
      .not('integrated_712', 'is', null);

    slabs?.forEach(slab => {
      if (slab.integrated_712 && slab.integrated_712.trim() !== '') {
        docs.push({
          type: "Main Slab",
          url: slab.integrated_712,
          year: `${slab.start_year}-${slab.end_year}`,
          s_no: slab.s_no || 'Main',
          area: { value: slab.area_value, unit: slab.area_unit }
        });
      }
    });

    // Get slab entry documents
    const { data: entries } = await supabase
      .from('slab_entries')
      .select(`
        integrated_712,
        s_no,
        area_value,
        area_unit,
        entry_type,
        year_slabs!inner(start_year, end_year, land_record_id)
      `)
      .eq('year_slabs.land_record_id', landRecordId)
      .not('integrated_712', 'is', null);
    
    // Counter objects for each entry type
    const typeCounters: { [key: string]: number } = {};
    
    entries?.forEach(entry => {
      if (entry.integrated_712 && entry.integrated_712.trim() !== '') {
        const entryType = entry.entry_type;
        
        // Initialize counter for this type if it doesn't exist
        if (!typeCounters[entryType]) {
          typeCounters[entryType] = 0;
        }
        
        // Increment counter
        typeCounters[entryType]++;
        
        // Format type with counter for paiky and ekatrikaran
        let displayType = entryType;
        if (entryType === 'paiky' || entryType === 'ekatrikaran') {
          displayType = `${entryType} ${typeCounters[entryType]}`;
        }
        
        docs.push({
          type: displayType,
          url: entry.integrated_712,
          year: `${entry.year_slabs.start_year}-${entry.year_slabs.end_year}`,
          s_no: entry.s_no,
          area: { value: entry.area_value, unit: entry.area_unit }
        });
      }
    });

    return { data: docs, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

  // Create a new nondh detail
  static async createNondhDetail(data: any) {
    console.log('Creating nondh detail with data:', data);
  // Remove id if it exists - let database generate it
  const { id, ...insertData } = data;
  
  return await supabase
    .from('nondh_details')
    .insert(insertData)
    .select()
    .single();
}

  // Update a nondh detail
  static async updateNondhDetail(id: string, updates: any) {
  const { data, error } = await supabase
    .from('nondh_details')
    .update(updates)
    .eq('id', id)
    .select();  // Remove .single() to handle multiple cases

  if (error) throw error;
  
  // Return the first updated record or null if none were updated
  return { data: data && data.length > 0 ? data[0] : null, error: null };
}

  // Create a new owner relation
  static async createNondhOwnerRelation(data: any) {
    console.log('Creating nondh owner relation with data:', data);
    const { id, ...insertData } = data;
    return await supabase
      .from('nondh_owner_relations')
      .insert(insertData)
      .select()
      .single();
  }

  // Update an owner relation
  static async updateNondhOwnerRelation(id: string, updates: any) {
    return await supabase
      .from('nondh_owner_relations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  }
}

export async function createChat({ from_email, to_email, message, land_record_id, step }) {
  const { data, error } = await supabase
    .from("chats")
    .insert([{ from_email, to_email, message, land_record_id, step }])
    .select("*")
    .single();

  if (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
  return data;
}

export async function getChatsByLandRecord(land_record_id) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("land_record_id", land_record_id)
    .order("created_at", { ascending: true });

    console.log("Fetched chats:", data);
  if (error) {
    console.error("Error fetching chats:", error);
    throw error;
  }
  return data;
}

export async function createActivityLog({ user_email, land_record_id, step, chat_id, description }) {
  const { data, error } = await supabase
    .from("activity_logs")
    .insert([{ user_email, land_record_id, step, chat_id, description }])
    .select("*")
    .single();

  if (error) {
    console.error("Error creating activity log:", error);
    throw error;
  }
  return data;
}

export async function getActivityLogsByLandRecord(land_record_id: string) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("land_record_id", land_record_id)
    .order("created_at", { ascending: false });

    console.log("Fetched activity logs:", data);
  if (error) {
    console.error("Error fetching activity logs:", error);
    throw error;
  }

  // Handle missing or null data safely
  return (data || []).map(log => ({
    id: log.id || '',
    created_at: log.created_at || new Date().toISOString(),
    user_email: log.user_email || 'unknown',
    land_record_id: log.land_record_id || land_record_id,
    step: log.step !== null && log.step !== undefined ? log.step : null,
    chat_id: log.chat_id || null,
    description: log.description || 'No description'
  }));
}

export async function markChatAsRead(chatId: string, userEmail: string) {
  // Fetch current read_by array
  const { data: chat, error: fetchError } = await supabase
    .from("chats")
    .select("read_by")
    .eq("id", chatId)
    .single();

  if (fetchError) {
    console.error("Error fetching chat:", fetchError);
    throw fetchError;
  }

  // Avoid duplicate entries
  const updatedReadBy = chat?.read_by?.includes(userEmail)
    ? chat.read_by
    : [...(chat?.read_by || []), userEmail];

  // Update the chat record
  const { data, error: updateError } = await supabase
    .from("chats")
    .update({ read_by: updatedReadBy })
    .eq("id", chatId)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating read_by:", updateError);
    throw updateError;
  }

  return data;
}

/**
 * Fetches all chat messages.
 * Optionally filters by land_record_id, step, or user_email (sender or recipient).
 */
export async function getAllChats({
  land_record_id,
  step,
  user_email,
}: {
  land_record_id?: string;
  step?: number;
  user_email?: string;
}) {
  let query = supabase.from("chats").select("*");

  // Optional filters
  if (land_record_id) query = query.eq("land_record_id", land_record_id);
  if (step) query = query.eq("step", step);

  // Filter by participant (either sender or recipient)
  if (user_email) {
    query = query.or(
      `from_email.eq.${user_email},to_email.cs.{${user_email}}`
    );
  }

  // Order by creation time (newest last)
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching chats:", error);
    throw error;
  }

  return data;
}

export const getAllProjects = async (supabase) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getProjectById = async (supabase, id) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};

export const updateProject = async (supabase, id, updates) => {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const addLandRecordToProject = async (supabase, projectId, landRecordId) => {
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('land_record_ids')
    .eq('id', projectId)
    .single();

  if (fetchError) throw fetchError;

  const updatedIds = [...new Set([...(project.land_record_ids || []), landRecordId])];

  const { data, error } = await supabase
    .from('projects')
    .update({
      land_record_ids: updatedIds,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createProject = async (supabase, projectData) => {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      name: projectData.name,
      description: projectData.description || null,
      created_by_email: projectData.created_by_email,
      land_record_ids: projectData.land_record_ids || []
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Owner Discussions

export const getOwnerDiscussionsByLandRecord = async (landRecordId: string): Promise<OwnerDiscussion[]> => {
  const { data, error } = await supabase
    .from('owner_discussions')
    .select('*')
    .eq('land_record_id', landRecordId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createOwnerDiscussion = async (discussion: Omit<OwnerDiscussion, 'id' | 'created_at'>): Promise<OwnerDiscussion> => {
  const { data, error } = await supabase
    .from('owner_discussions')
    .insert([discussion])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Land Record Status Update
export const updateLandRecordStatus = async (landRecordId: string, status: string): Promise<void> => {
  const { error } = await supabase
    .from('land_records')
    .update({ status })
    .eq('id', landRecordId);

  if (error) throw error;
};

// Add this to your lib/supabase.ts file
export async function getLandRecordById(id: string) {
  const { data, error } = await supabase
    .from('land_records')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching land record:', error);
    throw error;
  }

  return data;
}