import { convertToSquareMeters } from './supabase';
import * as XLSX from 'xlsx-js-style';

// Base export function for Panipatraks
// In lib/supabase-exports.ts - update the panipatraks export function
export const exportPanipatraksToExcel = async (
  panipatraksData: any[], 
  landBasicInfo: any,
  yearSlabs: any[]
) => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Create header info with block number
    const headerInfo = [
      `District (જીલ્લો): ${landBasicInfo.district || 'N/A'}`,
      `Taluka (તાલુકો): ${landBasicInfo.taluka || 'N/A'}`,
      `Village (મોજે): ${landBasicInfo.village || 'N/A'}`,
      `Block No (બ્લોક નં.): ${landBasicInfo.blockNo || 'N/A'}`,
      landBasicInfo.reSurveyNo ? `Re-survey No (ફરી-સર્વે નં.): ${landBasicInfo.reSurveyNo}` : ''
    ].filter(Boolean).join(', ');

    // Create worksheet data for Panipatraks
    const wsData = [
      [headerInfo], // Header row
      [], // Empty row
      ['Year(s)', 'Farmer Name', 'Area Alloted'] // Column headers
    ];

    // Add panipatrak data in table format
    yearSlabs.forEach((slab) => {
      const slabPanipatraks = panipatraksData.filter(p => p.slabId === slab.id);
      const periods = getYearPeriods(slab.startYear, slab.endYear);
      const hasSameForAll = slabPanipatraks.length > 0 && 
                           slabPanipatraks.every(p => p.sameForAll === true);

      if (hasSameForAll) {
        // Single entry for all years
        const firstPeriodData = slabPanipatraks.find(p => p.year === periods[0]?.from);
        if (firstPeriodData && firstPeriodData.farmers) {
          firstPeriodData.farmers.forEach((farmer: any, index: number) => {
            const areaInSqM = farmer.area.unit === "sq_m" 
              ? farmer.area.value 
              : convertToSquareMeters(farmer.area.value, "sq_m");
            
            const acres = convertToSquareMeters(areaInSqM, "acre");
            const guntha = convertToSquareMeters(areaInSqM, "guntha") % 40;
            const areaDisplay = `${Math.round(areaInSqM * 100) / 100} sq.m (${Math.floor(acres)} acre ${Math.round(guntha)} guntha)`;

            wsData.push([
              index === 0 ? `${slab.startYear}-${slab.endYear}` : '', // Show year only for first row
              farmer.name,
              areaDisplay
            ]);
          });
        }
      } else {
        // Separate entries for each period
        periods.forEach((period) => {
          const periodData = slabPanipatraks.find(p => p.year === period.from);
          if (periodData && periodData.farmers) {
            periodData.farmers.forEach((farmer: any, index: number) => {
              const areaInSqM = farmer.area.unit === "sq_m" 
                ? farmer.area.value 
                : convertToSquareMeters(farmer.area.value, "sq_m");
              
              const acres = convertToSquareMeters(areaInSqM, "acre");
              const guntha = convertToSquareMeters(areaInSqM, "guntha") % 40;
              const areaDisplay = `${Math.round(areaInSqM * 100) / 100} sq.m (${Math.floor(acres)} acre ${Math.round(guntha)} guntha)`;

              wsData.push([
                index === 0 ? period.period : '', // Show year only for first row
                farmer.name,
                areaDisplay
              ]);
            });
          }
        });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Apply styles - similar to nondh table
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Style header row (A1) - center aligned like nondh table
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Style column headers (row 3)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "3";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 20 },  // Year(s)
      { wch: 30 },  // Farmer Name
      { wch: 40 }   // Area Alloted (combined)
    ];

    // Merge header info row across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Panipatraks');
    
    // Generate filename with block number
    const filename = `panipatraks-${landBasicInfo.blockNo || 'NA'}-${landBasicInfo.village || 'land'}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });

    return { success: true };
  } catch (error) {
    console.error('Error exporting panipatraks:', error);
    throw error;
  }
};

// Add helper function for year periods in the export file
const getYearPeriods = (startYear: number, endYear: number) => {
  if (!startYear || !endYear) return [];
  
  const periods: { from: number; to: number; period: string }[] = [];
  for (let y = startYear; y < endYear; y++) {
    periods.push({ 
      from: y, 
      to: y + 1, 
      period: `${y}-${y + 1}` 
    });
  }
  return periods;
};

// Export function for Passbook
export const exportPassbookToExcel = async (passbookData: any[], landBasicInfo: any) => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Create header info with block number
    const headerInfo = [
      `District (જીલ્લો): ${landBasicInfo.district || 'N/A'}`,
      `Taluka (તાલુકો): ${landBasicInfo.taluka || 'N/A'}`,
      `Village (મોજે): ${landBasicInfo.village || 'N/A'}`,
      `Block No (બ્લોક નં.): ${landBasicInfo.blockNo || 'N/A'}`,
      landBasicInfo.reSurveyNo ? `Re-survey No (ફરી-સર્વે નં.): ${landBasicInfo.reSurveyNo}` : ''
    ].filter(Boolean).join(', ');

    const wsData = [
      [headerInfo], // Header row
      [], // Empty row
      ['Year', 'Owner Name', 'Affected S.No', 'Area (sq.m)', 'Nondh No.']
    ];

    passbookData.forEach(entry => {
      wsData.push([
        entry.year,
        entry.ownerName,
        entry.affectedSNos || entry.sNo,
        entry.area?.toFixed(2),
        entry.nondhNumber || "-"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Style header row (A1) - center aligned and bold
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Style column headers (row 3)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "3";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    ws['!cols'] = [
      { wch: 10 },  // Year
      { wch: 25 },  // Owner Name
      { wch: 20 },  // Affected S.No
      { wch: 15 },  // Area
      { wch: 15 }   // Nondh No
    ];

    // Merge header info row across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Passbook');
    
    // Generate filename with block number
    const filename = `passbook-${landBasicInfo.blockNo || 'NA'}-${landBasicInfo.village || 'land'}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });

    return { success: true };
  } catch (error) {
    console.error('Error exporting passbook:', error);
    throw error;
  }
};

// Export function for Query List
export const exportQueryListToExcel = async (filteredNondhs: any[], landBasicInfo: any) => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Create header info with block number
    const headerInfo = [
      `District (જીલ્લો): ${landBasicInfo.district || 'N/A'}`,
      `Taluka (તાલુકો): ${landBasicInfo.taluka || 'N/A'}`,
      `Village (મોજે): ${landBasicInfo.village || 'N/A'}`,
      `Block No (બ્લોક નં.): ${landBasicInfo.blockNo || 'N/A'}`,
      landBasicInfo.reSurveyNo ? `Re-survey No (ફરી-સર્વે નં.): ${landBasicInfo.reSurveyNo}` : ''
    ].filter(Boolean).join(', ');

    const wsData = [
      [headerInfo], // Header row
      [], // Empty row
      ['Nondh No.', 'Nondh Doc', 'Relevant Docs Available', 'Relevant Docs']
    ];

    filteredNondhs.forEach(nondh => {
      wsData.push([
        nondh.nondhNumber,
        nondh.nondhDocUrl ? 'Available' : 'N/A',
        nondh.hasDocuments ? "Yes" : "No",
        nondh.hasDocuments ? (nondh.docUploadUrl ? 'Available' : 'Not Uploaded') : 'N/A'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Style header row (A1) - center aligned and bold
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Style column headers (row 3)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "3";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    ws['!cols'] = [
      { wch: 15 },  // Nondh No
      { wch: 15 },  // Nondh Doc
      { wch: 25 },  // Relevant Docs Available
      { wch: 20 }   // Relevant Docs
    ];

    // Merge header info row across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Query List');
    
    // Generate filename with block number
    const filename = `query-list-${landBasicInfo.blockNo || 'NA'}-${landBasicInfo.village || 'land'}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });

    return { success: true };
  } catch (error) {
    console.error('Error exporting query list:', error);
    throw error;
  }
};

// Export function for Date-wise
// Export function for Date-wise
export const exportDateWiseToExcel = async (dateWiseData: any[], landBasicInfo: any) => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Create header info with block number
    const headerInfo = [
      `District (જીલ્લો): ${landBasicInfo.district || 'N/A'}`,
      `Taluka (તાલુકો): ${landBasicInfo.taluka || 'N/A'}`,
      `Village (મોજે): ${landBasicInfo.village || 'N/A'}`,
      `Block No (બ્લોક નં.): ${landBasicInfo.blockNo || 'N/A'}`,
      landBasicInfo.reSurveyNo ? `Re-survey No (ફરી-સર્વે નં.): ${landBasicInfo.reSurveyNo}` : ''
    ].filter(Boolean).join(', ');

    // Status mapping function
    const getStatusDisplayName = (status: string): string => {
      switch (status) {
        case 'valid':
          return 'Pramaanik (પ્રમાણિત)'
        case 'nullified':
          return 'Na Manjoor (નામંજૂર)'
        case 'invalid':
          return 'Radd (રદ)'
        default:
          return status
      }
    };

    const wsData = [
      [headerInfo], // Header row
      [], // Empty row
      ['Date', 'Nondh No.', 'Affected S.No', 'Type', 'Status', 'Show in Output']
    ];

    dateWiseData.forEach(nondh => {
      const date = new Date(nondh.date || nondh.createdAt);
      const formattedDate = date.toLocaleDateString('en-IN');
      
      wsData.push([
        formattedDate,
        nondh.nondhNumber,
        nondh.affectedSNos || nondh.sNo,
        nondh.type,
        getStatusDisplayName(nondh.status), // Use the status mapping
        nondh.showInOutput ? 'Yes' : 'No'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Style header row (A1) - center aligned and bold
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    }

    // Style column headers (row 3)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "3";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    ws['!cols'] = [
      { wch: 12 },  // Date
      { wch: 15 },  // Nondh No
      { wch: 20 },  // Affected S.No
      { wch: 15 },  // Type
      { wch: 20 },  // Status (increased width for bilingual text)
      { wch: 15 }   // Show in Output
    ];

    // Merge header info row across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Date-wise Nondhs');
    
    // Generate filename with block number
    const filename = `datewise-nondhs-${landBasicInfo.blockNo || 'NA'}-${landBasicInfo.village || 'land'}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });

    return { success: true };
  } catch (error) {
    console.error('Error exporting date-wise data:', error);
    throw error;
  }
};