-- Create main land records table
CREATE TABLE land_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Basic Info
    district VARCHAR(255) NOT NULL,
    taluka VARCHAR(255) NOT NULL,
    village VARCHAR(255) NOT NULL,
    area_value DECIMAL(10,4) NOT NULL,
    area_unit VARCHAR(10) NOT NULL CHECK (area_unit IN ('acre', 'guntha', 'sq_m')),
    s_no_type VARCHAR(20) NOT NULL CHECK (s_no_type IN ('s_no', 'block_no', 're_survey_no')),
    s_no VARCHAR(255) NOT NULL,
    is_promulgation BOOLEAN DEFAULT false,
    block_no VARCHAR(255),
    re_survey_no VARCHAR(255),
    integrated_712 VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'initiated' 
        CHECK (status IN ('initiated', 'drafting', 'review', 'query', 'review2', 'offer', 'completed')),
    current_step INTEGER DEFAULT 1,

    -- Comments
    comments TEXT
);

-- Create year slabs table
CREATE TABLE year_slabs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    s_no VARCHAR(255),
    s_no_type VARCHAR(20),  -- Added to track type (survey_no/block_no/re_survey_no)
    area_value NUMERIC,
    area_unit VARCHAR(10) ,  -- 'acre', 'guntha', or 'sq_m'
    integrated_712 VARCHAR(255),
    paiky BOOLEAN DEFAULT false,
    ekatrikaran BOOLEAN DEFAULT false,
    paiky_count INTEGER DEFAULT 0,
    ekatrikaran_count INTEGER DEFAULT 0
);

-- Create slab entries table
CREATE TABLE slab_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year_slab_id UUID REFERENCES year_slabs(id) ON DELETE CASCADE,
    entry_type VARCHAR(20) NOT NULL,  -- 'paiky' or 'ekatrikaran'
    s_no VARCHAR(255) NOT NULL,
    s_no_type VARCHAR(20) NOT NULL,
    area_value NUMERIC NOT NULL,
    area_unit VARCHAR(10) NOT NULL,
    integrated_712 VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create farmers table
CREATE TABLE farmers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name VARCHAR(255) NOT NULL,
    area_value DECIMAL(10,4) NOT NULL,
    area_unit VARCHAR(10) NOT NULL CHECK (area_unit IN ('acre', 'guntha', 'sq_m'))
);

-- Create panipatrak table
CREATE TABLE panipatraks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
    year_slab_id UUID REFERENCES year_slabs(id) ON DELETE CASCADE,
    s_no VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create panipatrak farmers junction table
CREATE TABLE panipatrak_farmers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    panipatrak_id UUID REFERENCES panipatraks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    area_value NUMERIC NOT NULL,
    area_unit VARCHAR(10) NOT NULL,
    farmer_type VARCHAR(20) NOT NULL CHECK (farmer_type IN ('regular', 'paiky', 'ekatrikaran')),
    paiky_number INTEGER,
    ekatrikaran_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create nondhs table
CREATE TABLE nondhs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    s_no_type VARCHAR(20) NOT NULL CHECK (s_no_type IN ('s_no', 'block_no', 're_survey_no')),
    affected_s_nos TEXT[], -- Array of strings
    nondh_doc_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create nondh details table
CREATE TABLE nondh_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nondh_id UUID REFERENCES nondhs(id) ON DELETE CASCADE,
    s_no VARCHAR(255),
    type VARCHAR(255) NOT NULL,
    reason TEXT,
    date DATE,
    hukam_date DATE,
    hukam_type VARCHAR(50) DEFAULT 'SSRD',
    vigat TEXT,
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'invalid', 'nullified')),
    invalid_reason TEXT,
    old_owner VARCHAR(255),
    show_in_output BOOLEAN DEFAULT true,
    has_documents BOOLEAN DEFAULT false,
    doc_upload_url TEXT,
    hukam_status VARCHAR(20) DEFAULT 'valid' CHECK (hukam_status IN ('valid', 'invalid', 'nullified')),
    hukam_invalid_reason TEXT,
    affected_nondh_details JSONB,
    ganot VARCHAR(20),
    sd_date DATE,
    tenure VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE nondh_owner_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nondh_detail_id UUID REFERENCES nondh_details(id) ON DELETE CASCADE,
    owner_name VARCHAR(255) NOT NULL,
    s_no VARCHAR(255),
    survey_number VARCHAR(255),
    survey_number_type VARCHAR(50) CHECK (survey_number_type IN ('s_no', 'block_no', 're_survey_no')),
    acres NUMERIC,
    gunthas NUMERIC,
    square_meters NUMERIC,
    area_unit VARCHAR(10) NOT NULL CHECK (area_unit IN ('acre_guntha', 'sq_m')),
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Broker table
CREATE TABLE brokers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    area TEXT,
    rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
    status VARCHAR(10) NOT NULL CHECK (status IN ('active', 'inactive')),
    remarks TEXT,
    recent_task TEXT,
    residence TEXT DEFAULT ''
);

-- Linking table: many-to-many between brokers and land_records
CREATE TABLE broker_land_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
    land_record_id UUID NOT NULL REFERENCES land_records(id) ON DELETE CASCADE,
    last_offer DECIMAL(15,2),
    next_update DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'negotiating', 'deal_closed', 'rejected'))
    
    UNIQUE (broker_id, land_record_id)
);

CREATE TABLE activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Core Info
    user_email VARCHAR(255) NOT NULL,
    land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
    step INTEGER,
    chat_id UUID,
    description TEXT NOT NULL
);

CREATE TABLE chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    from_email VARCHAR(255) NOT NULL,
    to_email TEXT[], -- array of recipients, can be empty or NULL
    message TEXT NOT NULL,
    land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
    step INTEGER,

    -- Read tracking
    read_by TEXT[] DEFAULT '{}' -- stores list of emails who have read the message
);

CREATE TABLE projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by_email VARCHAR(255) NOT NULL,

    -- Relation to land records (multiple per project)
    land_record_ids UUID[] DEFAULT '{}'
);

CREATE TABLE owner_discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  land_record_id UUID REFERENCES land_records(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for better performance
CREATE INDEX idx_owner_discussions_land_record_id ON owner_discussions(land_record_id);
CREATE INDEX idx_owner_discussions_created_at ON owner_discussions(created_at);

-- Create indexes for better performance
CREATE INDEX idx_land_records_district ON land_records(district);
CREATE INDEX idx_land_records_status ON land_records(status);
CREATE INDEX idx_year_slabs_land_record ON year_slabs(land_record_id);
CREATE INDEX idx_panipatraks_land_record ON panipatraks(land_record_id);
CREATE INDEX idx_nondhs_land_record ON nondhs(land_record_id);
CREATE INDEX idx_nondh_owner_relations_detail_id ON nondh_owner_relations(nondh_detail_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_brokers_status ON brokers(status);
CREATE INDEX IF NOT EXISTS idx_broker_land_records_broker_id ON broker_land_records(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_land_records_status ON broker_land_records(status);

CREATE INDEX idx_activity_logs_land_record ON activity_logs(land_record_id);
CREATE INDEX idx_chats_land_record ON chats(land_record_id);
CREATE INDEX idx_projects_created_by ON projects(created_by_email);

-- Enable Row Level Security (RLS)
ALTER TABLE land_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE year_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE slab_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE panipatraks ENABLE ROW LEVEL SECURITY;
ALTER TABLE panipatrak_farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE nondhs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nondh_details ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on land_records" ON land_records FOR ALL USING (true);
CREATE POLICY "Allow all operations on year_slabs" ON year_slabs FOR ALL USING (true);
CREATE POLICY "Allow all operations on slab_entries" ON slab_entries FOR ALL USING (true);
CREATE POLICY "Allow all operations on farmers" ON farmers FOR ALL USING (true);
CREATE POLICY "Allow all operations on panipatraks" ON panipatraks FOR ALL USING (true);
CREATE POLICY "Allow all operations on panipatrak_farmers" ON panipatrak_farmers FOR ALL USING (true);
CREATE POLICY "Allow all operations on nondhs" ON nondhs FOR ALL USING (true);
CREATE POLICY "Allow all operations on nondh_details" ON nondh_details FOR ALL USING (true);

-- Stored Procedures, execute in the SQL editor
-- 1ST FUNCTION: Insert or Update Panipatraks and associated farmers
CREATE OR REPLACE FUNCTION public.update_panipatraks(
  p_land_record_id uuid,
  panipatraks_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  pani_data jsonb;
  farmer_data jsonb;
  pani_id uuid;
  existing_pani_id uuid;
BEGIN
  -- Start transaction
  BEGIN
    -- Loop through each panipatrak
    FOR pani_data IN SELECT * FROM jsonb_array_elements(panipatraks_data)
    LOOP
      -- Check if panipatrak already exists
      SELECT id INTO existing_pani_id
      FROM public.panipatraks 
      WHERE land_record_id = p_land_record_id 
        AND year_slab_id = (pani_data->>'slabId')::uuid
        AND year = (pani_data->>'year')::integer;
      
      IF existing_pani_id IS NOT NULL THEN
        -- Update existing panipatrak
        pani_id := existing_pani_id;
        -- Delete existing farmers for this panipatrak
        DELETE FROM public.panipatrak_farmers WHERE panipatrak_id = pani_id;
      ELSE
        -- Insert new panipatrak
        INSERT INTO public.panipatraks (
          land_record_id,
          year_slab_id,
          s_no,
          year,
          created_at
        ) VALUES (
          p_land_record_id,
          (pani_data->>'slabId')::uuid,
          pani_data->>'sNo',
          (pani_data->>'year')::integer,
          NOW()
        ) RETURNING id INTO pani_id;
      END IF;
      
      -- Insert farmers
      IF pani_data->'farmers' IS NOT NULL THEN
        FOR farmer_data IN SELECT * FROM jsonb_array_elements(pani_data->'farmers')
        LOOP
          INSERT INTO public.panipatrak_farmers (
            panipatrak_id,
            name,
            area_value,
            area_unit,
            paiky_number,
            ekatrikaran_number
          ) VALUES (
            pani_id,
            TRIM(farmer_data->>'name'),
            (farmer_data->'area'->>'value')::numeric,
            COALESCE(farmer_data->'area'->>'unit', 'sq_m'),
            NULLIF(TRIM(farmer_data->>'paikyNumber'), '')::integer,
            NULLIF(TRIM(farmer_data->>'ekatrikaranNumber'), '')::integer
          );
        END LOOP;
      END IF;
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'message', 'Panipatraks updated successfully');
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error in update_panipatraks: %', SQLERRM;
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- 2ND FUNCTION: Get valid owner relations with latest records
CREATE OR REPLACE FUNCTION get_valid_owner_relations()
RETURNS TABLE (
  id UUID,
  owner_name VARCHAR(255),
  s_no VARCHAR(255),
  s_no_type VARCHAR(20),
  acres NUMERIC,
  gunthas NUMERIC,
  square_meters NUMERIC,
  area_unit VARCHAR(10),
  created_at TIMESTAMPTZ,
  nondh_number VARCHAR(255),
  land_record_id UUID,
  district VARCHAR(255),
  taluka VARCHAR(255),
  village VARCHAR(255)
)
AS $$
BEGIN
  RETURN QUERY
  WITH latest_owner_records AS (
    SELECT 
      nor.owner_name,
      MAX(COALESCE(nd.date, nor.created_at)) as latest_date
    FROM 
      nondh_owner_relations nor
      JOIN nondh_details nd ON nor.nondh_detail_id = nd.id
    WHERE 
      nor.is_valid = TRUE
    GROUP BY 
      nor.owner_name
  )
  SELECT 
    nor.id,
    nor.owner_name,
    nor.s_no,
    COALESCE(ys.s_no_type, 'survey_no') AS s_no_type,
    nor.acres,
    nor.gunthas,
    nor.square_meters,
    nor.area_unit,
    COALESCE(nd.date, nor.created_at) as created_at,
    n.number::VARCHAR AS nondh_number,
    lr.id AS land_record_id,
    lr.district,
    lr.taluka,
    lr.village
  FROM 
    nondh_owner_relations nor
    JOIN nondh_details nd ON nor.nondh_detail_id = nd.id
    JOIN nondhs n ON nd.nondh_id = n.id
    JOIN land_records lr ON n.land_record_id = lr.id
    LEFT JOIN year_slabs ys ON lr.id = ys.land_record_id AND ys.s_no = nor.s_no
    JOIN latest_owner_records lor ON nor.owner_name = lor.owner_name 
      AND COALESCE(nd.date, nor.created_at) = lor.latest_date
  WHERE 
    nor.is_valid = TRUE
  ORDER BY 
    nor.created_at DESC;
END;
$$ LANGUAGE plpgsql;