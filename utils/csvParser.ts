import { Story } from '../types';

/**
 * A robust CSV row parser that handles quoted fields, commas within fields, and escaped quotes ("").
 * This is a state-machine based parser which is more reliable than complex regex for this task.
 * @param row A single string representing one row of CSV data.
 * @returns An array of strings, where each element is a field from the row.
 */
const parseCsvRow = (row: string): string[] => {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"') {
        if (i < row.length - 1 && row[i + 1] === '"') {
          // This is an escaped quote ("")
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // This is the end of a quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  fields.push(currentField); // Add the last field

  return fields;
};

/**
 * Parses a full CSV string into an array of Story objects.
 * This function first splits the data into rows, correctly handling newlines that appear inside quoted fields.
 * Then, it parses each row to extract the fields.
 * @param data The complete CSV data as a single string.
 * @returns An array of fully parsed Story objects.
 */
export const parseCSV = (data: string): Story[] => {
  // Normalize line endings and handle potential trailing newline
  const normalizedData = data.replace(/\r\n/g, '\n').trim();
  
  // Split data into rows, handling newlines within quoted fields
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;
  for (let i = 0; i < normalizedData.length; i++) {
    const char = normalizedData[i];
    
    if (char === '"') {
       inQuotes = !inQuotes;
    }
    
    if (char === '\n' && !inQuotes) {
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  if (currentRow.trim()) { // Add the last row
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = parseCsvRow(rows[0]).map(h => h.trim());
  const headerCount = headers.length;

  const stories: Story[] = rows.slice(1).map((rowStr, index) => {
    const values = parseCsvRow(rowStr.trim());
    
    // Pad values array if it's shorter than headers (due to trailing commas)
    while (values.length < headerCount) {
        values.push('');
    }

    const storyObject: any = {};
    headers.forEach((header, i) => {
      const key = header as keyof Story;
      let value: any = values[i] || '';
      
      if (key === 'score' || key === 'num_comments') {
        value = parseInt(value, 10) || 0;
      }
      if (key === 'is_self' || key === 'over_18') {
        value = value.toLowerCase() === 'true';
      }
      storyObject[key] = value;
    });

    const id = `${storyObject.author || 'story'}-${index}`;
    storyObject.id = id.replace(/[^a-zA-Z0-9-_]/g, ''); // Sanitize ID
    storyObject.status = 'idle';
    storyObject.isSelected = false;
    storyObject.audioFileName = `${storyObject.id}_story.wav`;
    storyObject.coverAudioFileName = `${storyObject.id}_cover.wav`;
    
    return storyObject as Story;
  }).filter(story => story.rewritten_story && story.rewritten_story.trim().length > 1);

  return stories;
};
