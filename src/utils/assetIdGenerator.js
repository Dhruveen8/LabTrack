// Asset ID standard generator: LT-[LAB_CODE]-[CATEGORY_CODE]-[SEQUENCE]

export const CATEGORY_CODES = {
  'Microcontrollers': 'MC',
  'Single Board Computers': 'SBC',
  'Testing & Measurement': 'TM',
  'Workshop Tools': 'WT',
  'Rapid Prototyping': 'RP',
  'Robotics': 'ROB',
  'AR / VR': 'VR',
  'Networking & IoT': 'NET',
  'Sensors & Modules': 'SEN',
  'Power & Batteries': 'PWR',
  'General Equipment': 'EQ'
};

export const getCategoryCode = (categoryName) => {
  if (!categoryName) return 'EQ';
  return CATEGORY_CODES[categoryName] || categoryName.substring(0, 3).toUpperCase();
};

export const getLabCode = (labId, labName) => {
  if (labId && labId.startsWith('LAB-')) {
    return labId.replace('LAB-', '');
  }
  if (labId) return labId.toUpperCase();
  if (labName) {
    const words = labName.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return labName.substring(0, 3).toUpperCase();
  }
  return 'GEN';
};

/**
 * Parses existing asset IDs to find the highest sequence number for a given lab and category
 */
export const getNextSequenceNumber = (labCode, catCode, existingEquipmentList = []) => {
  const prefix = `LT-${labCode}-${catCode}-`;
  let maxSeq = 0;

  existingEquipmentList.forEach(item => {
    const assetId = item.assetId || item.id || '';
    if (assetId.startsWith(prefix)) {
      const seqStr = assetId.replace(prefix, '');
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  });

  return maxSeq + 1;
};

/**
 * Generates an array of unique Asset IDs for a given quantity
 */
export const generateBulkAssetIds = (labId, labName, categoryName, quantity = 1, existingEquipmentList = []) => {
  const labCode = getLabCode(labId, labName);
  const catCode = getCategoryCode(categoryName);
  const startSeq = getNextSequenceNumber(labCode, catCode, existingEquipmentList);
  
  const ids = [];
  for (let i = 0; i < quantity; i++) {
    const seqFormatted = String(startSeq + i).padStart(5, '0');
    ids.push(`LT-${labCode}-${catCode}-${seqFormatted}`);
  }
  return ids;
};

/**
 * Generates a single Asset ID
 */
export const generateAssetId = (labId, labName, categoryName, existingEquipmentList = []) => {
  return generateBulkAssetIds(labId, labName, categoryName, 1, existingEquipmentList)[0];
};
